import { prisma } from "@/lib/database/prisma";
import type { Prisma } from "@/lib/generated/prisma/client";
import { TournamentFormat, TournamentParticipantType } from "@/lib/generated/prisma/client";
import { createLedgerTransactionInTransaction } from "@/features/wallet/services";
import { addXpToUser, checkAndAwardAchievements } from "@/features/profile/xp";
import { generateSingleEliminationBracketInTransaction } from "@/lib/tournaments/bracket";
import { getCheckInWindow } from "@/lib/tournaments/check-in";
import { splitPlacementPrize, splitPrizeAmount } from "@/lib/tournaments/prizes";

type LifecycleSummary = {
  registrationsClosed: number;
  checkInOpened: number;
  noShowsLocked: number;
  bracketsGenerated: number;
  tournamentsStarted: number;
  tournamentsCompleted: number;
  prizeRewards: number;
  warnings: string[];
};

type EntryRecipient = { userId: string; teamId: string | null };

async function recipientIdsForEntries(tx: Prisma.TransactionClient, entries: EntryRecipient[]) {
  const teamIds = [...new Set(entries.map((entry) => entry.teamId).filter((id): id is string => Boolean(id)))];
  const memberships = teamIds.length
    ? await tx.teamMember.findMany({ where: { teamId: { in: teamIds } }, select: { teamId: true, userId: true } })
    : [];
  const membersByTeam = new Map<string, string[]>();
  for (const membership of memberships) {
    const members = membersByTeam.get(membership.teamId) ?? [];
    members.push(membership.userId);
    membersByTeam.set(membership.teamId, members);
  }
  return [...new Set(entries.flatMap((entry) => entry.teamId ? membersByTeam.get(entry.teamId) ?? [] : [entry.userId]))];
}

async function closeExpiredRegistration(tournamentId: string, now: Date) {
  const updated = await prisma.tournament.updateMany({
    where: { id: tournamentId, status: "REGISTRATION_OPEN", registrationDeadline: { lte: now } },
    data: { status: "REGISTRATION_CLOSED" },
  });
  return updated.count;
}

async function openCheckInIfDue(tournamentId: string, now: Date) {
  return prisma.$transaction(async (tx) => {
    const tournament = await tx.tournament.findUnique({
      where: { id: tournamentId },
      select: { id: true, title: true, status: true, startDate: true, rules: { select: { checkInPeriodMins: true } } },
    });
    if (!tournament || tournament.status !== "REGISTRATION_CLOSED") return 0;
    const window = getCheckInWindow(tournament.startDate, tournament.rules?.checkInPeriodMins ?? 60, now);
    if (window.phase !== "OPEN") return 0;

    const opened = await tx.tournament.updateMany({ where: { id: tournament.id, status: "REGISTRATION_CLOSED" }, data: { status: "CHECK_IN" } });
    if (opened.count !== 1) return 0;
    const entries = await tx.tournamentRegistration.findMany({
      where: { tournamentId: tournament.id, status: "CONFIRMED" },
      select: { userId: true, teamId: true },
    });
    const recipients = await recipientIdsForEntries(tx, entries);
    if (recipients.length) {
      await tx.notification.createMany({
        data: recipients.map((userId) => ({
          userId,
          type: "TOURNAMENT",
          title: "Tournament check-in is open",
          message: `Check in for ${tournament.title} before the deadline to keep your place.`,
          metadata: { tournamentId: tournament.id, opensAt: window.opensAt, closesAt: window.closesAt },
          telegramDeliveryEligible: true,
        })),
      });
    }
    return 1;
  }, { isolationLevel: "Serializable", maxWait: 5_000, timeout: 15_000 });
}

