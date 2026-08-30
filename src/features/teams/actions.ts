"use server";

import { prisma } from "@/lib/database/prisma";

export async function createTeam(name: string, captainId: string, logoUrl?: string) {
  try {
    const existing = await prisma.team.findUnique({ where: { name } });
    if (existing) return { success: false, error: "Team name already taken" };

    const team = await prisma.$transaction(async (tx) => {
      const newTeam = await tx.team.create({
        data: {
          name,
          captainId,
          logoUrl
        }
      });

      await tx.teamMember.create({
        data: {
          teamId: newTeam.id,
          userId: captainId,
          role: "CAPTAIN"
        }
      });

      return newTeam;
    });

    return { success: true, data: team };
  } catch (error) {
    console.error("Team creation error", error);
    return { success: false, error: "Failed to create team" };
  }
}

export async function joinTeam(teamId: string, userId: string) {
  try {
    const team = await prisma.team.findUnique({ where: { id: teamId } });
    if (!team) return { success: false, error: "Team not found" };

    const member = await prisma.teamMember.create({
      data: {
        teamId,
        userId,
        role: "MEMBER"
      }
    });

    return { success: true, data: member };
  } catch (error) {
    console.error("Join team error", error);
    return { success: false, error: "Failed to join team" };
  }
}
