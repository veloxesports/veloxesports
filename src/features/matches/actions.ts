"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/database/prisma";
import { Prisma, Role } from "@/lib/generated/prisma/client";
import { requireCurrentUser, requireRole } from "@/lib/auth/current-user";
import { createEvidenceSignedUrl, uploadMatchEvidence, validateEvidenceFile } from "@/lib/database/supabase";
import { addXpToUser, checkAndAwardAchievements } from "@/features/profile/xp";

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
  if (match.bracketPosition === null) return;

  const tournament = await tx.tournament.findUnique({
    where: { id: match.tournamentId },
    select: { format: true },
  });
  if (tournament?.format !== "SINGLE_ELIMINATION") return;

  const nextMatch = await tx.match.findFirst({
    where: {
      tournamentId: match.tournamentId,
      round: match.round + 1,
      bracketPosition: Math.floor(match.bracketPosition / 2),
    },
  });
  if (!nextMatch) return;

  const advancesIntoFirstSlot = match.bracketPosition % 2 === 0;
  const slot = advancesIntoFirstSlot ? "player1Id" : "player2Id";
  const existingParticipant = nextMatch[slot];
  if (existingParticipant && existingParticipant !== winnerId) {
    throw new Error("BRACKET_CONFLICT");
  }
  if (existingParticipant === winnerId) return;

  await tx.match.update({
    where: { id: nextMatch.id },
    data: {
      [slot]: winnerId,
      status: nextMatch.status === "CANCELLED" ? "CANCELLED" : "SCHEDULED",
    },
  });
}

