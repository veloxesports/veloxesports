"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/database/prisma";
import { Prisma, Role } from "@/lib/generated/prisma/client";
import { requireCurrentUser, requireRole } from "@/lib/auth/current-user";
import { getCurrentWebAdmin, type WebAdminRole } from "@/lib/auth/web-admin";
import { createEvidenceSignedUrl, uploadMatchEvidence, validateEvidenceFile } from "@/lib/database/supabase";
import { addXpToUser, checkAndAwardAchievements } from "@/features/profile/xp";
import { areMatchSidesOpposing, canSubmitMatchResult, hasBothMatchParticipants, isAwaitingOpponentConfirmation, nextBracketSlotForWinner } from "@/lib/matches/flow";
import { generateSingleEliminationBracketInTransaction } from "@/lib/tournaments/bracket";
import { completeTournamentIfReady } from "@/lib/tournaments/lifecycle";
import { dispatchTelegramNotificationsCreatedSince } from "@/lib/notifications/delivery";

const idSchema = z.string().uuid();
const resultSchema = z.object({
  matchId: idSchema,
  score1: z.number().int().min(0).max(999),
  score2: z.number().int().min(0).max(999),
  winnerId: idSchema,
  comment: z.string().trim().max(1_000).optional(),
});
const disputeSchema = z.object({
  matchId: idSchema,
  reason: z.string().trim().min(10).max(1_000),
});
const resolveDisputeSchema = z.object({
  disputeId: idSchema,
  resolutionNotes: z.string().trim().min(10).max(1_000),
  winnerId: idSchema.optional(),
  score1: z.number().int().min(0).max(999).optional(),
  score2: z.number().int().min(0).max(999).optional(),
});

type MatchParticipants = {
  player1Id: string | null;
  player2Id: string | null;
  team1Id: string | null;
  team2Id: string | null;
};

type MatchForAdvancement = MatchParticipants & {
  id: string;
  tournamentId: string;
  round: number;
  bracketPosition: number | null;
};

async function userCanActInMatch(
  tx: Pick<Prisma.TransactionClient, "teamMember">,
  userId: string,
  match: MatchParticipants,
) {
  if (match.player1Id === userId || match.player2Id === userId) return true;
  const teamIds = [match.team1Id, match.team2Id].filter((id): id is string => Boolean(id));
  if (teamIds.length === 0) return false;

  return Boolean(await tx.teamMember.findFirst({
    where: { userId, teamId: { in: teamIds } },
    select: { id: true },
  }));
}

type MatchSide = 1 | 2;

async function matchSidesForUser(
  tx: Pick<Prisma.TransactionClient, "teamMember">,
  userId: string,
  match: MatchParticipants,
): Promise<MatchSide[]> {
  const sides = new Set<MatchSide>();
  if (match.player1Id === userId) sides.add(1);
  if (match.player2Id === userId) sides.add(2);

  const teamIds = [match.team1Id, match.team2Id].filter((id): id is string => Boolean(id));
  if (teamIds.length) {
    const memberships = await tx.teamMember.findMany({
      where: { userId, teamId: { in: teamIds } },
      select: { teamId: true },
    });
    for (const membership of memberships) {
      if (membership.teamId === match.team1Id) sides.add(1);
      if (membership.teamId === match.team2Id) sides.add(2);
    }
  }

  return [...sides];
}

/** A result must be verified by an opposing side, not a teammate of its submitter. */
async function canRespondToOpponentResult(
  tx: Pick<Prisma.TransactionClient, "teamMember">,
  actorId: string,
  submitterId: string,
  match: MatchParticipants,
) {
  if (actorId === submitterId) return false;
  const [actorSides, submitterSides] = await Promise.all([
    matchSidesForUser(tx, actorId, match),
    matchSidesForUser(tx, submitterId, match),
  ]);
  return areMatchSidesOpposing(actorSides, submitterSides);
}

async function participantUserIds(tx: Prisma.TransactionClient, match: MatchParticipants, side: 1 | 2) {
  const directPlayerId = side === 1 ? match.player1Id : match.player2Id;
  if (directPlayerId) return [directPlayerId];

  const teamId = side === 1 ? match.team1Id : match.team2Id;
  if (!teamId) return [];

  const members = await tx.teamMember.findMany({ where: { teamId }, select: { userId: true } });
  return members.map((member) => member.userId);
}

