"use server";

import { prisma } from "@/lib/database/prisma";
import { TournamentStatus } from "@/lib/generated/prisma/client";
import { requireCurrentUser } from "@/lib/auth/current-user";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const tournamentIdSchema = z.string().uuid();

class TournamentRegistrationError extends Error {
  constructor(public code: "ALREADY_REGISTERED" | "FULL" | "REGISTRATION_CLOSED" | "PAID_TOURNAMENT") {
    super(code);
  }
}

export async function getTournaments(options?: {
  gameId?: string;
  status?: TournamentStatus;
  isPaid?: boolean;
}) {
  try {
    const where: { gameId?: string; status?: TournamentStatus; isPaid?: boolean } = {};
    
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

export async function registerForFreeTournament(tournamentId: unknown) {
  const validatedTournamentId = tournamentIdSchema.safeParse(tournamentId);
  if (!validatedTournamentId.success) return { success: false, error: "Invalid tournament." };

  try {
    const user = await requireCurrentUser();
    const now = new Date();
    const result = await prisma.$transaction(async (tx) => {
      const tournament = await tx.tournament.findUnique({
        where: { id: validatedTournamentId.data },
        select: {
          id: true,
          isPaid: true,
          status: true,
          maxParticipants: true,
          registrationDeadline: true,
        },
      });

      if (!tournament) throw new Error("TOURNAMENT_NOT_FOUND");
      if (tournament.isPaid) throw new TournamentRegistrationError("PAID_TOURNAMENT");
      if (tournament.status !== "REGISTRATION_OPEN" || tournament.registrationDeadline <= now) {
        throw new TournamentRegistrationError("REGISTRATION_CLOSED");
      }

      const existing = await tx.tournamentRegistration.findUnique({
        where: {
          tournamentId_userId: { tournamentId: tournament.id, userId: user.id },
        },
      });
      if (existing) throw new TournamentRegistrationError("ALREADY_REGISTERED");

      const registration = await tx.tournamentRegistration.create({
        data: {
          tournamentId: tournament.id,
          userId: user.id,
          status: "CONFIRMED",
        },
      });

      const capacityUpdate = await tx.tournament.updateMany({
        where: {
          id: tournament.id,
          status: "REGISTRATION_OPEN",
          registrationDeadline: { gt: now },
          currentParticipants: { lt: tournament.maxParticipants },
        },
        data: { currentParticipants: { increment: 1 } },
      });

      if (capacityUpdate.count !== 1) throw new TournamentRegistrationError("FULL");

      return registration;
    }, { isolationLevel: "Serializable", maxWait: 5_000, timeout: 10_000 });

    revalidatePath(`/tournaments`);
    revalidatePath(`/tournaments/${result.tournamentId}`);
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof TournamentRegistrationError) {
      const messages = {
        ALREADY_REGISTERED: "You are already registered.",
        FULL: "Tournament is full.",
        REGISTRATION_CLOSED: "Registration is closed.",
        PAID_TOURNAMENT: "This tournament requires a Telegram Stars payment.",
      };
      return { success: false, error: messages[error.code] };
    }
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return { success: false, error: "Open VELOX in Telegram to register." };
    }
    console.error("Free tournament registration failed", error);
    return { success: false, error: "We couldn't complete your registration. Please try again." };
  }
}
