"use server";

import { prisma } from "@/lib/database/prisma";

export async function getGlobalLeaderboard() {
  try {
    const players = await prisma.userProfile.findMany({
      take: 50,
      orderBy: { xp: "desc" },
      include: {
        user: { select: { username: true, firstName: true, lastName: true, profileImage: true } }
      }
    });

    return { success: true, data: players };
  } catch (error) {
    console.error("Failed to fetch leaderboard", error);
    return { success: false, error: "Failed to fetch leaderboard" };
  }
}
