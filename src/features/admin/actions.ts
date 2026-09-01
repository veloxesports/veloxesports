"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/database/prisma";
import { requireRole } from "@/lib/auth/current-user";
import { Prisma, TournamentFormat, TournamentStatus } from "@/lib/generated/prisma/client";
import { getTournamentRulesTemplate } from "@/lib/tournaments/rule-templates";
import { getCheckInWindow } from "@/lib/tournaments/check-in";
import { refundStarsPayment } from "@/features/payments/actions";

const administratorRoles = ["SUPER_ADMIN", "ADMIN"] as const;
const tournamentManagerRoles = ["SUPER_ADMIN", "ADMIN", "TOURNAMENT_MANAGER"] as const;
const financeRoles = ["SUPER_ADMIN", "ADMIN", "FINANCE_MANAGER"] as const;
const moderatorRoles = ["SUPER_ADMIN", "ADMIN", "TOURNAMENT_MANAGER", "MODERATOR"] as const;

const gameSchema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(96),
});
const gameStatusSchema = z.object({ gameId: z.string().uuid(), isActive: z.boolean() });
const tournamentSchema = z.object({
  title: z.string().trim().min(3).max(140),
  gameId: z.string().uuid(),
  prizePool: z.coerce.number().int().min(0).max(10_000_000),
  entryFee: z.coerce.number().int().min(0).max(100_000),
  isPaid: z.boolean(),
  maxParticipants: z.coerce.number().int().min(2).max(10_000),
  registrationDeadline: z.coerce.date(),
  startDate: z.coerce.date(),
  format: z.nativeEnum(TournamentFormat),
  region: z.string().trim().max(80).optional(),
  gameMode: z.string().trim().max(100).optional(),
  rules: z.string().trim().min(10).max(10_000).optional(),
  checkInPeriodMins: z.coerce.number().int().min(5).max(1_440).default(60),
  status: z.nativeEnum(TournamentStatus).default(TournamentStatus.DRAFT),
}).superRefine((value, context) => {
  if (value.isPaid && value.entryFee < 1) context.addIssue({ code: "custom", path: ["entryFee"], message: "Paid tournaments must have an entry fee." });
  if (!value.isPaid && value.entryFee !== 0) context.addIssue({ code: "custom", path: ["entryFee"], message: "Free tournaments must have a zero entry fee." });
  if (value.registrationDeadline >= value.startDate) context.addIssue({ code: "custom", path: ["registrationDeadline"], message: "Registration must close before the tournament starts." });
  if (value.status === "CHECK_IN") context.addIssue({ code: "custom", path: ["status"], message: "Create the tournament first, then open its check-in window when it is ready." });
});
const statusSchema = z.object({ tournamentId: z.string().uuid(), status: z.nativeEnum(TournamentStatus) });
const tournamentIdSchema = z.string().uuid();
const playerModerationSchema = z.object({
  userId: z.string().uuid(),
  action: z.enum(["BAN", "UNBAN", "FREEZE", "UNFREEZE", "RESTRICT"]),
});