async function advanceSingleEliminationWinner(
  tx: Prisma.TransactionClient,
  match: MatchForAdvancement,
  winnerId: string,
) {
  const bracketPosition = match.bracketPosition;
  if (bracketPosition === null) return;

  const slot = nextBracketSlotForWinner(match, winnerId);
  if (!slot) return;

  const tournament = await tx.tournament.findUnique({
    where: { id: match.tournamentId },
    select: { format: true, status: true },
  });
  if (tournament?.format !== "SINGLE_ELIMINATION") return;

  const nextMatch = await tx.match.findFirst({
    where: {
      tournamentId: match.tournamentId,
      round: match.round + 1,
      bracketPosition: Math.floor(bracketPosition / 2),
    },
  });
  if (!nextMatch) return;

  const existingParticipant = nextMatch[slot];
  if (existingParticipant && existingParticipant !== winnerId) {
    throw new Error("BRACKET_CONFLICT");
  }
  if (existingParticipant === winnerId) return;

  const nextParticipants = { ...nextMatch, [slot]: winnerId };
  await tx.match.update({
    where: { id: nextMatch.id },
    data: {
      [slot]: winnerId,
      status: nextMatch.status === "CANCELLED"
        ? "CANCELLED"
        : tournament.status === "LIVE" && hasBothMatchParticipants(nextParticipants)
          ? "LIVE"
          : "SCHEDULED",
    },
  });
}

async function getOpponentUserIds(tx: Prisma.TransactionClient, match: MatchParticipants, submitterId: string) {
  const sideOne = await participantUserIds(tx, match, 1);
  const sideTwo = await participantUserIds(tx, match, 2);
  return [...sideOne, ...sideTwo].filter((userId) => userId !== submitterId);
}

async function createPendingResult(
  userId: string,
  input: z.infer<typeof resultSchema>,
  evidence?: { storagePath: string; fileType: string; fileSize: number },
) {
  return prisma.$transaction(async (tx) => {
    const match = await tx.match.findUnique({ where: { id: input.matchId }, include: { tournament: { select: { status: true } } } });
    if (!match) throw new Error("MATCH_NOT_FOUND");
    if (!await userCanActInMatch(tx, userId, match)) throw new Error("NOT_PARTICIPANT");
    if (!canSubmitMatchResult(match.status)) throw new Error("MATCH_NOT_ACTIVE");
    if (match.tournament.status !== "LIVE") throw new Error("MATCH_NOT_LIVE");

    const participants = [match.player1Id, match.player2Id, match.team1Id, match.team2Id];
    if (!participants.includes(input.winnerId)) throw new Error("INVALID_WINNER");
    if (input.score1 === input.score2) throw new Error("TIED_RESULT");

    const expectedWinner = input.score1 > input.score2
      ? (match.player1Id ?? match.team1Id)
      : (match.player2Id ?? match.team2Id);
    if (expectedWinner !== input.winnerId) throw new Error("SCORE_WINNER_MISMATCH");

    const pendingResult = await tx.matchResult.findFirst({
      where: { matchId: match.id, status: "PENDING_CONFIRMATION" },
      select: { id: true },
    });
    if (pendingResult) throw new Error("RESULT_PENDING");

    const result = await tx.matchResult.create({
      data: {
        matchId: match.id,
        submitterId: userId,
        score1: input.score1,
        score2: input.score2,
        winnerId: input.winnerId,
        status: "PENDING_CONFIRMATION",
        comment: input.comment,
      },
    });

    if (evidence) {
      await tx.matchEvidence.create({
        data: { matchId: match.id, uploaderId: userId, ...evidence },
      });
    }

    const opponentIds = await getOpponentUserIds(tx, match, userId);
    if (opponentIds.length > 0) {
      await tx.notification.createMany({
        data: opponentIds.map((recipientId) => ({
          userId: recipientId,
          type: "MATCH",
          title: "Match result awaiting confirmation",
          message: "Your opponent submitted a match result for review.",
          metadata: { matchId: match.id, resultId: result.id },
          telegramDeliveryEligible: true,
        })),
      });
    }

    await tx.match.update({ where: { id: match.id }, data: { status: "AWAITING_RESULT" } });
    return result;
  }, { isolationLevel: "Serializable", maxWait: 5_000, timeout: 10_000 });
}