async function settleAutomaticByes(tx: Prisma.TransactionClient, tournamentId: string) {
  const matches = await tx.match.findMany({
    where: { tournamentId, status: "COMPLETED", winnerId: { not: null }, bracketPosition: { not: null } },
    orderBy: [{ round: "asc" }, { bracketPosition: "asc" }],
  });

  for (const match of matches) {
    await advanceSingleEliminationWinner(tx, match, match.winnerId!);
  }

  // Only automatically complete a next-round match when the opposing source
  // match was itself an empty bye. A future, unresolved match never forfeits.
  for (let round = 2; round <= 16; round += 1) {
    const candidates = await tx.match.findMany({
      where: { tournamentId, round, status: "SCHEDULED", bracketPosition: { not: null } },
    });
    let advanced = false;

    for (const candidate of candidates) {
      const hasFirst = Boolean(candidate.player1Id || candidate.team1Id);
      const hasSecond = Boolean(candidate.player2Id || candidate.team2Id);
      if (hasFirst === hasSecond || candidate.bracketPosition === null) continue;

      const missingSourcePosition = candidate.bracketPosition * 2 + (hasFirst ? 1 : 0);
      const missingSource = await tx.match.findFirst({
        where: { tournamentId, round: round - 1, bracketPosition: missingSourcePosition },
        select: { status: true, winnerId: true },
      });
      if (!missingSource || missingSource.status !== "COMPLETED" || missingSource.winnerId) continue;

      const winnerId = hasFirst ? candidate.player1Id ?? candidate.team1Id : candidate.player2Id ?? candidate.team2Id;
      if (!winnerId) continue;
      await tx.match.update({ where: { id: candidate.id }, data: { status: "COMPLETED", winnerId } });
      await advanceSingleEliminationWinner(tx, candidate, winnerId);
      advanced = true;
    }

    if (!advanced) continue;
  }
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
    const match = await tx.match.findUnique({ where: { id: input.matchId } });
    if (!match) throw new Error("MATCH_NOT_FOUND");
    if (!await userCanActInMatch(tx, userId, match)) throw new Error("NOT_PARTICIPANT");
    if (!['SCHEDULED', 'READY', 'LIVE'].includes(match.status)) throw new Error("MATCH_NOT_ACTIVE");

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
    INVALID_WINNER: "The selected winner is not a participant in this match.",
    TIED_RESULT: "A match result must have a winner.",
    SCORE_WINNER_MISMATCH: "The selected winner must match the submitted score.",
    RESULT_PENDING: "A result is already awaiting opponent confirmation.",
    RESULT_NOT_FOUND: "The pending result no longer exists.",
    RESULT_SUBMITTER: "The submitting player cannot confirm their own result.",
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
      const tournament = await tx.tournament.findUnique({
        where: { id: parsedTournamentId.data },
        include: { registrations: { where: { status: "CONFIRMED" }, orderBy: { createdAt: "asc" } } },
      });
      if (!tournament) throw new Error("TOURNAMENT_NOT_FOUND");
      if (tournament.status !== "REGISTRATION_CLOSED") throw new Error("REGISTRATION_OPEN");
      if (tournament.format !== "SINGLE_ELIMINATION") throw new Error("UNSUPPORTED_FORMAT");

      const existingMatches = await tx.match.count({ where: { tournamentId: tournament.id } });
      if (existingMatches > 0) throw new Error("BRACKET_EXISTS");
      if (tournament.registrations.length < 2) throw new Error("NOT_ENOUGH_PARTICIPANTS");

      const participants = tournament.registrations.map((registration) => registration.userId);
      const bracketSize = 2 ** Math.ceil(Math.log2(participants.length));
      const totalRounds = Math.log2(bracketSize);

      for (let round = 1; round <= totalRounds; round += 1) {
        const matchesInRound = bracketSize / 2 ** round;
        for (let bracketPosition = 0; bracketPosition < matchesInRound; bracketPosition += 1) {
          const player1Id = round === 1 ? participants[bracketPosition * 2] ?? null : null;
          const player2Id = round === 1 ? participants[bracketPosition * 2 + 1] ?? null : null;
          const winnerId = player1Id && !player2Id ? player1Id : player2Id && !player1Id ? player2Id : null;
          await tx.match.create({
            data: {
              tournamentId: tournament.id,
              round,
              bracketPosition,
              player1Id,
              player2Id,
              status: winnerId || (!player1Id && !player2Id) ? "COMPLETED" : "SCHEDULED",
              winnerId,
            },
          });
        }
      }

      await settleAutomaticByes(tx, tournament.id);
      await tx.tournament.update({ where: { id: tournament.id }, data: { status: "UPCOMING" } });
    }, { isolationLevel: "Serializable", maxWait: 5_000, timeout: 20_000 });

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const known: Record<string, string> = {
      UNAUTHENTICATED: "You must be signed in.",
      FORBIDDEN: "You do not have permission to generate brackets.",
      TOURNAMENT_NOT_FOUND: "Tournament not found.",
      REGISTRATION_OPEN: "Close registration before generating brackets.",
      UNSUPPORTED_FORMAT: "This generator only supports single-elimination tournaments.",
      BRACKET_EXISTS: "A bracket has already been generated.",
      NOT_ENOUGH_PARTICIPANTS: "At least two confirmed participants are required.",
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
    const user = await requireCurrentUser();
    await createPendingResult(user.id, parsed.data);
    revalidatePath(`/matches/${parsed.data.matchId}`);
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
    const user = await requireCurrentUser();
    const evidence = file && validateEvidenceFile(file)
      ? await uploadMatchEvidence(parsed.data.matchId, user.id, file)
      : undefined;
    if (file && !evidence) throw new Error("INVALID_EVIDENCE_FILE");

    await createPendingResult(user.id, parsed.data, evidence);
    revalidatePath(`/matches/${parsed.data.matchId}`);
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
    const user = await requireCurrentUser();
    const outcome = await prisma.$transaction(async (tx) => {
      const match = await tx.match.findUnique({ where: { id: parsedMatchId.data } });
      if (!match) throw new Error("MATCH_NOT_FOUND");
      if (!await userCanActInMatch(tx, user.id, match)) throw new Error("NOT_PARTICIPANT");
      if (match.status !== "AWAITING_RESULT") throw new Error("MATCH_NOT_ACTIVE");

      const result = await tx.matchResult.findFirst({
        where: { matchId: match.id, status: "PENDING_CONFIRMATION" },
        orderBy: { createdAt: "desc" },
      });
      if (!result) throw new Error("RESULT_NOT_FOUND");
      if (result.submitterId === user.id) throw new Error("RESULT_SUBMITTER");

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
        })),
      });

      return { winnerIds, loserIds };
    }, { isolationLevel: "Serializable", maxWait: 5_000, timeout: 10_000 });

    await Promise.all([
      ...outcome.winnerIds.map((userId) => addXpToUser(userId, 50)),
      ...outcome.loserIds.map((userId) => addXpToUser(userId, 10)),
    ]);
    await Promise.all([...outcome.winnerIds, ...outcome.loserIds].map((userId) => checkAndAwardAchievements(userId)));
    revalidatePath(`/matches/${parsedMatchId.data}`);
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
    const user = await requireCurrentUser();
    await prisma.$transaction(async (tx) => {
      const match = await tx.match.findUnique({ where: { id: parsedMatchId.data } });
      if (!match) throw new Error("MATCH_NOT_FOUND");
      if (!await userCanActInMatch(tx, user.id, match)) throw new Error("NOT_PARTICIPANT");
      const result = await tx.matchResult.findFirst({ where: { matchId: match.id, status: "PENDING_CONFIRMATION" } });
      if (!result) throw new Error("RESULT_NOT_FOUND");
      if (result.submitterId === user.id) throw new Error("RESULT_SUBMITTER");

      await tx.matchResult.update({ where: { id: result.id }, data: { status: "REJECTED" } });
      await tx.match.update({ where: { id: match.id }, data: { status: "UNDER_REVIEW" } });
      await tx.notification.create({
        data: {
          userId: result.submitterId,
          type: "MATCH",
          title: "Match result rejected",
          message: "Your opponent rejected the submitted result. You can open a dispute for moderator review.",
          metadata: { matchId: match.id, resultId: result.id },
        },
      });
    }, { isolationLevel: "Serializable", maxWait: 5_000, timeout: 10_000 });
    revalidatePath(`/matches/${parsedMatchId.data}`);
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
        return { winnerIds, loserIds };
      } else {
        await tx.match.update({ where: { id: match.id }, data: { status: "UNDER_REVIEW" } });
        await tx.auditLog.create({
          data: { adminId: moderator.id, action: "DISPUTE_CLOSED", entity: "Dispute", entityId: dispute.id, newValue: { resolutionNotes: parsed.data.resolutionNotes } },
        });
        return { winnerIds: [], loserIds: [] };
      }
    }, { isolationLevel: "Serializable", maxWait: 5_000, timeout: 10_000 });
    await Promise.all([
      ...outcome.winnerIds.map((userId) => addXpToUser(userId, 50)),
      ...outcome.loserIds.map((userId) => addXpToUser(userId, 10)),
    ]);
    await Promise.all([...outcome.winnerIds, ...outcome.loserIds].map((userId) => checkAndAwardAchievements(userId)));
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
    const user = await requireCurrentUser();
    const match = await prisma.match.findUnique({
      where: { id: parsedMatchId.data },
      include: {
        tournament: { select: { title: true, format: true } },
        results: { orderBy: { createdAt: "desc" }, take: 1 },
        evidence: { orderBy: { createdAt: "desc" } },
        disputes: { where: { status: "OPEN" }, select: { id: true, status: true } },
      },
    });
    if (!match) return { success: false, error: "Match not found." };

    const canAct = await userCanActInMatch(prisma, user.id, match);
    const moderatorRoles: Role[] = [Role.SUPER_ADMIN, Role.ADMIN, Role.TOURNAMENT_MANAGER, Role.MODERATOR];
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
        canSubmit: canAct && ["SCHEDULED", "READY", "LIVE"].includes(match.status),
        canConfirm: canAct && pendingResult?.submitterId !== user.id,
        canDispute: canAct && ["AWAITING_RESULT", "UNDER_REVIEW", "DISPUTED"].includes(match.status),
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