async function lockNoShowsAndGenerateBracket(tournamentId: string, now: Date) {
  return prisma.$transaction(async (tx) => {
    const tournament = await tx.tournament.findUnique({
      where: { id: tournamentId },
      select: {
        id: true,
        title: true,
        status: true,
        startDate: true,
        format: true,
        rules: { select: { checkInPeriodMins: true } },
      },
    });
    if (!tournament || !["REGISTRATION_CLOSED", "CHECK_IN"].includes(tournament.status)) return { locked: 0, bracket: 0 };
    if (getCheckInWindow(tournament.startDate, tournament.rules?.checkInPeriodMins ?? 60, now).phase !== "CLOSED") {
      return { locked: 0, bracket: 0 };
    }

    const noShows = await tx.tournamentRegistration.findMany({
      where: { tournamentId: tournament.id, status: "CONFIRMED", checkedIn: false },
      select: { id: true, userId: true, teamId: true },
    });
    if (noShows.length) {
      await tx.tournamentRegistration.updateMany({ where: { id: { in: noShows.map((entry) => entry.id) } }, data: { status: "CANCELLED" } });
      const recipients = await recipientIdsForEntries(tx, noShows);
      if (recipients.length) {
        await tx.notification.createMany({
          data: recipients.map((userId) => ({
            userId,
            type: "TOURNAMENT",
            title: "Tournament check-in missed",
            message: `Your place in ${tournament.title} was released because check-in was not completed in time.`,
            metadata: { tournamentId: tournament.id },
            telegramDeliveryEligible: true,
          })),
        });
      }
    }

    const checkedInCount = await tx.tournamentRegistration.count({ where: { tournamentId: tournament.id, status: "CONFIRMED", checkedIn: true } });
    await tx.tournament.update({ where: { id: tournament.id }, data: { status: "UPCOMING", currentParticipants: checkedInCount } });

    const checkedInEntries = await tx.tournamentRegistration.findMany({
      where: { tournamentId: tournament.id, status: "CONFIRMED", checkedIn: true },
      select: { userId: true, teamId: true },
    });
    const checkedInRecipients = await recipientIdsForEntries(tx, checkedInEntries);
    if (checkedInRecipients.length) {
      await tx.notification.createMany({
        data: checkedInRecipients.map((userId) => ({
          userId,
          type: "TOURNAMENT",
          title: "Check-in closed",
          message: `${tournament.title} check-in is locked. Your confirmed entry is being placed into the bracket.`,
          metadata: { tournamentId: tournament.id },
          telegramDeliveryEligible: true,
        })),
      });
    }

    if (tournament.format !== TournamentFormat.SINGLE_ELIMINATION || checkedInCount < 2) {
      return { locked: noShows.length, bracket: 0 };
    }
    await generateSingleEliminationBracketInTransaction(tx, tournament.id);
    return { locked: noShows.length, bracket: 1 };
  }, { isolationLevel: "Serializable", maxWait: 5_000, timeout: 25_000 });
}

function participantId(match: { player1Id: string | null; player2Id: string | null; team1Id: string | null; team2Id: string | null }, side: 1 | 2) {
  return side === 1 ? match.player1Id ?? match.team1Id : match.player2Id ?? match.team2Id;
}

function losingParticipantId(match: { player1Id: string | null; player2Id: string | null; team1Id: string | null; team2Id: string | null; winnerId: string | null }) {
  const first = participantId(match, 1);
  const second = participantId(match, 2);
  if (!match.winnerId || !first || !second) return null;
  return match.winnerId === first ? second : match.winnerId === second ? first : null;
}

async function playerIdsForEntity(tx: Prisma.TransactionClient, entityId: string, isTeamTournament: boolean) {
  if (!isTeamTournament) return [entityId];
  const members = await tx.teamMember.findMany({
    where: { teamId: entityId },
    select: { userId: true, role: true },
    orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
  });
  return members.map((member) => member.userId);
}

