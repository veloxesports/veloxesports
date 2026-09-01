import assert from "node:assert/strict";
import { prisma } from "../src/lib/database/prisma";
import { completeTournamentIfReady, runTournamentLifecycle } from "../src/lib/tournaments/lifecycle";
import { validateTeamEntry } from "../src/lib/tournaments/team-registration";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl || !["localhost", "127.0.0.1", "::1"].includes(new URL(databaseUrl).hostname)) {
  throw new Error("This rehearsal only runs against a local PostgreSQL DATABASE_URL.");
}

const runId = `automation-${Date.now()}`;
const ids = { gameId: "", tournamentId: "", teamIds: [] as string[], userIds: [] as string[] };

async function makePlayer(index: number) {
  const user = await prisma.user.create({
    data: {
      telegramId: `${runId}-telegram-${index}`,
      username: `${runId}-player-${index}`,
      firstName: `Test ${index}`,
      profile: { create: { veloxUsername: `${runId}-player-${index}`, favoriteGames: [] } },
    },
  });
  ids.userIds.push(user.id);
  return user;
}

async function main() {
  const game = await prisma.game.create({ data: { name: `Automation Test ${runId}`, slug: runId } });
  ids.gameId = game.id;
  const [captainOne, teammateOne, captainTwo, teammateTwo] = await Promise.all([1, 2, 3, 4].map(makePlayer));

  const [teamOne, teamTwo] = await Promise.all([
    prisma.team.create({ data: { name: `${runId}-alpha`, captainId: captainOne.id } }),
    prisma.team.create({ data: { name: `${runId}-bravo`, captainId: captainTwo.id } }),
  ]);
  ids.teamIds.push(teamOne.id, teamTwo.id);
  await prisma.teamMember.createMany({
    data: [
      { teamId: teamOne.id, userId: captainOne.id, role: "CAPTAIN" },
      { teamId: teamOne.id, userId: teammateOne.id, role: "MEMBER" },
      { teamId: teamTwo.id, userId: captainTwo.id, role: "CAPTAIN" },
      { teamId: teamTwo.id, userId: teammateTwo.id, role: "MEMBER" },
    ],
  });

  const openedAt = new Date("2030-01-01T10:00:00.000Z");
  const startDate = new Date("2030-01-01T11:00:00.000Z");
  const tournament = await prisma.tournament.create({
    data: {
      title: `Automation Rehearsal ${runId}`,
      slug: `${runId}-tournament`,
      gameId: game.id,
      prizePool: 141,
      maxParticipants: 2,
      registrationDeadline: new Date(openedAt.getTime() - 1),
      startDate,
      format: "SINGLE_ELIMINATION",
      participantType: "TEAM",
      teamSize: 2,
      status: "REGISTRATION_OPEN",
      rules: { create: { content: "Automation rehearsal rules.", checkInPeriodMins: 60 } },
      prizes: { create: [{ placement: 1, amount: 101 }, { placement: 2, amount: 40 }] },
    },
  });
  ids.tournamentId = tournament.id;

  await prisma.$transaction(async (tx) => {
    const first = await validateTeamEntry(tx, tournament, captainOne.id, teamOne.id);
    await tx.tournamentRegistration.create({ data: { tournamentId: tournament.id, userId: captainOne.id, teamId: first.teamId, status: "CONFIRMED" } });
    const second = await validateTeamEntry(tx, tournament, captainTwo.id, teamTwo.id);
    await tx.tournamentRegistration.create({ data: { tournamentId: tournament.id, userId: captainTwo.id, teamId: second.teamId, status: "CONFIRMED" } });
    await tx.tournament.update({ where: { id: tournament.id }, data: { currentParticipants: 2 } });
  }, { isolationLevel: "Serializable" });

  await runTournamentLifecycle(openedAt);
  await runTournamentLifecycle(openedAt);
  assert.equal((await prisma.tournament.findUniqueOrThrow({ where: { id: tournament.id } })).status, "CHECK_IN");

  await prisma.tournamentRegistration.updateMany({ where: { tournamentId: tournament.id }, data: { checkedIn: true } });
  await runTournamentLifecycle(startDate);
  const match = await prisma.match.findFirstOrThrow({ where: { tournamentId: tournament.id } });
  assert.equal(match.team1Id, teamOne.id);
  assert.equal(match.team2Id, teamTwo.id);
  assert.equal((await prisma.tournament.findUniqueOrThrow({ where: { id: tournament.id } })).status, "LIVE");

  // Rehearse the state produced when a moderator resolves a disputed final.
  const dispute = await prisma.dispute.create({ data: { matchId: match.id, creatorId: captainTwo.id, reason: "Automation rehearsal dispute", status: "OPEN" } });
  await prisma.matchResult.create({ data: { matchId: match.id, submitterId: captainOne.id, score1: 2, score2: 1, winnerId: teamOne.id, status: "DISPUTED" } });
  await prisma.$transaction(async (tx) => {
    await tx.dispute.update({ where: { id: dispute.id }, data: { status: "RESOLVED", resolverId: captainOne.id, resolutionNotes: "Automation rehearsal resolution", resolvedAt: startDate } });
    await tx.match.update({ where: { id: match.id }, data: { status: "COMPLETED", score1: 2, score2: 1, winnerId: teamOne.id } });
    await tx.userProfile.updateMany({ where: { userId: { in: [captainOne.id, teammateOne.id] } }, data: { wins: { increment: 1 } } });
    await tx.userProfile.updateMany({ where: { userId: { in: [captainTwo.id, teammateTwo.id] } }, data: { losses: { increment: 1 } } });
  }, { isolationLevel: "Serializable" });

  const completion = await completeTournamentIfReady(tournament.id);
  assert.equal(completion.completed, true);
  assert.equal(completion.rewardCount, 4);
  const rewards = await prisma.walletTransaction.findMany({ where: { tournamentId: tournament.id, type: "PRIZE_REWARD" }, orderBy: { amount: "desc" } });
  assert.deepEqual(rewards.map((reward) => reward.amount), [51, 50, 20, 20]);
  const champions = await prisma.userProfile.findMany({ where: { userId: { in: [captainOne.id, teammateOne.id] } }, select: { tournamentWins: true } });
  assert.deepEqual(champions.map((profile) => profile.tournamentWins).sort(), [1, 1]);
  assert.equal((await prisma.tournament.findUniqueOrThrow({ where: { id: tournament.id } })).status, "COMPLETED");
  console.log("Tournament automation rehearsal passed.");
}

async function cleanup() {
  if (ids.tournamentId) await prisma.tournament.delete({ where: { id: ids.tournamentId } }).catch(() => undefined);
  if (ids.teamIds.length) await prisma.team.deleteMany({ where: { id: { in: ids.teamIds } } }).catch(() => undefined);
  if (ids.userIds.length) await prisma.user.deleteMany({ where: { id: { in: ids.userIds } } }).catch(() => undefined);
  if (ids.gameId) await prisma.game.delete({ where: { id: ids.gameId } }).catch(() => undefined);
}

main().finally(async () => {
  await cleanup();
  await prisma.$disconnect();
}).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
