"use server";

import { prisma } from "@/lib/database/prisma";
import { TournamentParticipantType, TournamentStatus } from "@/lib/generated/prisma/client";
import { getCurrentUser, requireCurrentUser } from "@/lib/auth/current-user";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { canCheckIn, getCheckInWindow } from "@/lib/tournaments/check-in";
import { teamEntryErrorMessage, validateTeamEntry } from "@/lib/tournaments/team-registration";
import { dispatchTelegramNotificationsCreatedSince } from "@/lib/notifications/delivery";

const tournamentIdSchema = z.string().uuid();
const teamRegistrationSchema = z.object({ tournamentId: z.string().uuid(), teamId: z.string().uuid() });
const publicTournamentStatuses: TournamentStatus[] = ["REGISTRATION_OPEN", "REGISTRATION_CLOSED", "UPCOMING", "CHECK_IN", "LIVE"];

class TournamentRegistrationError extends Error {
  constructor(public code: "ALREADY_REGISTERED" | "FULL" | "REGISTRATION_CLOSED" | "PAID_TOURNAMENT" | "TEAM_TOURNAMENT") {
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
    const notificationSince = new Date();
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
          telegramDeliveryEligible: true,
        })),
      });

      return { tournament, alreadyCheckedIn: false, teamName: registration.team?.name ?? null };
    }, { isolationLevel: "Serializable", maxWait: 5_000, timeout: 10_000 });
    await dispatchTelegramNotificationsCreatedSince(notificationSince);

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

export async function getEligibleTeamsForTournament(tournamentId: unknown) {
  const parsedTournamentId = tournamentIdSchema.safeParse(tournamentId);
  if (!parsedTournamentId.success) return { success: false as const, error: "Invalid tournament." };

  try {
    const user = await requireCurrentUser();
    const [tournament, teams] = await Promise.all([
      prisma.tournament.findUnique({
        where: { id: parsedTournamentId.data },
        select: { id: true, participantType: true, teamSize: true },
      }),
      prisma.team.findMany({
        where: { captainId: user.id },
        orderBy: { name: "asc" },
        include: { members: { include: { user: { select: { status: true } } } } },
      }),
    ]);
    if (!tournament) return { success: false as const, error: "Tournament not found." };
    if (tournament.participantType !== TournamentParticipantType.TEAM) {
      return { success: true as const, data: [] };
    }

    const entries = await Promise.all(teams.map(async (team) => {
      const memberIds = team.members.map((member) => member.userId);
      const conflict = memberIds.length ? await prisma.tournamentRegistration.findFirst({
        where: {
          tournamentId: tournament.id,
          status: { in: ["PENDING", "CONFIRMED"] },
          OR: [
            { userId: { in: memberIds } },
            { team: { is: { members: { some: { userId: { in: memberIds } } } } } },
          ],
        },
        select: { id: true },
      }) : null;
      const hasUnavailableMember = team.members.some((member) => member.user.status !== "ACTIVE");
      const ready = team.members.length === tournament.teamSize && !hasUnavailableMember && !conflict;
      const issue = team.members.length !== tournament.teamSize
        ? `Needs exactly ${tournament.teamSize} members`
        : hasUnavailableMember
          ? "A roster member is unavailable"
          : conflict
            ? "A roster member is already entered"
            : null;
      return { id: team.id, name: team.name, logoUrl: team.logoUrl, memberCount: team.members.length, ready, issue };
    }));

    return { success: true as const, data: entries };
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") return { success: false as const, error: "Open VELOX in Telegram to register a team." };
    console.error("Eligible team lookup failed", error);
    return { success: false as const, error: "We couldn't load your teams." };
  }
}