function knownMatchError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  const known: Record<string, string> = {
    UNAUTHENTICATED: "You must be signed in.",
    FORBIDDEN: "You do not have permission to perform this action.",
    MATCH_NOT_FOUND: "Match not found.",
    NOT_PARTICIPANT: "Only match participants may perform this action.",
    MATCH_NOT_ACTIVE: "This match is not accepting results.",
    MATCH_NOT_LIVE: "This fixture is not live yet. Wait for the tournament to start before submitting a result.",
    INVALID_WINNER: "The selected winner is not a participant in this match.",
    TIED_RESULT: "A match result must have a winner.",
    SCORE_WINNER_MISMATCH: "The selected winner must match the submitted score.",
    RESULT_PENDING: "A result is already awaiting opponent confirmation.",
    RESULT_NOT_FOUND: "The pending result no longer exists.",
    RESULT_SAME_SIDE: "Only an opposing player or team member can confirm or reject this result.",
    DISPUTE_NOT_AVAILABLE: "This match is not currently eligible for a dispute.",
    DISPUTE_EXISTS: "There is already an open dispute for this match.",
    DISPUTE_NOT_FOUND: "Dispute not found.",
    DISPUTE_RESOLVED: "This dispute has already been resolved.",
    BRACKET_CONFLICT: "The bracket changed while this result was being processed.",
    INVALID_EVIDENCE_FILE: "Upload a JPG, PNG, or WebP image smaller than 5 MB.",
    SUPABASE_STORAGE_NOT_CONFIGURED: "Match evidence storage has not been configured yet.",
    EVIDENCE_UPLOAD_FAILED: "We couldn't upload the evidence. Please try again.",
  };
  return known[message];
}

export async function generateSingleEliminationBracket(tournamentId: unknown) {
  const parsedTournamentId = idSchema.safeParse(tournamentId);
  if (!parsedTournamentId.success) return { success: false, error: "Invalid tournament." };

  try {
    await requireRole(["SUPER_ADMIN", "ADMIN", "TOURNAMENT_MANAGER"]);
    await prisma.$transaction(async (tx) => {
      await generateSingleEliminationBracketInTransaction(tx, parsedTournamentId.data);
    }, { isolationLevel: "Serializable", maxWait: 5_000, timeout: 20_000 });

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const known: Record<string, string> = {
      UNAUTHENTICATED: "You must be signed in.",
      FORBIDDEN: "You do not have permission to generate brackets.",
      TOURNAMENT_NOT_FOUND: "Tournament not found.",
      CHECK_IN_NOT_LOCKED: "Lock no-shows after check-in before generating a bracket.",
      CHECK_IN_REQUIRED: "Complete tournament check-in before generating a bracket.",
      UNSUPPORTED_FORMAT: "This generator only supports single-elimination tournaments.",
      BRACKET_EXISTS: "A bracket has already been generated.",
      NOT_ENOUGH_PARTICIPANTS: "At least two checked-in participants are required.",
      TEAM_REGISTRATION_INVALID: "A checked-in team entry is missing its roster. Review registrations before generating the bracket.",
    };
    if (known[message]) return { success: false, error: known[message] };
    console.error("Bracket generation failed", error);
    return { success: false, error: "We couldn't generate the bracket. Please try again." };
  }
}

export async function submitMatchResult(input: unknown) {
  const parsed = resultSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Enter valid scores and a winner." };

  try {
    const notificationSince = new Date();
    const user = await requireCurrentUser();
    await createPendingResult(user.id, parsed.data);
    await dispatchTelegramNotificationsCreatedSince(notificationSince);
    revalidatePath(`/matches/${parsed.data.matchId}`);
    revalidatePath("/matches");
    return { success: true };
  } catch (error) {
    const knownError = knownMatchError(error);
    if (knownError) return { success: false, error: knownError };
    console.error("Match result submission failed", error);
    return { success: false, error: "We couldn't submit this result. Please try again." };
  }
}

