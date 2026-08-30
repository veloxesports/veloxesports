import "server-only";

import { z } from "zod";
import { prisma } from "@/lib/database/prisma";
import { Prisma, Rank } from "@/lib/generated/prisma/client";

const defaultRankThresholds = [
  { xp: 0, rank: Rank.BRONZE, level: 1 },
  { xp: 500, rank: Rank.SILVER, level: 10 },
  { xp: 1_500, rank: Rank.GOLD, level: 25 },
  { xp: 3_000, rank: Rank.PLATINUM, level: 40 },
  { xp: 5_000, rank: Rank.DIAMOND, level: 60 },
  { xp: 10_000, rank: Rank.MASTER, level: 80 },
  { xp: 20_000, rank: Rank.GRANDMASTER, level: 90 },
  { xp: 50_000, rank: Rank.LEGEND, level: 100 },
] as const;

const rankThresholdSchema = z.array(z.object({
  xp: z.number().int().min(0),
  rank: z.nativeEnum(Rank),
  level: z.number().int().min(1).max(100),
})).min(1);

const achievementCriteriaSchema = z.object({
  type: z.enum(["MATCH_WINS", "MATCHES_PLAYED", "TOURNAMENT_WINS"]),
  target: z.number().int().positive(),
});

type RankThreshold = z.infer<typeof rankThresholdSchema>[number];

async function getRankThresholds(): Promise<RankThreshold[]> {
  const configured = await prisma.systemSetting.findUnique({ where: { key: "rank_thresholds" }, select: { value: true } });
  const parsed = rankThresholdSchema.safeParse(configured?.value);
  if (!parsed.success) return [...defaultRankThresholds];
  return [...parsed.data].sort((a, b) => a.xp - b.xp);
}

function calculateRank(xp: number, thresholds: RankThreshold[]) {
  let current = thresholds[0];
  for (const threshold of thresholds) {
    if (xp < threshold.xp) break;
    current = threshold;
  }
  return current;
}

export async function addXpToUser(userId: string, amount: number) {
  if (!Number.isInteger(amount) || amount <= 0) throw new Error("INVALID_XP_AMOUNT");
  const thresholds = await getRankThresholds();

  return prisma.$transaction(async (tx) => {
    const profile = await tx.userProfile.findUnique({ where: { userId } });
    if (!profile) return null;
    const nextXp = profile.xp + amount;
    const { rank, level } = calculateRank(nextXp, thresholds);
    return tx.userProfile.update({
      where: { userId },
      data: { xp: nextXp, rank, level: Math.max(profile.level, level) },
    });
  });
}

function meetsAchievementCriteria(
  criteria: z.infer<typeof achievementCriteriaSchema>,
  profile: { wins: number; losses: number; tournamentWins: number },
) {
  switch (criteria.type) {
    case "MATCH_WINS": return profile.wins >= criteria.target;
    case "MATCHES_PLAYED": return profile.wins + profile.losses >= criteria.target;
    case "TOURNAMENT_WINS": return profile.tournamentWins >= criteria.target;
  }
}

/** Awards configured achievements exactly once and applies their server-calculated XP. */
export async function checkAndAwardAchievements(userId: string) {
  const [profile, achievements, thresholds] = await Promise.all([
    prisma.userProfile.findUnique({ where: { userId } }),
    prisma.achievement.findMany({ where: { criteria: { not: Prisma.JsonNull } } }),
    getRankThresholds(),
  ]);
  if (!profile) return [];

  const awarded: string[] = [];
  for (const achievement of achievements) {
    const criteria = achievementCriteriaSchema.safeParse(achievement.criteria);
    if (!criteria.success || !meetsAchievementCriteria(criteria.data, profile)) continue;

    const gained = await prisma.$transaction(async (tx) => {
      const existing = await tx.userAchievement.findUnique({
        where: { userId_achievementId: { userId, achievementId: achievement.id } },
        select: { id: true },
      });
      if (existing) return false;

      await tx.userAchievement.create({ data: { userId, achievementId: achievement.id } });
      if (achievement.xpReward > 0) {
        const currentProfile = await tx.userProfile.findUniqueOrThrow({ where: { userId } });
        const nextXp = currentProfile.xp + achievement.xpReward;
        const { rank, level } = calculateRank(nextXp, thresholds);
        await tx.userProfile.update({
          where: { userId },
          data: { xp: nextXp, rank, level: Math.max(currentProfile.level, level) },
        });
      }
      await tx.notification.create({
        data: {
          userId,
          type: "ACHIEVEMENT",
          title: "Achievement unlocked",
          message: `You earned ${achievement.name}${achievement.xpReward ? ` and ${achievement.xpReward} XP` : ""}.`,
          metadata: { achievementId: achievement.id },
        },
      });
      return true;
    }, { isolationLevel: "Serializable", maxWait: 5_000, timeout: 10_000 });
    if (gained) awarded.push(achievement.id);
  }
  return awarded;
}