export async function registerForFreeTournament(tournamentId: unknown) {
  const validatedTournamentId = tournamentIdSchema.safeParse(tournamentId);
  if (!validatedTournamentId.success) return { success: false, error: "Invalid tournament." };

  try {
    const notificationSince = new Date();
    const user = await requireCurrentUser();
    const now = new Date();
    const result = await prisma.$transaction(async (tx) => {
      const tournament = await tx.tournament.findUnique({
        where: { id: validatedTournamentId.data },
        select: {
          id: true,
          title: true,
          slug: true,
          isPaid: true,
          participantType: true,
          status: true,
          maxParticipants: true,
          registrationDeadline: true,
        },
      });

      if (!tournament) throw new Error("TOURNAMENT_NOT_FOUND");
      if (tournament.isPaid) throw new TournamentRegistrationError("PAID_TOURNAMENT");
      if (tournament.participantType === TournamentParticipantType.TEAM) throw new TournamentRegistrationError("TEAM_TOURNAMENT");
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

      await tx.notification.create({
        data: {
          userId: user.id,
          type: "TOURNAMENT",
          title: "Tournament entry confirmed",
          message: `Your entry for ${tournament.title} is confirmed.`,
          metadata: { tournamentId: tournament.id, tournamentSlug: tournament.slug },
          telegramDeliveryEligible: true,
        },
      });

      return registration;
    }, { isolationLevel: "Serializable", maxWait: 5_000, timeout: 10_000 });
    await dispatchTelegramNotificationsCreatedSince(notificationSince);

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
        TEAM_TOURNAMENT: "This is a team event. Choose your captain roster before registering.",
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

export async function registerTeamForFreeTournament(input: unknown) {
  const parsed = teamRegistrationSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Choose a valid team." };

  try {
    const notificationSince = new Date();
    const user = await requireCurrentUser();
    const now = new Date();
    const registration = await prisma.$transaction(async (tx) => {
      const tournament = await tx.tournament.findUnique({
        where: { id: parsed.data.tournamentId },
        select: { id: true, title: true, slug: true, isPaid: true, participantType: true, teamSize: true, status: true, maxParticipants: true, registrationDeadline: true },
      });
      if (!tournament) throw new Error("TOURNAMENT_NOT_FOUND");
      if (tournament.isPaid) throw new TournamentRegistrationError("PAID_TOURNAMENT");
      if (tournament.status !== "REGISTRATION_OPEN" || tournament.registrationDeadline <= now) throw new TournamentRegistrationError("REGISTRATION_CLOSED");

      const team = await validateTeamEntry(tx, tournament, user.id, parsed.data.teamId);
      const created = await tx.tournamentRegistration.create({
        data: { tournamentId: tournament.id, userId: user.id, teamId: team.teamId, status: "CONFIRMED" },
      });
      const capacityUpdate = await tx.tournament.updateMany({
        where: { id: tournament.id, status: "REGISTRATION_OPEN", registrationDeadline: { gt: now }, currentParticipants: { lt: tournament.maxParticipants } },
        data: { currentParticipants: { increment: 1 } },
      });
      if (capacityUpdate.count !== 1) throw new TournamentRegistrationError("FULL");
      await tx.notification.createMany({
        data: team.memberIds.map((userId) => ({
          userId,
          type: "TEAM",
          title: "Team tournament entry confirmed",
          message: `${team.teamName} is registered for this tournament. Your captain will check in for the roster.`,
          metadata: { tournamentId: tournament.id, tournamentSlug: tournament.slug, teamId: team.teamId },
          telegramDeliveryEligible: true,
        })),
      });
      return created;
    }, { isolationLevel: "Serializable", maxWait: 5_000, timeout: 10_000 });
    await dispatchTelegramNotificationsCreatedSince(notificationSince);

    revalidatePath("/tournaments");
    revalidatePath(`/tournaments/${registration.tournamentId}`);
    revalidatePath("/teams");
    return { success: true, data: registration };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (["TEAM_EVENT_REQUIRED", "TEAM_NOT_FOUND", "NOT_TEAM_CAPTAIN", "TEAM_ROSTER_SIZE_INVALID", "TEAM_MEMBER_UNAVAILABLE", "TEAM_MEMBER_ALREADY_REGISTERED"].includes(message)) {
      return { success: false, error: teamEntryErrorMessage(message) };
    }
    if (error instanceof TournamentRegistrationError) {
      const messages = {
        ALREADY_REGISTERED: "You are already registered.",
        FULL: "Tournament is full.",
        REGISTRATION_CLOSED: "Registration is closed.",
        PAID_TOURNAMENT: "This tournament requires a Telegram Stars payment.",
        TEAM_TOURNAMENT: "Choose a captain roster for this team event.",
      };
      return { success: false, error: messages[error.code] };
    }
    if (message === "UNAUTHENTICATED") return { success: false, error: "Open VELOX in Telegram to register a team." };
    console.error("Team tournament registration failed", error);
    return { success: false, error: "We couldn't complete the team registration. Please try again." };
  }
}