function toAuditJson(value: unknown) {
  return value === undefined ? Prisma.JsonNull : JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export async function createAuditLog(
  action: string,
  entity: string,
  entityId: string,
  oldValue?: unknown,
  newValue?: unknown,
) {
  try {
    const admin = await requireRole(["SUPER_ADMIN", "ADMIN", "TOURNAMENT_MANAGER", "FINANCE_MANAGER", "MODERATOR", "SUPPORT"]);
    await prisma.auditLog.create({
      data: {
        adminId: admin.id,
        action,
        entity,
        entityId,
        oldValue: toAuditJson(oldValue),
        newValue: toAuditJson(newValue),
      },
    });
    return { success: true };
  } catch (error) {
    console.error("Failed to write audit log", error);
    return { success: false };
  }
}

export async function moderatePlayerStatus(input: unknown) {
  const parsed = playerModerationSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Invalid player moderation request." };

  try {
    const admin = await requireRole(["SUPER_ADMIN"]);
    const nextStatus = moderationStatusFor(parsed.data.action);
    const actionLabel = moderationActionLabel(parsed.data.action);

    await prisma.$transaction(async (tx) => {
      const player = await tx.user.findUnique({
        where: { id: parsed.data.userId },
        select: { id: true, role: true, status: true, telegramId: true, webAdminAccount: { select: { id: true } } },
      });

      if (!player) throw new Error("PLAYER_NOT_FOUND");
      if (player.role !== "PLAYER" || player.telegramId.startsWith("web-admin:") || player.webAdminAccount) throw new Error("PROTECTED_ACCOUNT");
      if (player.status === nextStatus) throw new Error("STATUS_UNCHANGED");

      await tx.user.update({ where: { id: player.id }, data: { status: nextStatus } });
      await tx.auditLog.create({
        data: {
          adminId: admin.id,
          action: `PLAYER_${parsed.data.action}`,
          entity: "User",
          entityId: player.id,
          oldValue: toAuditJson({ status: player.status }),
          newValue: toAuditJson({ status: nextStatus }),
        },
      });
    }, { isolationLevel: "Serializable", maxWait: 5_000, timeout: 10_000 });

    revalidatePath("/admin");
    revalidatePath("/admin/insights/[metric]", "page");
    return { success: true, message: `${actionLabel} recorded for this player.` };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "PLAYER_NOT_FOUND") return { success: false, error: "Player not found." };
    if (message === "PROTECTED_ACCOUNT") return { success: false, error: "Administrative accounts cannot be moderated from the player desk." };
    if (message === "STATUS_UNCHANGED") return { success: false, error: "This player already has that access status." };
    if (["UNAUTHENTICATED", "FORBIDDEN"].includes(message)) return { success: false, error: "Only a Super Admin can change player access." };
    console.error("Player moderation failed", error);
    return { success: false, error: "We couldn't update this player's access status." };
  }
}

function moderationStatusFor(action: "BAN" | "UNBAN" | "FREEZE" | "UNFREEZE" | "RESTRICT") {
  if (action === "BAN") return "BANNED" as const;
  if (action === "FREEZE") return "SUSPENDED" as const;
  if (action === "RESTRICT") return "RESTRICTED" as const;
  return "ACTIVE" as const;
}

function moderationActionLabel(action: "BAN" | "UNBAN" | "FREEZE" | "UNFREEZE" | "RESTRICT") {
  return { BAN: "Ban", UNBAN: "Unban", FREEZE: "Freeze", UNFREEZE: "Restore", RESTRICT: "Restriction" }[action];
}