export async function submitMatchResultWithEvidence(formData: FormData) {
  const file = formData.get("evidence");
  const parsed = resultSchema.safeParse({
    matchId: formData.get("matchId"),
    score1: Number(formData.get("score1")),
    score2: Number(formData.get("score2")),
    winnerId: formData.get("winnerId"),
    comment: formData.get("comment") || undefined,
  });
  if (!parsed.success) return { success: false, error: "Enter valid scores and a winner." };

  try {
    const notificationSince = new Date();
    const user = await requireCurrentUser();
    const evidence = file && validateEvidenceFile(file)
      ? await uploadMatchEvidence(parsed.data.matchId, user.id, file)
      : undefined;
    if (file && !evidence) throw new Error("INVALID_EVIDENCE_FILE");

    await createPendingResult(user.id, parsed.data, evidence);
    await dispatchTelegramNotificationsCreatedSince(notificationSince);
    revalidatePath(`/matches/${parsed.data.matchId}`);
    revalidatePath("/matches");
    return { success: true };
  } catch (error) {
    const knownError = knownMatchError(error);
    if (knownError) return { success: false, error: knownError };
    console.error("Evidence-backed match result submission failed", error);
    return { success: false, error: "We couldn't submit this result. Please try again." };
  }
}

export async function confirmMatchResult(matchId: unknown) {
  const parsedMatchId = idSchema.safeParse(matchId);
  if (!parsedMatchId.success) return { success: false, error: "Invalid match." };

  try {
    const notificationSince = new Date();
    const user = await requireCurrentUser();
    const outcome = await prisma.$transaction(async (tx) => {
      const match = await tx.match.findUnique({ where: { id: parsedMatchId.data } });
      if (!match) throw new Error("MATCH_NOT_FOUND");
      if (!await userCanActInMatch(tx, user.id, match)) throw new Error("NOT_PARTICIPANT");
      if (!isAwaitingOpponentConfirmation(match.status)) throw new Error("MATCH_NOT_ACTIVE");

      const result = await tx.matchResult.findFirst({
        where: { matchId: match.id, status: "PENDING_CONFIRMATION" },
        orderBy: { createdAt: "desc" },
      });
      if (!result) throw new Error("RESULT_NOT_FOUND");
      if (!await canRespondToOpponentResult(tx, user.id, result.submitterId, match)) throw new Error("RESULT_SAME_SIDE");

      await tx.matchResult.update({ where: { id: result.id }, data: { status: "CONFIRMED" } });
      await tx.match.update({
        where: { id: match.id },
        data: { status: "COMPLETED", score1: result.score1, score2: result.score2, winnerId: result.winnerId },
      });
      await advanceSingleEliminationWinner(tx, match, result.winnerId);

      const winnerIsFirstSide = result.winnerId === (match.player1Id ?? match.team1Id);
      const winnerIds = await participantUserIds(tx, match, winnerIsFirstSide ? 1 : 2);
      const loserIds = await participantUserIds(tx, match, winnerIsFirstSide ? 2 : 1);
      if (winnerIds.length) {
        await tx.userProfile.updateMany({ where: { userId: { in: winnerIds } }, data: { wins: { increment: 1 } } });
      }
      if (loserIds.length) {
        await tx.userProfile.updateMany({ where: { userId: { in: loserIds } }, data: { losses: { increment: 1 } } });
      }
      await tx.notification.createMany({
        data: [...winnerIds, ...loserIds].map((recipientId) => ({
          userId: recipientId,
          type: "MATCH",
          title: "Match result confirmed",
          message: "Your match result has been confirmed and recorded.",
          metadata: { matchId: match.id, resultId: result.id },
          telegramDeliveryEligible: true,
        })),
      });

      return { winnerIds, loserIds, tournamentId: match.tournamentId };
    }, { isolationLevel: "Serializable", maxWait: 5_000, timeout: 10_000 });

    await Promise.all([
      ...outcome.winnerIds.map((userId) => addXpToUser(userId, 50)),
      ...outcome.loserIds.map((userId) => addXpToUser(userId, 10)),
    ]);
    await Promise.all([...outcome.winnerIds, ...outcome.loserIds].map((userId) => checkAndAwardAchievements(userId)));
    await completeTournamentIfReady(outcome.tournamentId);
    await dispatchTelegramNotificationsCreatedSince(notificationSince);
    revalidatePath(`/matches/${parsedMatchId.data}`);
    revalidatePath("/matches");
    revalidatePath("/leaderboard");
    revalidatePath("/profile");
    return { success: true };
  } catch (error) {
    const knownError = knownMatchError(error);
    if (knownError) return { success: false, error: knownError };
    console.error("Match result confirmation failed", error);
    return { success: false, error: "We couldn't confirm this result. Please try again." };
  }
}

