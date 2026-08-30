import { prisma } from "@/lib/database/prisma";
import { Rank } from "@/lib/generated/prisma/client";

const RANK_THRESHOLDS = [
  { xp: 0, rank: Rank.BRONZE, level: 1 },
  { xp: 500, rank: Rank.SILVER, level: 10 },
  { xp: 1500, rank: Rank.GOLD, level: 25 },
  { xp: 3000, rank: Rank.PLATINUM, level: 40 },
  { xp: 5000, rank: Rank.DIAMOND, level: 60 },
  { xp: 10000, rank: Rank.MASTER, level: 80 },
  { xp: 20000, rank: Rank.GRANDMASTER, level: 90 },
  { xp: 50000, rank: Rank.LEGEND, level: 100 },
];

function calculateRank(xp: number) {
  let currentRank = RANK_THRESHOLDS[0];
  for (const threshold of RANK_THRESHOLDS) {
    if (xp >= threshold.xp) {
      currentRank = threshold;
    } else {
      break;
    }
  }
  return currentRank;
}

export async function addXpToUser(userId: string, amount: number) {
  return prisma.$transaction(async (tx) => {
    const profile = await tx.userProfile.findUnique({ where: { userId } });
    if (!profile) return null;

    const newXp = profile.xp + amount;
    const { rank: newRank, level: newLevel } = calculateRank(newXp);

    const updatedProfile = await tx.userProfile.update({
      where: { userId },
      data: {
        xp: newXp,
        rank: newRank,
        level: newLevel > profile.level ? newLevel : profile.level // Only level up, never down for this simple system
      }
    });

    return updatedProfile;
  });
}

export async function checkAndAwardAchievements(userId: string) {
  const profile = await prisma.userProfile.findUnique({ where: { userId } });
  if (!profile) return;

  const earned = await prisma.userAchievement.findMany({ where: { userId }, select: { achievementId: true } });
  const earnedIds = new Set(earned.map(e => e.achievementId));

  const allAchievements = await prisma.achievement.findMany();
  
  for (const ach of allAchievements) {
    if (earnedIds.has(ach.id)) continue;

    let award = false;
    // Example logic
    if (ach.name === "First Victory" && profile.wins >= 1) award = true;
    if (ach.name === "100 Matches" && (profile.wins + profile.losses) >= 100) award = true;

    if (award) {
      await prisma.$transaction(async (tx) => {
        await tx.userAchievement.create({
          data: { userId, achievementId: ach.id }
        });
        
        if (ach.xpReward > 0) {
          const p = await tx.userProfile.findUnique({ where: { userId } });
          if (p) {
            const { rank, level } = calculateRank(p.xp + ach.xpReward);
            await tx.userProfile.update({
              where: { userId },
              data: { xp: { increment: ach.xpReward }, rank, level }
            });
          }
        }
      });
    }
  }
}