export async function getAdminStats() {
  try {
    await requireRole(["SUPER_ADMIN", "ADMIN", "TOURNAMENT_MANAGER", "FINANCE_MANAGER", "MODERATOR", "SUPPORT"]);
    const activeSince = new Date();
    activeSince.setDate(activeSince.getDate() - 30);
    const playerAccounts = { NOT: { telegramId: { startsWith: "web-admin:" } } };

    const [
      totalUsers,
      activeUsers,
      totalTournaments,
      activeTournaments,
      liveTournaments,
      pendingDisputes,
      registrations,
      pendingPayments,
      pendingTransactions,
      matchesNeedingAttention,
      paymentTotals,
      refundTotals,
      rewardTotals,
      activeEvents,
      recentTransactions,
      recentRegistrations,
      recentActivity,
      tournamentStatusCounts,
    ] = await Promise.all([
      prisma.user.count({ where: playerAccounts }),
      prisma.user.count({ where: { ...playerAccounts, status: "ACTIVE", lastLogin: { gte: activeSince } } }),
      prisma.tournament.count(),
      prisma.tournament.count({ where: { status: { in: ["REGISTRATION_OPEN", "UPCOMING", "CHECK_IN", "LIVE"] } } }),
      prisma.tournament.count({ where: { status: "LIVE" } }),
      prisma.dispute.count({ where: { status: "OPEN" } }),
      prisma.tournamentRegistration.count({ where: { status: "CONFIRMED" } }),
      prisma.telegramPayment.count({ where: { status: "PENDING" } }),
      prisma.walletTransaction.count({ where: { status: { in: ["PENDING", "PROCESSING"] } } }),
      prisma.match.count({ where: { status: { in: ["LIVE", "AWAITING_RESULT", "UNDER_REVIEW", "DISPUTED"] } } }),
      prisma.telegramPayment.aggregate({ _sum: { amount: true }, where: { status: "COMPLETED" } }),
      prisma.refund.aggregate({ _sum: { amount: true }, where: { status: "COMPLETED" } }),
      prisma.walletTransaction.aggregate({ _sum: { amount: true }, where: { type: "PRIZE_REWARD", status: "COMPLETED" } }),
      prisma.tournament.findMany({
        where: { status: { in: ["REGISTRATION_OPEN", "UPCOMING", "CHECK_IN", "LIVE"] } },
        select: {
          id: true,
          title: true,
          status: true,
          startDate: true,
          currentParticipants: true,
          maxParticipants: true,
          game: { select: { name: true } },
        },
        orderBy: { startDate: "asc" },
        take: 4,
      }),
      prisma.walletTransaction.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          amount: true,
          currency: true,
          type: true,
          status: true,
          description: true,
          createdAt: true,
          tournament: { select: { title: true } },
          wallet: {
            select: {
              user: {
                select: {
                  username: true,
                  firstName: true,
                  profile: { select: { veloxUsername: true } },
                },
              },
            },
          },
        },
      }),
      prisma.tournamentRegistration.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          status: true,
          createdAt: true,
          tournament: { select: { title: true, game: { select: { name: true } } } },
          user: {
            select: {
              username: true,
              firstName: true,
              profile: { select: { veloxUsername: true } },
            },
          },
        },
      }),
      prisma.auditLog.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          action: true,
          entity: true,
          createdAt: true,
          admin: {
            select: {
              username: true,
              firstName: true,
              profile: { select: { veloxUsername: true } },
            },
          },
        },
      }),
      prisma.tournament.groupBy({
        by: ["status"],
        _count: { _all: true },
      }),
    ]);

    return {
      success: true,
      data: {
        totalUsers,
        activeUsers,
        totalTournaments,
        activeTournaments,
        liveTournaments,
        pendingDisputes,
        registrations,
        pendingPayments,
        pendingTransactions,
        matchesNeedingAttention,
        totalPaymentStars: paymentTotals._sum.amount ?? 0,
        totalRefundStars: refundTotals._sum.amount ?? 0,
        tournamentRewardStars: rewardTotals._sum.amount ?? 0,
        activeEvents,
        recentTransactions,
        recentRegistrations,
        recentActivity,
        tournamentStatusCounts,
      },
    };
  } catch (error) {
    if (error instanceof Error && (error.message === "UNAUTHENTICATED" || error.message === "FORBIDDEN")) {
      return { success: false, error: "You do not have access to the VELOX command center." };
    }
    console.error("Failed to fetch admin stats", error);
    return { success: false, error: "Failed to fetch stats" };
  }
}

function slugify(value: string) {
  return value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 80);
}

async function uniqueTournamentSlug(title: string) {
  const base = slugify(title) || "velox-tournament";
  for (let index = 0; index < 20; index += 1) {
    const candidate = index === 0 ? base : `${base}-${index + 1}`;
    const found = await prisma.tournament.findUnique({ where: { slug: candidate }, select: { id: true } });
    if (!found) return candidate;
  }
  return `${base}-${crypto.randomUUID().slice(0, 8)}`;
}