export async function rejectMatchResult(matchId: unknown) {
  const parsedMatchId = idSchema.safeParse(matchId);
  if (!parsedMatchId.success) return { success: false, error: "Invalid match." };

  try {
    const notificationSince = new Date();
    const user = await requireCurrentUser();
    await prisma.$transaction(async (tx) => {
      const match = await tx.match.findUnique({ where: { id: parsedMatchId.data } });
      if (!match) throw new Error("MATCH_NOT_FOUND");
      if (!await userCanActInMatch(tx, user.id, match)) throw new Error("NOT_PARTICIPANT");
      if (!isAwaitingOpponentConfirmation(match.status)) throw new Error("MATCH_NOT_ACTIVE");
      const result = await tx.matchResult.findFirst({ where: { matchId: match.id, status: "PENDING_CONFIRMATION" } });
      if (!result) throw new Error("RESULT_NOT_FOUND");
      if (!await canRespondToOpponentResult(tx, user.id, result.submitterId, match)) throw new Error("RESULT_SAME_SIDE");

      await tx.matchResult.update({ where: { id: result.id }, data: { status: "REJECTED" } });
      await tx.match.update({ where: { id: match.id }, data: { status: "UNDER_REVIEW" } });
      await tx.notification.create({
        data: {
          userId: result.submitterId,
          type: "MATCH",
          title: "Match result rejected",
          message: "Your opponent rejected the submitted result. You can open a dispute for moderator review.",
          metadata: { matchId: match.id, resultId: result.id },
          telegramDeliveryEligible: true,
        },
      });
    }, { isolationLevel: "Serializable", maxWait: 5_000, timeout: 10_000 });
    await dispatchTelegramNotificationsCreatedSince(notificationSince);
    revalidatePath(`/matches/${parsedMatchId.data}`);
    revalidatePath("/matches");
    return { success: true };
  } catch (error) {
    const knownError = knownMatchError(error);
    if (knownError) return { success: false, error: knownError };
    console.error("Match result rejection failed", error);
    return { success: false, error: "We couldn't reject this result. Please try again." };
  }
}

export async function createDispute(input: unknown) {
  const parsed = disputeSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Describe the dispute in at least 10 characters." };

  try {
    const user = await requireCurrentUser();
    await prisma.$transaction(async (tx) => {
      const match = await tx.match.findUnique({ where: { id: parsed.data.matchId } });
      if (!match) throw new Error("MATCH_NOT_FOUND");
      if (!await userCanActInMatch(tx, user.id, match)) throw new Error("NOT_PARTICIPANT");
      if (!['AWAITING_RESULT', 'UNDER_REVIEW', 'DISPUTED'].includes(match.status)) throw new Error("DISPUTE_NOT_AVAILABLE");
      const existingDispute = await tx.dispute.findFirst({ where: { matchId: match.id, status: "OPEN" }, select: { id: true } });
      if (existingDispute) throw new Error("DISPUTE_EXISTS");

      await tx.dispute.create({ data: { matchId: match.id, creatorId: user.id, reason: parsed.data.reason, status: "OPEN" } });
      await tx.match.update({ where: { id: match.id }, data: { status: "DISPUTED" } });
    }, { isolationLevel: "Serializable", maxWait: 5_000, timeout: 10_000 });
    revalidatePath(`/matches/${parsed.data.matchId}`);
    revalidatePath("/matches");
    return { success: true };
  } catch (error) {
    const knownError = knownMatchError(error);
    if (knownError) return { success: false, error: knownError };
    console.error("Dispute creation failed", error);
    return { success: false, error: "We couldn't open a dispute. Please try again." };
  }
}

