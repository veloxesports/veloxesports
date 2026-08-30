"use server";

import { prisma } from "@/lib/database/prisma";

export async function getPlayerProfile(userId: string) {
  try {
    const profile = await prisma.userProfile.findUnique({
      where: { userId },
      include: {
        user: true,
      }
    });

    if (!profile) {
      // In a real app we'd trigger creation if missing
      return { success: false, error: "Profile not found" };
    }

    const achievements = await prisma.userAchievement.findMany({
      where: { userId },
      include: { achievement: true }
    });

    return { success: true, data: { profile, achievements } };
  } catch (error) {
    console.error("Error fetching profile", error);
    return { success: false, error: "Failed to fetch profile" };
  }
}