export async function getAdminTournaments() {
  try {
    await requireRole([...tournamentManagerRoles]);
    const tournaments = await prisma.tournament.findMany({
      include: {
        game: { select: { name: true } },
        rules: { select: { checkInPeriodMins: true } },
        registrations: { where: { status: "CONFIRMED", checkedIn: true }, select: { id: true } },
        _count: { select: { registrations: true, matches: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return { success: true, data: tournaments };
  } catch (error) {
    if (error instanceof Error && ["UNAUTHENTICATED", "FORBIDDEN"].includes(error.message)) return { success: false, error: "You do not have permission to manage tournaments." };
    console.error("Admin tournament fetch failed", error);
    return { success: false, error: "We couldn't load tournaments." };
  }
}

export async function getAdminGames() {
  try {
    await requireRole([...tournamentManagerRoles]);
    return { success: true, data: await prisma.game.findMany({ orderBy: { name: "asc" } }) };
  } catch (error) {
    if (error instanceof Error && ["UNAUTHENTICATED", "FORBIDDEN"].includes(error.message)) return { success: false, error: "You do not have permission to manage games." };
    console.error("Admin game fetch failed", error);
    return { success: false, error: "We couldn't load games." };
  }
}

export async function createGame(input: unknown) {
  const parsed = gameSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Enter a valid game name and URL-safe slug." };
  try {
    const admin = await requireRole([...administratorRoles]);
    const game = await prisma.game.create({ data: parsed.data });
    await prisma.auditLog.create({ data: { adminId: admin.id, action: "GAME_CREATED", entity: "Game", entityId: game.id, newValue: toAuditJson(parsed.data) } });
    revalidatePath("/tournaments");
    revalidatePath("/admin/tournaments");
    return { success: true, data: game };
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "P2002") return { success: false, error: "A game with that name or slug already exists." };
    if (error instanceof Error && ["UNAUTHENTICATED", "FORBIDDEN"].includes(error.message)) return { success: false, error: "Only platform administrators can add games." };
    console.error("Game creation failed", error);
    return { success: false, error: "We couldn't add that game." };
  }
}

export async function setGameActive(input: unknown) {
  const parsed = gameStatusSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Invalid game update." };
  try {
    const admin = await requireRole([...administratorRoles]);
    const old = await prisma.game.findUnique({ where: { id: parsed.data.gameId }, select: { isActive: true } });
    if (!old) return { success: false, error: "Game not found." };
    await prisma.game.update({ where: { id: parsed.data.gameId }, data: { isActive: parsed.data.isActive } });
    await prisma.auditLog.create({ data: { adminId: admin.id, action: "GAME_STATUS_CHANGED", entity: "Game", entityId: parsed.data.gameId, oldValue: toAuditJson(old), newValue: toAuditJson({ isActive: parsed.data.isActive }) } });
    revalidatePath("/tournaments");
    revalidatePath("/admin/tournaments");
    return { success: true };
  } catch (error) {
    if (error instanceof Error && ["UNAUTHENTICATED", "FORBIDDEN"].includes(error.message)) return { success: false, error: "Only platform administrators can update games." };
    console.error("Game status update failed", error);
    return { success: false, error: "We couldn't update that game." };
  }
}

export async function createTournament(input: unknown) {
  const parsed = tournamentSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Enter valid tournament details." };
  try {
    const admin = await requireRole([...tournamentManagerRoles]);
    const game = await prisma.game.findFirst({ where: { id: parsed.data.gameId, isActive: true }, select: { id: true, name: true, slug: true } });
    if (!game) return { success: false, error: "Select an active game." };
    const rules = parsed.data.rules ?? getTournamentRulesTemplate(game);
    const slug = await uniqueTournamentSlug(parsed.data.title);
    const tournament = await prisma.$transaction(async (tx) => {
      const created = await tx.tournament.create({
        data: {
          title: parsed.data.title,
          slug,
          gameId: parsed.data.gameId,
          prizePool: parsed.data.prizePool,
          entryFee: parsed.data.entryFee,
          isPaid: parsed.data.isPaid,
          maxParticipants: parsed.data.maxParticipants,
          registrationDeadline: parsed.data.registrationDeadline,
          startDate: parsed.data.startDate,
          format: parsed.data.format,
          region: parsed.data.region || null,
          gameMode: parsed.data.gameMode || null,
          status: parsed.data.status,
          organizerId: admin.id,
          rules: { create: { content: rules, checkInPeriodMins: parsed.data.checkInPeriodMins } },
        },
      });
      await tx.auditLog.create({ data: { adminId: admin.id, action: "TOURNAMENT_CREATED", entity: "Tournament", entityId: created.id, newValue: toAuditJson({ ...parsed.data, rules, slug }) } });
      return created;
    });
    revalidatePath("/tournaments");
    revalidatePath("/admin");
    revalidatePath("/admin/tournaments");
    return { success: true, data: tournament };
  } catch (error) {
    if (error instanceof Error && ["UNAUTHENTICATED", "FORBIDDEN"].includes(error.message)) return { success: false, error: "You do not have permission to create tournaments." };
    console.error("Tournament creation failed", error);
    return { success: false, error: "We couldn't create this tournament." };
  }
}

export async function setTournamentStatus(input: unknown) {
  const parsed = statusSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Invalid tournament status update." };
  if (parsed.data.status === "CANCELLED") return { success: false, error: "Use the cancellation workflow to protect paid registrations." };
  if (parsed.data.status === "CHECK_IN") return { success: false, error: "Use Open check-in to start a protected check-in window." };
  try {
    const admin = await requireRole([...tournamentManagerRoles]);
    const current = await prisma.tournament.findUnique({ where: { id: parsed.data.tournamentId }, select: { status: true } });
    if (!current) return { success: false, error: "Tournament not found." };
    if (current.status === "CHECK_IN" && parsed.data.status === "LIVE") return { success: false, error: "Lock no-shows before starting the tournament." };
    await prisma.$transaction(async (tx) => {
      await tx.tournament.update({ where: { id: parsed.data.tournamentId }, data: { status: parsed.data.status } });
      await tx.auditLog.create({ data: { adminId: admin.id, action: "TOURNAMENT_STATUS_CHANGED", entity: "Tournament", entityId: parsed.data.tournamentId, oldValue: toAuditJson(current), newValue: toAuditJson({ status: parsed.data.status }) } });
    });
    revalidatePath("/tournaments");
    revalidatePath("/admin");
    revalidatePath("/admin/tournaments");
    return { success: true };
  } catch (error) {
    if (error instanceof Error && ["UNAUTHENTICATED", "FORBIDDEN"].includes(error.message)) return { success: false, error: "You do not have permission to update tournaments." };
    console.error("Tournament status update failed", error);
    return { success: false, error: "We couldn't update the tournament status." };
  }
}

export async function openTournamentCheckIn(tournamentId: unknown) {
  const parsed = tournamentIdSchema.safeParse(tournamentId);
  if (!parsed.success) return { success: false, error: "Invalid tournament." };

  try {
    const admin = await requireRole([...tournamentManagerRoles]);
    const tournament = await prisma.$transaction(async (tx) => {
      const current = await tx.tournament.findUnique({
        where: { id: parsed.data },
        select: { id: true, slug: true, title: true, status: true, startDate: true, rules: { select: { checkInPeriodMins: true } } },
      });
      if (!current) throw new Error("TOURNAMENT_NOT_FOUND");
      if (current.status === "CHECK_IN") throw new Error("CHECK_IN_ALREADY_OPEN");
      if (current.status !== "REGISTRATION_CLOSED") throw new Error("CHECK_IN_STATUS_INVALID");

      const window = getCheckInWindow(current.startDate, current.rules?.checkInPeriodMins ?? 60);
      if (window.phase === "NOT_STARTED") throw new Error("CHECK_IN_NOT_STARTED");
      if (window.phase === "CLOSED") throw new Error("CHECK_IN_CLOSED");

      await tx.tournament.update({ where: { id: current.id }, data: { status: "CHECK_IN" } });
      const registrations = await tx.tournamentRegistration.findMany({ where: { tournamentId: current.id, status: "CONFIRMED" }, select: { userId: true } });
      if (registrations.length) {
        await tx.notification.createMany({
          data: registrations.map((registration) => ({
            userId: registration.userId,
            type: "TOURNAMENT",
            title: "Tournament check-in is open",
            message: `Check in for ${current.title} before the tournament starts to keep your place.`,
            metadata: { tournamentId: current.id },
          })),
        });
      }
      await tx.auditLog.create({
        data: {
          adminId: admin.id,
          action: "TOURNAMENT_CHECK_IN_OPENED",
          entity: "Tournament",
          entityId: current.id,
          oldValue: toAuditJson({ status: current.status }),
          newValue: toAuditJson({ status: "CHECK_IN", opensAt: window.opensAt, closesAt: window.closesAt }),
        },
      });
      return current;
    }, { isolationLevel: "Serializable", maxWait: 5_000, timeout: 10_000 });

    revalidateTournamentCheckIn(tournament);
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const known: Record<string, string> = {
      TOURNAMENT_NOT_FOUND: "Tournament not found.",
      CHECK_IN_ALREADY_OPEN: "Check-in is already open for this tournament.",
      CHECK_IN_STATUS_INVALID: "Close registration before opening check-in.",
      CHECK_IN_NOT_STARTED: "The configured check-in window has not opened yet.",
      CHECK_IN_CLOSED: "The configured check-in window has already closed.",
      UNAUTHENTICATED: "You must be signed in.",
      FORBIDDEN: "You do not have permission to open check-in.",
    };
    if (known[message]) return { success: false, error: known[message] };
    console.error("Opening tournament check-in failed", error);
    return { success: false, error: "We couldn't open the check-in window." };
  }
}

export async function finalizeTournamentCheckIn(tournamentId: unknown) {
  const parsed = tournamentIdSchema.safeParse(tournamentId);
  if (!parsed.success) return { success: false, error: "Invalid tournament." };

  try {
    const admin = await requireRole([...tournamentManagerRoles]);
    const outcome = await prisma.$transaction(async (tx) => {
      const tournament = await tx.tournament.findUnique({
        where: { id: parsed.data },
        select: { id: true, slug: true, title: true, status: true, startDate: true, rules: { select: { checkInPeriodMins: true } } },
      });
      if (!tournament) throw new Error("TOURNAMENT_NOT_FOUND");
      if (tournament.status !== "CHECK_IN") throw new Error("CHECK_IN_NOT_ACTIVE");
      if (getCheckInWindow(tournament.startDate, tournament.rules?.checkInPeriodMins ?? 60).phase !== "CLOSED") throw new Error("CHECK_IN_STILL_OPEN");

      const noShows = await tx.tournamentRegistration.findMany({
        where: { tournamentId: tournament.id, status: "CONFIRMED", checkedIn: false },
        select: { id: true, userId: true },
      });
      if (noShows.length) {
        await tx.tournamentRegistration.updateMany({ where: { id: { in: noShows.map((registration) => registration.id) } }, data: { status: "CANCELLED" } });
        await tx.notification.createMany({
          data: noShows.map((registration) => ({
            userId: registration.userId,
            type: "TOURNAMENT",
            title: "Tournament check-in missed",
            message: `Your place in ${tournament.title} was released because check-in was not completed before the deadline.`,
            metadata: { tournamentId: tournament.id },
          })),
        });
      }

      const checkedInCount = await tx.tournamentRegistration.count({ where: { tournamentId: tournament.id, status: "CONFIRMED", checkedIn: true } });
      await tx.tournament.update({ where: { id: tournament.id }, data: { status: "UPCOMING", currentParticipants: checkedInCount } });
      await tx.auditLog.create({
        data: {
          adminId: admin.id,
          action: "TOURNAMENT_CHECK_IN_LOCKED",
          entity: "Tournament",
          entityId: tournament.id,
          oldValue: toAuditJson({ status: tournament.status }),
          newValue: toAuditJson({ status: "UPCOMING", checkedIn: checkedInCount, noShows: noShows.length }),
        },
      });
      return { tournament, checkedInCount, noShowCount: noShows.length };
    }, { isolationLevel: "Serializable", maxWait: 5_000, timeout: 10_000 });

    revalidateTournamentCheckIn(outcome.tournament);
    return { success: true, data: { checkedInCount: outcome.checkedInCount, noShowCount: outcome.noShowCount } };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const known: Record<string, string> = {
      TOURNAMENT_NOT_FOUND: "Tournament not found.",
      CHECK_IN_NOT_ACTIVE: "This tournament is not currently in its check-in phase.",
      CHECK_IN_STILL_OPEN: "The check-in window is still open. No-shows can be locked once it closes.",
      UNAUTHENTICATED: "You must be signed in.",
      FORBIDDEN: "You do not have permission to lock tournament no-shows.",
    };
    if (known[message]) return { success: false, error: known[message] };
    console.error("Finalizing tournament check-in failed", error);
    return { success: false, error: "We couldn't lock tournament no-shows safely." };
  }
}

function revalidateTournamentCheckIn(tournament: { id: string; slug: string }) {
  revalidatePath("/tournaments");
  revalidatePath(`/tournaments/${tournament.slug}`);
  revalidatePath("/admin");
  revalidatePath("/admin/tournaments");
  revalidatePath(`/admin/tournaments/${tournament.id}`);
}

export async function cancelTournamentAndRefund(tournamentId: unknown) {
  const parsed = tournamentIdSchema.safeParse(tournamentId);
  if (!parsed.success) return { success: false, error: "Invalid tournament." };
  try {
    const admin = await requireRole([...administratorRoles]);
    const payments = await prisma.$transaction(async (tx) => {
      const tournament = await tx.tournament.findUnique({ where: { id: parsed.data }, select: { id: true, title: true, status: true } });
      if (!tournament) throw new Error("TOURNAMENT_NOT_FOUND");
      if (tournament.status === "CANCELLED") throw new Error("TOURNAMENT_CANCELLED");
      await tx.tournament.update({ where: { id: tournament.id }, data: { status: "CANCELLED" } });
      await tx.auditLog.create({ data: { adminId: admin.id, action: "TOURNAMENT_CANCELLED", entity: "Tournament", entityId: tournament.id, oldValue: toAuditJson({ status: tournament.status }), newValue: toAuditJson({ status: "CANCELLED" }) } });
      await tx.notification.createMany({
        data: (await tx.tournamentRegistration.findMany({ where: { tournamentId: tournament.id, status: "CONFIRMED" }, select: { userId: true } })).map((registration) => ({ userId: registration.userId, type: "TOURNAMENT", title: "Tournament cancelled", message: `${tournament.title} was cancelled. Eligible paid entries are being refunded.`, metadata: { tournamentId: tournament.id } })),
      });
      return tx.telegramPayment.findMany({ where: { tournamentId: tournament.id, status: "COMPLETED" }, select: { id: true } });
    }, { isolationLevel: "Serializable", maxWait: 5_000, timeout: 15_000 });

    const refundResults = await Promise.all(payments.map((payment) => refundStarsPayment(payment.id)));
    const refunded = refundResults.filter((result) => result.success).length;
    revalidatePath("/tournaments");
    revalidatePath("/admin");
    revalidatePath("/admin/tournaments");
    revalidatePath("/admin/finance");
    return { success: true, data: { refunded, pending: payments.length - refunded }, warning: payments.length - refunded ? "Some refunds need finance reconciliation." : undefined };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "TOURNAMENT_NOT_FOUND") return { success: false, error: "Tournament not found." };
    if (message === "TOURNAMENT_CANCELLED") return { success: false, error: "This tournament is already cancelled." };
    if (["UNAUTHENTICATED", "FORBIDDEN"].includes(message)) return { success: false, error: "Only platform administrators can cancel and refund tournaments." };
    console.error("Tournament cancellation failed", error);
    return { success: false, error: "The tournament could not be cancelled safely." };
  }
}

export async function getAdminFinance() {
  try {
    await requireRole([...financeRoles]);
    const [payments, refunds, transactions] = await Promise.all([
      prisma.telegramPayment.findMany({ orderBy: { createdAt: "desc" }, take: 100, include: { user: { select: { telegramId: true, username: true, firstName: true } }, tournament: { select: { title: true } }, refund: true } }),
      prisma.refund.aggregate({ _sum: { amount: true }, where: { status: "COMPLETED" } }),
      prisma.telegramPayment.aggregate({ _sum: { amount: true }, where: { status: "COMPLETED" } }),
    ]);
    return { success: true, data: { payments, totalPayments: transactions._sum.amount ?? 0, totalRefunds: refunds._sum.amount ?? 0 } };
  } catch (error) {
    if (error instanceof Error && ["UNAUTHENTICATED", "FORBIDDEN"].includes(error.message)) return { success: false, error: "You do not have permission to view financial activity." };
    console.error("Finance fetch failed", error);
    return { success: false, error: "We couldn't load financial activity." };
  }
}

export async function getOpenDisputes() {
  try {
    await requireRole([...moderatorRoles]);
    return { success: true, data: await prisma.dispute.findMany({ where: { status: "OPEN" }, include: { match: { include: { tournament: { select: { title: true } } } } }, orderBy: { createdAt: "asc" }, take: 100 }) };
  } catch (error) {
    if (error instanceof Error && ["UNAUTHENTICATED", "FORBIDDEN"].includes(error.message)) return { success: false, error: "You do not have permission to review disputes." };
    console.error("Dispute fetch failed", error);
    return { success: false, error: "We couldn't load disputes." };
  }
}