export async function resolveDispute(input: unknown) {
  const parsed = resolveDisputeSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Enter a resolution note and valid optional score." };

  try {
    const notificationSince = new Date();
    const moderator = await requireRole(["SUPER_ADMIN", "ADMIN", "TOURNAMENT_MANAGER", "MODERATOR"]);
    const outcome = await prisma.$transaction(async (tx) => {
      const dispute = await tx.dispute.findUnique({ where: { id: parsed.data.disputeId }, include: { match: true } });
      if (!dispute) throw new Error("DISPUTE_NOT_FOUND");
      if (dispute.status !== "OPEN") throw new Error("DISPUTE_RESOLVED");

      const match = dispute.match;
      if (parsed.data.winnerId && ![match.player1Id, match.player2Id, match.team1Id, match.team2Id].includes(parsed.data.winnerId)) {
        throw new Error("INVALID_WINNER");
      }
      if (parsed.data.winnerId && (parsed.data.score1 === undefined || parsed.data.score2 === undefined || parsed.data.score1 === parsed.data.score2)) {
        throw new Error("SCORE_WINNER_MISMATCH");
      }
      if (!parsed.data.winnerId && (parsed.data.score1 !== undefined || parsed.data.score2 !== undefined)) throw new Error("SCORE_WINNER_MISMATCH");
      if (parsed.data.winnerId) {
        const expectedWinner = parsed.data.score1! > parsed.data.score2!
          ? (match.player1Id ?? match.team1Id)
          : (match.player2Id ?? match.team2Id);
        if (expectedWinner !== parsed.data.winnerId) throw new Error("SCORE_WINNER_MISMATCH");
      }

      await tx.dispute.update({
        where: { id: dispute.id },
        data: { status: parsed.data.winnerId ? "RESOLVED" : "CLOSED", resolverId: moderator.id, resolutionNotes: parsed.data.resolutionNotes, resolvedAt: new Date() },
      });
      if (parsed.data.winnerId) {
        await tx.match.update({
          where: { id: match.id },
          data: {
            status: "COMPLETED",
            winnerId: parsed.data.winnerId,
            score1: parsed.data.score1,
            score2: parsed.data.score2,
          },
        });
        await tx.matchResult.updateMany({ where: { matchId: match.id, status: "PENDING_CONFIRMATION" }, data: { status: "DISPUTED" } });
        await advanceSingleEliminationWinner(tx, match, parsed.data.winnerId);
        const winnerIsFirstSide = parsed.data.winnerId === (match.player1Id ?? match.team1Id);
        const winnerIds = await participantUserIds(tx, match, winnerIsFirstSide ? 1 : 2);
        const loserIds = await participantUserIds(tx, match, winnerIsFirstSide ? 2 : 1);
        if (winnerIds.length) await tx.userProfile.updateMany({ where: { userId: { in: winnerIds } }, data: { wins: { increment: 1 } } });
        if (loserIds.length) await tx.userProfile.updateMany({ where: { userId: { in: loserIds } }, data: { losses: { increment: 1 } } });
        await tx.notification.createMany({
          data: [...winnerIds, ...loserIds].map((recipientId) => ({
            userId: recipientId,
            type: "MATCH",
            title: "Dispute resolved",
            message: "A moderator resolved your match dispute and updated the result.",
            metadata: { disputeId: dispute.id, matchId: match.id },
            telegramDeliveryEligible: true,
          })),
        });
        await tx.auditLog.create({
          data: {
            adminId: moderator.id,
            action: "DISPUTE_RESOLVED",
            entity: "Dispute",
            entityId: dispute.id,
            newValue: { winnerId: parsed.data.winnerId, score1: parsed.data.score1!, score2: parsed.data.score2!, resolutionNotes: parsed.data.resolutionNotes },
          },
        });
        return { winnerIds, loserIds, matchId: match.id, tournamentId: match.tournamentId };
      } else {
        await tx.match.update({ where: { id: match.id }, data: { status: "UNDER_REVIEW" } });
        await tx.auditLog.create({
          data: { adminId: moderator.id, action: "DISPUTE_CLOSED", entity: "Dispute", entityId: dispute.id, newValue: { resolutionNotes: parsed.data.resolutionNotes } },
        });
        return { winnerIds: [], loserIds: [], matchId: match.id, tournamentId: match.tournamentId };
      }
    }, { isolationLevel: "Serializable", maxWait: 5_000, timeout: 10_000 });
    await Promise.all([
      ...outcome.winnerIds.map((userId) => addXpToUser(userId, 50)),
      ...outcome.loserIds.map((userId) => addXpToUser(userId, 10)),
    ]);
    await Promise.all([...outcome.winnerIds, ...outcome.loserIds].map((userId) => checkAndAwardAchievements(userId)));
    await completeTournamentIfReady(outcome.tournamentId);
    await dispatchTelegramNotificationsCreatedSince(notificationSince);
    revalidatePath(`/matches/${outcome.matchId}`);
    revalidatePath("/matches");
    revalidatePath("/leaderboard");
    revalidatePath("/profile");
    return { success: true };
  } catch (error) {
    const knownError = knownMatchError(error);
    if (knownError) return { success: false, error: knownError };
    console.error("Dispute resolution failed", error);
    return { success: false, error: "We couldn't resolve this dispute. Please try again." };
  }
}