/** Completes an event at most once after its final match has a winner. */
export async function completeTournamentIfReady(tournamentId: string) {
  const completion = await prisma.$transaction(async (tx) => {
    const tournament = await tx.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        prizes: { orderBy: { placement: "asc" } },
        matches: { orderBy: [{ round: "desc" }, { bracketPosition: "asc" }] },
      },
    });
    if (!tournament || !["UPCOMING", "LIVE"].includes(tournament.status) || tournament.format !== TournamentFormat.SINGLE_ELIMINATION) {
      return { completed: false, rewardCount: 0, winnerIds: [] as string[] };
    }
    const finalRound = tournament.matches.reduce((highest, match) => Math.max(highest, match.round), 0);
    const final = tournament.matches.find((match) => match.round === finalRound && match.status === "COMPLETED" && match.winnerId);
    if (!final?.winnerId) return { completed: false, rewardCount: 0, winnerIds: [] as string[] };

    const transitioned = await tx.tournament.updateMany({
      where: { id: tournament.id, status: { in: ["UPCOMING", "LIVE"] } },
      data: { status: "COMPLETED" },
    });
    if (transitioned.count !== 1) return { completed: false, rewardCount: 0, winnerIds: [] as string[] };

    const placements = new Map<number, string[]>();
    placements.set(1, [final.winnerId]);
    const runnerUp = losingParticipantId(final);
    if (runnerUp) placements.set(2, [runnerUp]);
    const semifinalists = tournament.matches
      .filter((match) => match.round === finalRound - 1 && match.status === "COMPLETED")
      .map(losingParticipantId)
      .filter((entityId): entityId is string => Boolean(entityId));
    if (semifinalists.length) placements.set(3, semifinalists);

    const prizeAmounts = tournament.prizes.length
      ? new Map(tournament.prizes.map((prize) => [prize.placement, prize.amount]))
      : new Map([[1, tournament.prizePool]]);
    const winnerIds = await playerIdsForEntity(tx, final.winnerId, tournament.participantType === TournamentParticipantType.TEAM);
    if (winnerIds.length) await tx.userProfile.updateMany({ where: { userId: { in: winnerIds } }, data: { tournamentWins: { increment: 1 } } });

    let rewardCount = 0;
    for (const [placement, total] of prizeAmounts) {
      const entities = placements.get(placement) ?? [];
      for (const entityAward of splitPlacementPrize(total, entities)) {
        const recipients = await playerIdsForEntity(tx, entityAward.entityId, tournament.participantType === TournamentParticipantType.TEAM);
        for (const payout of splitPrizeAmount(entityAward.amount, recipients)) {
          if (payout.amount <= 0) continue;
          await createLedgerTransactionInTransaction(tx, {
            userId: payout.userId,
            amount: payout.amount,
            type: "PRIZE_REWARD",
            status: "COMPLETED",
            tournamentId: tournament.id,
            description: `${placement === 1 ? "Champion" : `Place ${placement}`} prize for ${tournament.title}`,
          });
          await tx.notification.create({
            data: {
              userId: payout.userId,
              type: "TOURNAMENT",
              title: "Tournament prize awarded",
              message: `${placement === 1 ? "Champion" : `Place ${placement}`} reward: ${payout.amount.toLocaleString()} Telegram Stars added to your Khemora wallet.`,
              metadata: { tournamentId: tournament.id, placement, amount: payout.amount },
              telegramDeliveryEligible: true,
            },
          });
          rewardCount += 1;
        }
      }
    }

    const allParticipants = await recipientIdsForEntries(tx, await tx.tournamentRegistration.findMany({
      where: { tournamentId: tournament.id, status: "CONFIRMED" },
      select: { userId: true, teamId: true },
    }));
    if (allParticipants.length) {
      await tx.notification.createMany({
        data: allParticipants.map((userId) => ({
          userId,
          type: "TOURNAMENT",
          title: "Tournament completed",
          message: `${tournament.title} has concluded. Results and rewards are now available.`,
          metadata: { tournamentId: tournament.id, championId: final.winnerId },
          telegramDeliveryEligible: true,
        })),
      });
    }
    return { completed: true, rewardCount, winnerIds };
  }, { isolationLevel: "Serializable", maxWait: 5_000, timeout: 30_000 });

  if (completion.completed) {
    await Promise.allSettled(completion.winnerIds.flatMap((userId) => [addXpToUser(userId, 250), checkAndAwardAchievements(userId)]));
  }
  return completion;
}

