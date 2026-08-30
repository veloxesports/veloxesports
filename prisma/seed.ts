import { PrismaClient, Rank, Role, TournamentFormat, TournamentStatus } from "../src/lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL must be configured before seeding VELOX.");

const pool = new Pool({ connectionString });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  console.log("Seeding VELOX development data...");

  const games = [
    { name: "FC26", slug: "fc26", isActive: true },
    { name: "PUBG Mobile", slug: "pubg-mobile", isActive: true },
    { name: "Fortnite", slug: "fortnite", isActive: true },
    { name: "Free Fire", slug: "free-fire", isActive: true },
    { name: "Call of Duty Mobile", slug: "cod-mobile", isActive: true },
    { name: "Mobile Legends", slug: "mobile-legends", isActive: true },
    { name: "Valorant", slug: "valorant", isActive: true },
    { name: "Chess", slug: "chess", isActive: true },
  ];
  for (const game of games) await prisma.game.upsert({ where: { slug: game.slug }, update: { name: game.name, isActive: game.isActive }, create: game });

  const [fc26, pubg, chess] = await Promise.all([
    prisma.game.findUniqueOrThrow({ where: { slug: "fc26" } }),
    prisma.game.findUniqueOrThrow({ where: { slug: "pubg-mobile" } }),
    prisma.game.findUniqueOrThrow({ where: { slug: "chess" } }),
  ]);

  const developmentUsers = [
    { telegramId: "dev-10001", username: "shadowx_dev", firstName: "Alex", role: Role.SUPER_ADMIN, rank: Rank.GOLD, xp: 2450, level: 24, wins: 18, losses: 7, tournamentWins: 2 },
    { telegramId: "dev-10002", username: "vortex_dev", firstName: "Maya", role: Role.PLAYER, rank: Rank.SILVER, xp: 930, level: 14, wins: 9, losses: 8, tournamentWins: 0 },
    { telegramId: "dev-10003", username: "phoenix_dev", firstName: "Sam", role: Role.PLAYER, rank: Rank.GOLD, xp: 1800, level: 25, wins: 12, losses: 4, tournamentWins: 1 },
  ];
  const users = [];
  for (const seedUser of developmentUsers) {
    const user = await prisma.user.upsert({
      where: { telegramId: seedUser.telegramId },
      update: { username: seedUser.username, firstName: seedUser.firstName, role: seedUser.role },
      create: {
        telegramId: seedUser.telegramId,
        username: seedUser.username,
        firstName: seedUser.firstName,
        role: seedUser.role,
        profile: { create: { veloxUsername: seedUser.username, rank: seedUser.rank, xp: seedUser.xp, level: seedUser.level, wins: seedUser.wins, losses: seedUser.losses, tournamentWins: seedUser.tournamentWins, favoriteGames: ["FC26", "Chess"] } },
        wallet: { create: {} },
      },
      select: { id: true, telegramId: true },
    });
    await prisma.userProfile.update({ where: { userId: user.id }, data: { rank: seedUser.rank, xp: seedUser.xp, level: seedUser.level, wins: seedUser.wins, losses: seedUser.losses, tournamentWins: seedUser.tournamentWins } });
    users.push(user);
  }

  const tournamentData = [
    { title: "VELOX FC26 Weekend Championship", slug: "velox-fc26-weekend-championship", gameId: fc26.id, prizePool: 10_000, entryFee: 100, isPaid: true, maxParticipants: 128, registrationDeadline: new Date(Date.now() + 2 * 86_400_000), startDate: new Date(Date.now() + 3 * 86_400_000), format: TournamentFormat.SINGLE_ELIMINATION, status: TournamentStatus.REGISTRATION_OPEN, region: "Global", gameMode: "1v1", rules: "Check in 30 minutes before your fixture. Submit accurate results with evidence when requested.", prizes: [{ placement: 1, amount: 5_000 }, { placement: 2, amount: 3_000 }, { placement: 3, amount: 2_000 }] },
    { title: "PUBG Mobile Battle Arena", slug: "pubg-mobile-battle-arena", gameId: pubg.id, prizePool: 3_000, entryFee: 50, isPaid: true, maxParticipants: 64, registrationDeadline: new Date(Date.now() + 4 * 86_400_000), startDate: new Date(Date.now() + 5 * 86_400_000), format: TournamentFormat.BATTLE_ROYALE, status: TournamentStatus.REGISTRATION_OPEN, region: "Africa", gameMode: "Squads", rules: "Placement and kill points are published before check-in. Team captains are responsible for roster accuracy.", prizes: [{ placement: 1, amount: 1_500 }, { placement: 2, amount: 900 }, { placement: 3, amount: 600 }] },
    { title: "VELOX Chess Masters", slug: "velox-chess-masters", gameId: chess.id, prizePool: 500, entryFee: 0, isPaid: false, maxParticipants: 64, registrationDeadline: new Date(Date.now() + 5 * 86_400_000), startDate: new Date(Date.now() + 6 * 86_400_000), format: TournamentFormat.SWISS, status: TournamentStatus.REGISTRATION_OPEN, region: "Global", gameMode: "Rapid", rules: "Fair-play rules apply. Use the published match link and report issues immediately.", prizes: [{ placement: 1, amount: 300 }, { placement: 2, amount: 150 }, { placement: 3, amount: 50 }] },
  ];
  for (const data of tournamentData) {
    const { rules, prizes, ...tournamentFields } = data;
    const tournament = await prisma.tournament.upsert({
      where: { slug: tournamentFields.slug },
      update: { title: tournamentFields.title, gameId: tournamentFields.gameId, prizePool: tournamentFields.prizePool, entryFee: tournamentFields.entryFee, isPaid: tournamentFields.isPaid, maxParticipants: tournamentFields.maxParticipants, registrationDeadline: tournamentFields.registrationDeadline, startDate: tournamentFields.startDate, format: tournamentFields.format, status: tournamentFields.status, region: tournamentFields.region, gameMode: tournamentFields.gameMode },
      create: { ...tournamentFields, organizerId: users[0].id, rules: { create: { content: rules } } },
    });
    await prisma.tournamentRule.upsert({ where: { tournamentId: tournament.id }, update: { content: rules }, create: { tournamentId: tournament.id, content: rules } });
    await prisma.tournamentPrize.deleteMany({ where: { tournamentId: tournament.id } });
    await prisma.tournamentPrize.createMany({ data: prizes.map((prize) => ({ tournamentId: tournament.id, ...prize })) });
  }

  const achievements = [
    { name: "First Victory", description: "Win your first confirmed VELOX match.", iconUrl: "⚔️", xpReward: 100, criteria: { type: "MATCH_WINS", target: 1 } },
    { name: "Five Win Streak", description: "Reach five confirmed match victories.", iconUrl: "🔥", xpReward: 250, criteria: { type: "MATCH_WINS", target: 5 } },
    { name: "100 Matches", description: "Play 100 confirmed matches.", iconUrl: "💯", xpReward: 1_000, criteria: { type: "MATCHES_PLAYED", target: 100 } },
    { name: "Tournament Champion", description: "Win a VELOX tournament.", iconUrl: "🏆", xpReward: 750, criteria: { type: "TOURNAMENT_WINS", target: 1 } },
  ];
  for (const achievement of achievements) await prisma.achievement.upsert({ where: { name: achievement.name }, update: achievement, create: achievement });

  const team = await prisma.team.upsert({ where: { name: "Cyber Knights" }, update: { captainId: users[0].id }, create: { name: "Cyber Knights", captainId: users[0].id } });
  await prisma.teamMember.upsert({ where: { teamId_userId: { teamId: team.id, userId: users[0].id } }, update: { role: "CAPTAIN" }, create: { teamId: team.id, userId: users[0].id, role: "CAPTAIN" } });
  await prisma.teamMember.upsert({ where: { teamId_userId: { teamId: team.id, userId: users[1].id } }, update: {}, create: { teamId: team.id, userId: users[1].id, role: "MEMBER" } });

  await prisma.notification.upsert({
    where: { id: "00000000-0000-4000-8000-000000000001" },
    update: { message: "Development seed data is ready. No production-like payment confirmations were created." },
    create: { id: "00000000-0000-4000-8000-000000000001", userId: users[0].id, type: "SYSTEM", title: "VELOX development data ready", message: "Development seed data is ready. No production-like payment confirmations were created." },
  });

  await prisma.systemSetting.upsert({ where: { key: "rank_thresholds" }, update: {}, create: { key: "rank_thresholds", value: [
    { xp: 0, rank: "BRONZE", level: 1 }, { xp: 500, rank: "SILVER", level: 10 }, { xp: 1_500, rank: "GOLD", level: 25 }, { xp: 3_000, rank: "PLATINUM", level: 40 }, { xp: 5_000, rank: "DIAMOND", level: 60 }, { xp: 10_000, rank: "MASTER", level: 80 }, { xp: 20_000, rank: "GRANDMASTER", level: 90 }, { xp: 50_000, rank: "LEGEND", level: 100 },
  ] } });
  await prisma.systemSetting.upsert({ where: { key: "referral_reward_xtr" }, update: {}, create: { key: "referral_reward_xtr", value: 0 } });

  console.log("VELOX development data seeded without payment events.");
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => { await prisma.$disconnect(); await pool.end(); });
