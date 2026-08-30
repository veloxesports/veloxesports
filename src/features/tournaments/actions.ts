"use server";

import { prisma } from "@/lib/database/prisma";
import { TournamentStatus } from "@/lib/generated/prisma/client";

export async function getTournaments(options?: {
  gameId?: string;
  status?: TournamentStatus;
  isPaid?: boolean;
}) {
  try {
    const where: any = {};
    
    if (options?.gameId) where.gameId = options.gameId;
    if (options?.status) where.status = options.status;
    if (options?.isPaid !== undefined) where.isPaid = options.isPaid;

    const tournaments = await prisma.tournament.findMany({
      where,
      include: {
        game: true,
      },
      orderBy: {
        startDate: "asc",
      },
    });

    return { success: true, data: tournaments };
  } catch (error) {
    console.error("Error fetching tournaments:", error);
    return { success: false, error: "Failed to fetch tournaments" };
  }
}

export async function getTournamentBySlug(slug: string) {
  try {
    const tournament = await prisma.tournament.findUnique({
      where: { slug },
      include: {
        game: true,
        rules: true,
        scoringRules: true,
        prizes: {
          orderBy: { placement: "asc" }
        }
      },
    });

    if (!tournament) return { success: false, error: "Tournament not found" };

    return { success: true, data: tournament };
  } catch (error) {
    console.error("Error fetching tournament:", error);
    return { success: false, error: "Failed to fetch tournament" };
  }
}

export async function getGames() {
  try {
    const games = await prisma.game.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    });
    return { success: true, data: games };
  } catch (error) {
    console.error("Error fetching games:", error);
    return { success: false, error: "Failed to fetch games" };
  }
}

export async function registerForFreeTournament(tournamentId: string, userId: string) {
  try {
    // 1. Fetch tournament
    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: { isPaid: true, status: true, maxParticipants: true, currentParticipants: true }
    });

    if (!tournament) return { success: false, error: "Tournament not found" };
    if (tournament.isPaid) return { success: false, error: "This is a paid tournament" };
    if (tournament.status !== "REGISTRATION_OPEN") return { success: false, error: "Registration is not open" };
    if (tournament.currentParticipants >= tournament.maxParticipants) return { success: false, error: "Tournament is full" };

    // 2. Perform transaction to ensure no oversell
    const result = await prisma.$transaction(async (tx) => {
      // Check for existing registration
      const existing = await tx.tournamentRegistration.findUnique({
        where: {
          tournamentId_userId: { tournamentId, userId }
        }
      });
      
      if (existing) throw new Error("ALREADY_REGISTERED");

      // Check capacity with locking (in a real scenario, use raw query with FOR UPDATE or rely on constraints)
      const t = await tx.tournament.findUnique({
        where: { id: tournamentId }
      });
      if (!t || t.currentParticipants >= t.maxParticipants) throw new Error("FULL");

      // Register and update count
      const registration = await tx.tournamentRegistration.create({
        data: {
          tournamentId,
          userId,
          status: "CONFIRMED"
        }
      });

      await tx.tournament.update({
        where: { id: tournamentId },
        data: { currentParticipants: { increment: 1 } }
      });

      return registration;
    });

    return { success: true, data: result };
  } catch (error: any) {
    console.error("Registration error:", error);
    if (error.message === "ALREADY_REGISTERED") return { success: false, error: "You are already registered" };
    if (error.message === "FULL") return { success: false, error: "Tournament is full" };
    return { success: false, error: "Failed to register" };
  }
}
