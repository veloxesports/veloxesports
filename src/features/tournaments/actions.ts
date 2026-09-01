"use server";

import { prisma } from "@/lib/database/prisma";
import { TournamentStatus } from "@/lib/generated/prisma/client";
import { getCurrentUser, requireCurrentUser } from "@/lib/auth/current-user";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { canCheckIn, getCheckInWindow } from "@/lib/tournaments/check-in";

const tournamentIdSchema = z.string().uuid();
const publicTournamentStatuses: TournamentStatus[] = ["REGISTRATION_OPEN", "REGISTRATION_CLOSED", "UPCOMING", "CHECK_IN", "LIVE"];

class TournamentRegistrationError extends Error {
  constructor(public code: "ALREADY_REGISTERED" | "FULL" | "REGISTRATION_CLOSED" | "PAID_TOURNAMENT") {
    super(code);
  }
}

class TournamentCheckInError extends Error {
  constructor(public code: "TOURNAMENT_NOT_FOUND" | "CHECK_IN_NOT_ACTIVE" | "CHECK_IN_NOT_STARTED" | "CHECK_IN_CLOSED" | "REGISTRATION_NOT_FOUND") {
    super(code);
  }
}

export async function getTournaments(options?: {
  gameId?: string;
  status?: TournamentStatus;
  isPaid?: boolean;
}) {
  try {
    const tournaments = await prisma.tournament.findMany({
      where: {
        ...(options?.gameId ? { gameId: options.gameId } : {}),
        status: options?.status ?? { in: publicTournamentStatuses },
        ...(options?.isPaid !== undefined ? { isPaid: options.isPaid } : {}),
      },
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

export async function getTournamentCheckInState(tournamentId: unknown) {
  const validatedTournamentId = tournamentIdSchema.safeParse(tournamentId);
  if (!validatedTournamentId.success) return { success: false as const, error: "Tournament unavailable." };

  try {
    const [user, tournament] = await Promise.all([
      getCurrentUser(),
      prisma.tournament.findUnique({
        where: { id: validatedTournamentId.data },
        select: {
          id: true,
          status: true,
          startDate: true,
          rules: { select: { checkInPeriodMins: true } },
        },
      }),
    ]);
    if (!tournament) return { success: false as const, error: "Tournament unavailable." };

    const checkInPeriodMins = tournament.rules?.checkInPeriodMins ?? 60;
    const window = getCheckInWindow(tournament.startDate, checkInPeriodMins);
    const registration = user
      ? await prisma.tournamentRegistration.findFirst({
          where: {
            tournamentId: tournament.id,
            status: "CONFIRMED",
            OR: [
              { userId: user.id },
              { team: { is: { captainId: user.id } } },
            ],
          },
          select: { id: true, checkedIn: true, team: { select: { name: true } } },
        })
      : null;

    return {
      success: true as const,
      data: {
        status: tournament.status,
        opensAt: window.opensAt,
        closesAt: window.closesAt,
        phase: window.phase,
        canCheckIn: Boolean(registration) && canCheckIn(tournament.status, tournament.startDate, checkInPeriodMins),
        requiresTelegram: !user,
        registration: registration && {
          id: registration.id,
          checkedIn: registration.checkedIn,
          teamName: registration.team?.name ?? null,
        },
      },
    };
  } catch (error) {
    console.error("Tournament check-in state fetch failed", error);
    return { success: false as const, error: "Check-in status is unavailable right now." };
  }
}

export async function checkInForTournament(tournamentId: unknown) {
  const validatedTournamentId = tournamentIdSchema.safeParse(tournamentId);
  if (!validatedTournamentId.success) return { success: false, error: "Invalid tournament." };

  try {
    const user = await requireCurrentUser();
    const result = await prisma.$transaction(async (tx) => {
      const tournament = await tx.tournament.findUnique({
        where: { id: validatedTournamentId.data },
        select: {
          id: true,
          slug: true,
          title: true,
          status: true,
          startDate: true,
          rules: { select: { checkInPeriodMins: true } },
        },
      });
      if (!tournament) throw new TournamentCheckInError("TOURNAMENT_NOT_FOUND");
      if (tournament.status !== "CHECK_IN") throw new TournamentCheckInError("CHECK_IN_NOT_ACTIVE");

      const window = getCheckInWindow(tournament.startDate, tournament.rules?.checkInPeriodMins ?? 60);
      if (window.phase === "NOT_STARTED") throw new TournamentCheckInError("CHECK_IN_NOT_STARTED");
      if (window.phase === "CLOSED") throw new TournamentCheckInError("CHECK_IN_CLOSED");

      const registration = await tx.tournamentRegistration.findFirst({
        where: {
          tournamentId: tournament.id,
          status: "CONFIRMED",
          OR: [
            { userId: user.id },
            { team: { is: { captainId: user.id } } },
          ],
        },
        select: { id: true, userId: true, teamId: true, checkedIn: true, team: { select: { name: true } } },
      });
      if (!registration) throw new TournamentCheckInError("REGISTRATION_NOT_FOUND");
      if (registration.checkedIn) return { tournament, alreadyCheckedIn: true, teamName: registration.team?.name ?? null };

      const updated = await tx.tournamentRegistration.updateMany({
        where: { id: registration.id, status: "CONFIRMED", checkedIn: false },
        data: { checkedIn: true },
      });
      if (updated.count !== 1) throw new TournamentCheckInError("CHECK_IN_CLOSED");

      const recipientIds = registration.teamId
        ? (await tx.teamMember.findMany({ where: { teamId: registration.teamId }, select: { userId: true } })).map((member) => member.userId)
        : [registration.userId];
      await tx.notification.createMany({
        data: [...new Set(recipientIds)].map((recipientId) => ({
          userId: recipientId,
          type: "TOURNAMENT",
          title: registration.team ? "Team checked in" : "Check-in confirmed",
          message: registration.team ? `${registration.team.name} is checked in for ${tournament.title}.` : `You are checked in for ${tournament.title}.`,
          metadata: { tournamentId: tournament.id },
        })),
      });

      return { tournament, alreadyCheckedIn: false, teamName: registration.team?.name ?? null };
    }, { isolationLevel: "Serializable", maxWait: 5_000, timeout: 10_000 });

    revalidatePath("/tournaments");
    revalidatePath(`/tournaments/${result.tournament.slug}`);
    revalidatePath("/profile");
    revalidatePath(`/admin/tournaments/${result.tournament.id}`);
    return { success: true, data: { alreadyCheckedIn: result.alreadyCheckedIn, teamName: result.teamName } };
  } catch (error) {
    if (error instanceof TournamentCheckInError) {
      const messages = {
        TOURNAMENT_NOT_FOUND: "Tournament not found.",
        CHECK_IN_NOT_ACTIVE: "Check-in is not open for this tournament.",
        CHECK_IN_NOT_STARTED: "Check-in has not opened yet.",
        CHECK_IN_CLOSED: "The check-in window has closed.",
        REGISTRATION_NOT_FOUND: "Only confirmed players or team captains can check in.",
      };
      return { success: false, error: messages[error.code] };
    }
    if (error instanceof Error && error.message === "UNAUTHENTICATED") return { success: false, error: "Open VELOX inside Telegram to check in." };
    console.error("Tournament check-in failed", error);
    return { success: false, error: "We couldn't complete your check-in. Please try again." };
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