export async function runTournamentLifecycle(now = new Date()): Promise<LifecycleSummary> {
  const summary: LifecycleSummary = { registrationsClosed: 0, checkInOpened: 0, noShowsLocked: 0, bracketsGenerated: 0, tournamentsStarted: 0, tournamentsCompleted: 0, prizeRewards: 0, warnings: [] };
  const registrationCandidates = await prisma.tournament.findMany({ where: { status: "REGISTRATION_OPEN", registrationDeadline: { lte: now } }, select: { id: true }, take: 100 });
  for (const candidate of registrationCandidates) summary.registrationsClosed += await closeExpiredRegistration(candidate.id, now);

  const checkInCandidates = await prisma.tournament.findMany({ where: { status: "REGISTRATION_CLOSED", startDate: { gt: now } }, select: { id: true }, take: 100 });
  for (const candidate of checkInCandidates) summary.checkInOpened += await openCheckInIfDue(candidate.id, now);

  const closingCandidates = await prisma.tournament.findMany({ where: { status: "CHECK_IN", startDate: { lte: now } }, select: { id: true }, take: 100 });
  for (const candidate of closingCandidates) {
    try {
      const outcome = await lockNoShowsAndGenerateBracket(candidate.id, now);
      summary.noShowsLocked += outcome.locked;
      summary.bracketsGenerated += outcome.bracket;
    } catch (error) {
      summary.warnings.push(`Could not generate a bracket for ${candidate.id}: ${error instanceof Error ? error.message : "unknown error"}`);
    }
  }

  // Recover safely if a scheduler run was delayed past the whole check-in
  // window: lock no-shows and build the bracket instead of leaving the event
  // stranded in registration-closed state.
  const missedCheckInCandidates = await prisma.tournament.findMany({ where: { status: "REGISTRATION_CLOSED", startDate: { lte: now } }, select: { id: true }, take: 100 });
  for (const candidate of missedCheckInCandidates) {
    try {
      const outcome = await lockNoShowsAndGenerateBracket(candidate.id, now);
      summary.noShowsLocked += outcome.locked;
      summary.bracketsGenerated += outcome.bracket;
    } catch (error) {
      summary.warnings.push(`Could not recover check-in for ${candidate.id}: ${error instanceof Error ? error.message : "unknown error"}`);
    }
  }

  const startCandidates = await prisma.tournament.findMany({
    where: { status: "UPCOMING", startDate: { lte: now }, matches: { some: {} } },
    select: { id: true },
    take: 100,
  });
  for (const candidate of startCandidates) {
    const started = await prisma.$transaction(async (tx) => {
      const updated = await tx.tournament.updateMany({ where: { id: candidate.id, status: "UPCOMING" }, data: { status: "LIVE" } });
      if (updated.count !== 1) return 0;
      await tx.match.updateMany({
        where: {
          tournamentId: candidate.id,
          status: "SCHEDULED",
          OR: [
            { player1Id: { not: null }, player2Id: { not: null } },
            { team1Id: { not: null }, team2Id: { not: null } },
          ],
        },
        data: { status: "LIVE" },
      });
      const entries = await tx.tournamentRegistration.findMany({ where: { tournamentId: candidate.id, status: "CONFIRMED", checkedIn: true }, select: { userId: true, teamId: true } });
      const recipients = await recipientIdsForEntries(tx, entries);
      if (recipients.length) {
        await tx.notification.createMany({
          data: recipients.map((userId) => ({
            userId,
            type: "TOURNAMENT",
            title: "Tournament is live",
            message: "Your tournament bracket is now live. Open Match Center to see your fixture.",
            metadata: { tournamentId: candidate.id },
            telegramDeliveryEligible: true,
          })),
        });
      }
      return 1;
    }, { isolationLevel: "Serializable", maxWait: 5_000, timeout: 15_000 });
    summary.tournamentsStarted += started;
  }

  const completionCandidates = await prisma.tournament.findMany({ where: { status: { in: ["UPCOMING", "LIVE"] }, matches: { some: { status: "COMPLETED", winnerId: { not: null } } } }, select: { id: true }, take: 100 });
  for (const candidate of completionCandidates) {
    const outcome = await completeTournamentIfReady(candidate.id);
    if (outcome.completed) {
      summary.tournamentsCompleted += 1;
      summary.prizeRewards += outcome.rewardCount;
    }
  }
  return summary;
}
