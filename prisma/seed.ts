import { PrismaClient, TournamentFormat, TournamentStatus } from "../src/lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/velox";
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding database...");

  // 1. Seed Games
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

  for (const game of games) {
    await prisma.game.upsert({
      where: { slug: game.slug },
      update: {},
      create: game,
    });
  }

  const fc26 = await prisma.game.findUnique({ where: { slug: "fc26" } });
  const chess = await prisma.game.findUnique({ where: { slug: "chess" } });

  if (!fc26 || !chess) throw new Error("Failed to find games");

  // 2. Seed Sample Tournaments
  // VELOX FC26 Weekend Championship (Paid)
  await prisma.tournament.upsert({
    where: { slug: "velox-fc26-weekend-championship" },
    update: {},
    create: {
      title: "VELOX FC26 Weekend Championship",
      slug: "velox-fc26-weekend-championship",
      gameId: fc26.id,
      prizePool: 10000,
      entryFee: 100,
      isPaid: true,
      maxParticipants: 128,
      registrationDeadline: new Date(Date.now() + 86400000 * 2), // 2 days from now
      startDate: new Date(Date.now() + 86400000 * 3), // 3 days from now
      format: TournamentFormat.SINGLE_ELIMINATION,
      status: TournamentStatus.REGISTRATION_OPEN,
      region: "Global",
    },
  });

  // VELOX Chess Masters (Free)
  await prisma.tournament.upsert({
    where: { slug: "velox-chess-masters" },
    update: {},
    create: {
      title: "VELOX Chess Masters",
      slug: "velox-chess-masters",
      gameId: chess.id,
      prizePool: 500,
      entryFee: 0,
      isPaid: false,
      maxParticipants: 64,
      registrationDeadline: new Date(Date.now() + 86400000 * 5),
      startDate: new Date(Date.now() + 86400000 * 6),
      format: TournamentFormat.SWISS,
      status: TournamentStatus.REGISTRATION_OPEN,
      region: "Global",
    },
  });

  console.log("Database seeded successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
