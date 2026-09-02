import type { Prisma } from "@/lib/generated/prisma/client";
import { TournamentParticipantType } from "@/lib/generated/prisma/client";
import { hasBothMatchParticipants, nextBracketSlotForWinner } from "@/lib/matches/flow";

type MatchForAdvancement = {
  id: string;
  tournamentId: string;
  round: number;
  bracketPosition: number | null;
  player1Id: string | null;
  player2Id: string | null;
  team1Id: string | null;
  team2Id: string | null;
};

async function advanceSingleEliminationWinner(tx: Prisma.TransactionClient, match: MatchForAdvancement, winnerId: string) {
  if (match.bracketPosition === null) return;
  const slot = nextBracketSlotForWinner(match, winnerId);
  if (!slot) return;

  const nextMatch = await tx.match.findFirst({
    where: {
      tournamentId: match.tournamentId,
      round: match.round + 1,
      bracketPosition: Math.floor(match.bracketPosition / 2),
    },
  });
  if (!nextMatch) return;

  const existingParticipant = nextMatch[slot];
  if (existingParticipant && existingParticipant !== winnerId) throw new Error("BRACKET_CONFLICT");
  if (existingParticipant === winnerId) return;

  const tournament = await tx.tournament.findUnique({ where: { id: match.tournamentId }, select: { status: true } });
  const nextParticipants = { ...nextMatch, [slot]: winnerId };
  await tx.match.update({
    where: { id: nextMatch.id },
    data: {
      [slot]: winnerId,
      status: nextMatch.status === "CANCELLED"
        ? "CANCELLED"
        : tournament?.status === "LIVE" && hasBothMatchParticipants(nextParticipants)
          ? "LIVE"
          : "SCHEDULED",
    },
  });
}

async function settleAutomaticByes(tx: Prisma.TransactionClient, tournamentId: string) {
  const matches = await tx.match.findMany({
    where: { tournamentId, status: "COMPLETED", winnerId: { not: null }, bracketPosition: { not: null } },
    orderBy: [{ round: "asc" }, { bracketPosition: "asc" }],
  });
  for (const match of matches) await advanceSingleEliminationWinner(tx, match, match.winnerId!);

  for (let round = 2; round <= 16; round += 1) {
    const candidates = await tx.match.findMany({ where: { tournamentId, round, status: "SCHEDULED", bracketPosition: { not: null } } });
    for (const candidate of candidates) {
      const hasFirst = Boolean(candidate.player1Id || candidate.team1Id);
      const hasSecond = Boolean(candidate.player2Id || candidate.team2Id);
      if (hasFirst === hasSecond || candidate.bracketPosition === null) continue;

      const missingSource = await tx.match.findFirst({
        where: { tournamentId, round: round - 1, bracketPosition: candidate.bracketPosition * 2 + (hasFirst ? 1 : 0) },
        select: { status: true, winnerId: true },
      });
      if (!missingSource || missingSource.status !== "COMPLETED" || missingSource.winnerId) continue;

      const winnerId = hasFirst ? candidate.player1Id ?? candidate.team1Id : candidate.player2Id ?? candidate.team2Id;
      if (!winnerId) continue;
      await tx.match.update({ where: { id: candidate.id }, data: { status: "COMPLETED", winnerId } });
      await advanceSingleEliminationWinner(tx, candidate, winnerId);
    }
  }
}

/** Creates a bracket from confirmed, checked-in entries within the caller transaction. */
export async function generateSingleEliminationBracketInTransaction(tx: Prisma.TransactionClient, tournamentId: string) {
  const tournament = await tx.tournament.findUnique({
    where: { id: tournamentId },
    include: { registrations: { where: { status: "CONFIRMED", checkedIn: true }, orderBy: { createdAt: "asc" } } },
  });
  if (!tournament) throw new Error("TOURNAMENT_NOT_FOUND");
  if (tournament.status === "CHECK_IN") throw new Error("CHECK_IN_NOT_LOCKED");
  if (tournament.status !== "UPCOMING") throw new Error("CHECK_IN_REQUIRED");
  if (tournament.format !== "SINGLE_ELIMINATION") throw new Error("UNSUPPORTED_FORMAT");

  const existingMatches = await tx.match.count({ where: { tournamentId: tournament.id } });
  if (existingMatches > 0) throw new Error("BRACKET_EXISTS");
  if (tournament.registrations.length < 2) throw new Error("NOT_ENOUGH_PARTICIPANTS");

  const usesTeams = tournament.participantType === TournamentParticipantType.TEAM;
  const participants = tournament.registrations.map((registration) => usesTeams ? registration.teamId : registration.userId);
  if (participants.some((participant) => !participant)) throw new Error("TEAM_REGISTRATION_INVALID");

  const bracketSize = 2 ** Math.ceil(Math.log2(participants.length));
  const totalRounds = Math.log2(bracketSize);
  for (let round = 1; round <= totalRounds; round += 1) {
    const matchesInRound = bracketSize / 2 ** round;
    for (let bracketPosition = 0; bracketPosition < matchesInRound; bracketPosition += 1) {
      const first = round === 1 ? participants[bracketPosition * 2] ?? null : null;
      const second = round === 1 ? participants[bracketPosition * 2 + 1] ?? null : null;
      const winnerId = first && !second ? first : second && !first ? second : null;
      await tx.match.create({
        data: {
          tournamentId: tournament.id,
          round,
          bracketPosition,
          ...(usesTeams ? { team1Id: first, team2Id: second } : { player1Id: first, player2Id: second }),
          status: winnerId || (!first && !second) ? "COMPLETED" : "SCHEDULED",
          winnerId,
        },
      });
    }
  }

  await settleAutomaticByes(tx, tournament.id);
  return tournament;
}