export async function getMatchDetails(matchId: unknown) {
  const parsedMatchId = idSchema.safeParse(matchId);
  if (!parsedMatchId.success) return { success: false, error: "Invalid match." };

  try {
    const webAdmin = await getCurrentWebAdmin();
    const user = webAdmin ?? await requireCurrentUser();
    const match = await prisma.match.findUnique({
      where: { id: parsedMatchId.data },
      include: {
        tournament: { select: { title: true, format: true, status: true } },
        results: { orderBy: { createdAt: "desc" }, take: 1 },
        evidence: { orderBy: { createdAt: "desc" } },
        disputes: { where: { status: "OPEN" }, select: { id: true, status: true } },
      },
    });
    if (!match) return { success: false, error: "Match not found." };

    const canAct = await userCanActInMatch(prisma, user.id, match);
    const moderatorRoles: Array<Role | WebAdminRole> = [Role.SUPER_ADMIN, Role.ADMIN, Role.TOURNAMENT_MANAGER, Role.MODERATOR];
    const isModerator = moderatorRoles.includes(user.role);
    const participantIds = [match.player1Id, match.player2Id].filter((id): id is string => Boolean(id));
    const teamIds = [match.team1Id, match.team2Id].filter((id): id is string => Boolean(id));
    const [players, teams] = await Promise.all([
      prisma.user.findMany({ where: { id: { in: participantIds } }, select: { id: true, firstName: true, username: true } }),
      prisma.team.findMany({ where: { id: { in: teamIds } }, select: { id: true, name: true } }),
    ]);
    const playerNames = new Map(players.map((player) => [player.id, player.username ?? player.firstName ?? "Player"]));
    const teamNames = new Map(teams.map((team) => [team.id, team.name]));
    const labelFor = (playerId: string | null, teamId: string | null) =>
      playerId ? playerNames.get(playerId) ?? "Player" : teamId ? teamNames.get(teamId) ?? "Team" : "TBD";

    const evidence = canAct || isModerator
      ? await Promise.all(match.evidence.map(async (item) => ({
          id: item.id,
          fileType: item.fileType,
          createdAt: item.createdAt,
          signedUrl: await createEvidenceSignedUrl(item.storagePath).catch(() => null),
        })))
      : [];

    const pendingResult = match.results[0]?.status === "PENDING_CONFIRMATION" ? match.results[0] : null;
    const canConfirm = Boolean(
      pendingResult
      && canAct
      && !webAdmin
      && isAwaitingOpponentConfirmation(match.status)
      && await canRespondToOpponentResult(prisma, user.id, pendingResult.submitterId, match),
    );
    return {
      success: true,
      data: {
        id: match.id,
        tournamentTitle: match.tournament.title,
        round: match.round,
        scheduledTime: match.scheduledTime,
        status: match.status,
        score1: match.score1,
        score2: match.score2,
        player1: { id: match.player1Id ?? match.team1Id, name: labelFor(match.player1Id, match.team1Id) },
        player2: { id: match.player2Id ?? match.team2Id, name: labelFor(match.player2Id, match.team2Id) },
        pendingResult: pendingResult && {
          id: pendingResult.id,
          submitterId: pendingResult.submitterId,
          score1: pendingResult.score1,
          score2: pendingResult.score2,
          winnerId: pendingResult.winnerId,
          comment: pendingResult.comment,
        },
        canSubmit: !webAdmin && canAct && match.tournament.status === "LIVE" && canSubmitMatchResult(match.status),
        canConfirm,
        canDispute: !webAdmin && canAct && ["AWAITING_RESULT", "UNDER_REVIEW", "DISPUTED"].includes(match.status),
        hasOpenDispute: match.disputes.length > 0,
        evidence,
      },
    };
  } catch (error) {
    const knownError = knownMatchError(error);
    if (knownError) return { success: false, error: knownError };
    console.error("Match details fetch failed", error);
    return { success: false, error: "We couldn't load this match." };
  }
}
