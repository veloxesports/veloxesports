"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/database/prisma";
import { requireRole } from "@/lib/auth/current-user";
import { Prisma, TournamentFormat, TournamentParticipantType, TournamentStatus } from "@/lib/generated/prisma/client";
import { getTournamentRulesTemplate } from "@/lib/tournaments/rule-templates";
import { getCheckInWindow } from "@/lib/tournaments/check-in";
import { generateSingleEliminationBracketInTransaction } from "@/lib/tournaments/bracket";
import { runTournamentLifecycle } from "@/lib/tournaments/lifecycle";
import { dispatchTelegramNotificationsCreatedSince } from "@/lib/notifications/delivery";
import { refundStarsPayment } from "@/features/payments/actions";

const administratorRoles = ["SUPER_ADMIN", "ADMIN"] as const;
const tournamentManagerRoles = ["SUPER_ADMIN", "ADMIN", "TOURNAMENT_MANAGER"] as const;
const financeRoles = ["SUPER_ADMIN", "ADMIN", "FINANCE_MANAGER"] as const;
const moderatorRoles = ["SUPER_ADMIN", "ADMIN", "TOURNAMENT_MANAGER", "MODERATOR"] as const;
const automatedTournamentFormat = TournamentFormat.SINGLE_ELIMINATION;
const initialTournamentStatuses = new Set<TournamentStatus>([TournamentStatus.DRAFT, TournamentStatus.REGISTRATION_OPEN]);
const manualStatusTransitions: Partial<Record<TournamentStatus, readonly TournamentStatus[]>> = {
  [TournamentStatus.DRAFT]: [TournamentStatus.REGISTRATION_OPEN],
  [TournamentStatus.REGISTRATION_OPEN]: [TournamentStatus.DRAFT, TournamentStatus.REGISTRATION_CLOSED],
};

const gameSchema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(96),
});
const gameStatusSchema = z.object({ gameId: z.string().uuid(), isActive: z.boolean() });
const tournamentFieldsSchema = z.object({
  title: z.string().trim().min(3).max(140),
  gameId: z.string().uuid(),
  prizePool: z.coerce.number().int().min(0).max(10_000_000),
  entryFee: z.coerce.number().int().min(0).max(100_000),
  isPaid: z.boolean(),
  maxParticipants: z.coerce.number().int().min(2).max(10_000),
  registrationDeadline: z.coerce.date(),
  startDate: z.coerce.date(),
  format: z.nativeEnum(TournamentFormat),
  participantType: z.nativeEnum(TournamentParticipantType).default(TournamentParticipantType.INDIVIDUAL),
  teamSize: z.coerce.number().int().min(1).max(20).default(1),
  region: z.string().trim().max(80).optional(),
  gameMode: z.string().trim().max(100).optional(),
  rules: z.string().trim().min(10).max(10_000).optional(),
  checkInPeriodMins: z.coerce.number().int().min(5).max(1_440).default(60),
});
const tournamentSchema = tournamentFieldsSchema.extend({
  status: z.nativeEnum(TournamentStatus).default(TournamentStatus.DRAFT),
}).superRefine((value, context) => {
  if (value.isPaid && value.entryFee < 1) context.addIssue({ code: "custom", path: ["entryFee"], message: "Paid tournaments must have an entry fee." });
  if (!value.isPaid && value.entryFee !== 0) context.addIssue({ code: "custom", path: ["entryFee"], message: "Free tournaments must have a zero entry fee." });
  if (value.registrationDeadline >= value.startDate) context.addIssue({ code: "custom", path: ["registrationDeadline"], message: "Registration must close before the tournament starts." });
  if (value.participantType === TournamentParticipantType.INDIVIDUAL && value.teamSize !== 1) context.addIssue({ code: "custom", path: ["teamSize"], message: "Individual tournaments must use a roster size of 1." });
  if (value.participantType === TournamentParticipantType.TEAM && value.teamSize < 2) context.addIssue({ code: "custom", path: ["teamSize"], message: "Team tournaments need at least two roster members." });
  if (value.status === "CHECK_IN") context.addIssue({ code: "custom", path: ["status"], message: "Create the tournament first, then open its check-in window when it is ready." });
  if (!initialTournamentStatuses.has(value.status)) context.addIssue({ code: "custom", path: ["status"], message: "New tournaments can start as a draft or with registration open. Check-in, brackets, and completion are controlled by the tournament lifecycle." });
  if (value.format !== automatedTournamentFormat) context.addIssue({ code: "custom", path: ["format"], message: "New events currently use single elimination so bracket generation, results, and prizes can run automatically." });
});
const tournamentUpdateSchema = tournamentFieldsSchema.extend({ tournamentId: z.string().uuid() }).superRefine((value, context) => {
  if (value.isPaid && value.entryFee < 1) context.addIssue({ code: "custom", path: ["entryFee"], message: "Paid tournaments must have an entry fee." });
  if (!value.isPaid && value.entryFee !== 0) context.addIssue({ code: "custom", path: ["entryFee"], message: "Free tournaments must have a zero entry fee." });
  if (value.registrationDeadline >= value.startDate) context.addIssue({ code: "custom", path: ["registrationDeadline"], message: "Registration must close before the tournament starts." });
  if (value.participantType === TournamentParticipantType.INDIVIDUAL && value.teamSize !== 1) context.addIssue({ code: "custom", path: ["teamSize"], message: "Individual tournaments must use a roster size of 1." });
  if (value.participantType === TournamentParticipantType.TEAM && value.teamSize < 2) context.addIssue({ code: "custom", path: ["teamSize"], message: "Team tournaments need at least two roster members." });
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
      liveMatches,
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
      prisma.match.findMany({
        where: { status: { in: ["LIVE", "AWAITING_RESULT", "UNDER_REVIEW", "DISPUTED"] } },
        select: {
          id: true,
          round: true,
          status: true,
          score1: true,
          score2: true,
          scheduledTime: true,
          player1Id: true,
          player2Id: true,
          team1Id: true,
          team2Id: true,
          tournament: { select: { id: true, title: true, game: { select: { name: true } } } },
        },
        orderBy: [{ scheduledTime: "asc" }, { updatedAt: "desc" }],
        take: 5,
      }),
    ]);

    const playerIds = [...new Set(liveMatches.flatMap((match) => [match.player1Id, match.player2Id]).filter((id): id is string => Boolean(id)))];
    const teamIds = [...new Set(liveMatches.flatMap((match) => [match.team1Id, match.team2Id]).filter((id): id is string => Boolean(id)))];
    const [matchPlayers, matchTeams] = await Promise.all([
      prisma.user.findMany({ where: { id: { in: playerIds } }, select: { id: true, username: true, firstName: true, profile: { select: { veloxUsername: true } } } }),
      prisma.team.findMany({ where: { id: { in: teamIds } }, select: { id: true, name: true } }),
    ]);
    const playerNames = new Map(matchPlayers.map((player) => [player.id, player.profile?.veloxUsername ?? player.username ?? player.firstName ?? "Player"]));
    const teamNames = new Map(matchTeams.map((team) => [team.id, team.name]));
    const participantName = (playerId: string | null, teamId: string | null) => playerId ? playerNames.get(playerId) ?? "Player" : teamId ? teamNames.get(teamId) ?? "Team" : "TBD";

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
        liveMatches: liveMatches.map((match) => ({
          id: match.id,
          tournamentId: match.tournament.id,
          tournament: match.tournament.title,
          game: match.tournament.game.name,
          round: match.round,
          status: match.status,
          scheduledTime: match.scheduledTime,
          score1: match.score1,
          score2: match.score2,
          player1: participantName(match.player1Id, match.team1Id),
          player2: participantName(match.player2Id, match.team2Id),
        })),
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
        game: { select: { id: true, name: true } },
        rules: { select: { content: true, checkInPeriodMins: true } },
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
          participantType: parsed.data.participantType,
          teamSize: parsed.data.teamSize,
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

export async function updateTournament(input: unknown) {
  const parsed = tournamentUpdateSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Enter valid tournament details." };

  try {
    const admin = await requireRole([...tournamentManagerRoles]);
    const updated = await prisma.$transaction(async (tx) => {
      const current = await tx.tournament.findUnique({
        where: { id: parsed.data.tournamentId },
        select: {
          id: true,
          slug: true,
          title: true,
          status: true,
          gameId: true,
          format: true,
          participantType: true,
          teamSize: true,
          isPaid: true,
          entryFee: true,
          maxParticipants: true,
          currentParticipants: true,
          startDate: true,
          registrationDeadline: true,
          _count: { select: { registrations: true, matches: true, payments: true, walletTransactions: true } },
        },
      });
      if (!current) throw new Error("TOURNAMENT_NOT_FOUND");
      if (["CANCELLED", "COMPLETED"].includes(current.status)) throw new Error("TOURNAMENT_FINALIZED");
      if (current.format === automatedTournamentFormat && parsed.data.format !== automatedTournamentFormat) throw new Error("UNSUPPORTED_FORMAT");
      if (parsed.data.maxParticipants < current.currentParticipants) throw new Error("CAPACITY_TOO_LOW");
      if (current.status === "REGISTRATION_OPEN" && parsed.data.registrationDeadline <= new Date()) throw new Error("REGISTRATION_DEADLINE_PASSED");

      const structuralChange = current.gameId !== parsed.data.gameId
        || current.format !== parsed.data.format
        || current.participantType !== parsed.data.participantType
        || current.teamSize !== parsed.data.teamSize
        || current.isPaid !== parsed.data.isPaid
        || current.entryFee !== parsed.data.entryFee;
      if (current._count.registrations > 0 && structuralChange) throw new Error("REGISTRATIONS_EXIST");

      const bracketChange = structuralChange
        || current.startDate.getTime() !== parsed.data.startDate.getTime()
        || current.registrationDeadline.getTime() !== parsed.data.registrationDeadline.getTime()
        || current.maxParticipants !== parsed.data.maxParticipants;
      if (current._count.matches > 0 && bracketChange) throw new Error("BRACKET_EXISTS");

      if (current.gameId !== parsed.data.gameId) {
        const game = await tx.game.findFirst({ where: { id: parsed.data.gameId, isActive: true }, select: { id: true } });
        if (!game) throw new Error("GAME_NOT_ACTIVE");
      }

      const tournament = await tx.tournament.update({
        where: { id: current.id },
        data: {
          title: parsed.data.title,
          gameId: parsed.data.gameId,
          prizePool: parsed.data.prizePool,
          entryFee: parsed.data.entryFee,
          isPaid: parsed.data.isPaid,
          maxParticipants: parsed.data.maxParticipants,
          registrationDeadline: parsed.data.registrationDeadline,
          startDate: parsed.data.startDate,
          format: parsed.data.format,
          participantType: parsed.data.participantType,
          teamSize: parsed.data.teamSize,
          region: parsed.data.region || null,
          gameMode: parsed.data.gameMode || null,
          rules: {
            upsert: {
              create: { content: parsed.data.rules ?? "Standard VELOX competitive rules apply.", checkInPeriodMins: parsed.data.checkInPeriodMins },
              update: { content: parsed.data.rules ?? "Standard VELOX competitive rules apply.", checkInPeriodMins: parsed.data.checkInPeriodMins },
            },
          },
        },
        select: { id: true, slug: true },
      });
      await tx.auditLog.create({
        data: {
          adminId: admin.id,
          action: "TOURNAMENT_UPDATED",
          entity: "Tournament",
          entityId: current.id,
          oldValue: toAuditJson({ title: current.title, gameId: current.gameId, format: current.format, participantType: current.participantType, teamSize: current.teamSize, isPaid: current.isPaid, entryFee: current.entryFee, maxParticipants: current.maxParticipants, registrationDeadline: current.registrationDeadline, startDate: current.startDate }),
          newValue: toAuditJson(parsed.data),
        },
      });
      return tournament;
    }, { isolationLevel: "Serializable", maxWait: 5_000, timeout: 15_000 });

    revalidateTournamentCheckIn(updated);
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const known: Record<string, string> = {
      TOURNAMENT_NOT_FOUND: "Tournament not found.",
      TOURNAMENT_FINALIZED: "Completed and cancelled tournaments cannot be edited.",
      CAPACITY_TOO_LOW: "Maximum participants cannot be lower than the existing participant count.",
      REGISTRATION_DEADLINE_PASSED: "An open tournament needs a future registration deadline.",
      REGISTRATIONS_EXIST: "Game, format, and payment settings lock once players have registered.",
      BRACKET_EXISTS: "Schedule, capacity, game, and format lock once a bracket exists.",
      UNSUPPORTED_FORMAT: "Automatic brackets, result progression, and prize payouts currently require single elimination.",
      GAME_NOT_ACTIVE: "Select an active game.",
      UNAUTHENTICATED: "You must be signed in.",
      FORBIDDEN: "You do not have permission to update tournaments.",
    };
    if (known[message]) return { success: false, error: known[message] };
    console.error("Tournament update failed", error);
    return { success: false, error: "We couldn't update this tournament." };
  }
}

export async function deleteTournament(tournamentId: unknown) {
  const parsed = tournamentIdSchema.safeParse(tournamentId);
  if (!parsed.success) return { success: false, error: "Invalid tournament." };

  try {
    const admin = await requireRole([...administratorRoles]);
    const deleted = await prisma.$transaction(async (tx) => {
      const tournament = await tx.tournament.findUnique({
        where: { id: parsed.data },
        select: {
          id: true,
          slug: true,
          title: true,
          status: true,
          _count: { select: { registrations: true, matches: true, payments: true, walletTransactions: true } },
        },
      });
      if (!tournament) throw new Error("TOURNAMENT_NOT_FOUND");
      if (tournament.status !== "DRAFT") throw new Error("TOURNAMENT_NOT_DRAFT");
      if (Object.values(tournament._count).some((count) => count > 0)) throw new Error("TOURNAMENT_HAS_ACTIVITY");

      await tx.auditLog.create({
        data: {
          adminId: admin.id,
          action: "TOURNAMENT_DELETED",
          entity: "Tournament",
          entityId: tournament.id,
          oldValue: toAuditJson({ title: tournament.title, status: tournament.status }),
        },
      });
      await tx.tournament.delete({ where: { id: tournament.id } });
      return tournament;
    }, { isolationLevel: "Serializable", maxWait: 5_000, timeout: 10_000 });

    revalidateTournamentCheckIn(deleted);
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const known: Record<string, string> = {
      TOURNAMENT_NOT_FOUND: "Tournament not found.",
      TOURNAMENT_NOT_DRAFT: "Only empty draft tournaments can be deleted. Cancel live or registered events instead.",
      TOURNAMENT_HAS_ACTIVITY: "This tournament has registrations, matches, or payment activity and cannot be deleted safely.",
      UNAUTHENTICATED: "You must be signed in.",
      FORBIDDEN: "Only platform administrators can delete tournaments.",
    };
    if (known[message]) return { success: false, error: known[message] };
    console.error("Tournament deletion failed", error);
    return { success: false, error: "We couldn't delete this tournament safely." };
  }
}

export async function setTournamentStatus(input: unknown) {
  const parsed = statusSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Invalid tournament status update." };
  if (parsed.data.status === "CANCELLED") return { success: false, error: "Use the cancellation workflow to protect paid registrations." };
  if (parsed.data.status === "CHECK_IN") return { success: false, error: "Use Open check-in to start a protected check-in window." };
  try {
    const admin = await requireRole([...tournamentManagerRoles]);
    const current = await prisma.tournament.findUnique({ where: { id: parsed.data.tournamentId }, select: { status: true, registrationDeadline: true, startDate: true } });
    if (!current) return { success: false, error: "Tournament not found." };
    if (current.status === parsed.data.status) return { success: true };
    if (!manualStatusTransitions[current.status]?.includes(parsed.data.status)) return { success: false, error: "Use the protected tournament controls for check-in, bracket generation, live play, and completion." };
    if (parsed.data.status === TournamentStatus.REGISTRATION_OPEN && (current.registrationDeadline <= new Date() || current.startDate <= new Date())) {
      return { success: false, error: "Set future registration and start dates before opening registration." };
    }
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
    const notificationSince = new Date();
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
            telegramDeliveryEligible: true,
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
    await dispatchTelegramNotificationsCreatedSince(notificationSince);
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
    const notificationSince = new Date();
    const admin = await requireRole([...tournamentManagerRoles]);
    const outcome = await prisma.$transaction(async (tx) => {
      const tournament = await tx.tournament.findUnique({
        where: { id: parsed.data },
        select: { id: true, slug: true, title: true, status: true, format: true, startDate: true, rules: { select: { checkInPeriodMins: true } } },
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
            telegramDeliveryEligible: true,
          })),
        });
      }

      const checkedInCount = await tx.tournamentRegistration.count({ where: { tournamentId: tournament.id, status: "CONFIRMED", checkedIn: true } });
      await tx.tournament.update({ where: { id: tournament.id }, data: { status: "UPCOMING", currentParticipants: checkedInCount } });
      const bracketGenerated = tournament.format === TournamentFormat.SINGLE_ELIMINATION && checkedInCount >= 2;
      if (bracketGenerated) await generateSingleEliminationBracketInTransaction(tx, tournament.id);
      await tx.auditLog.create({
        data: {
          adminId: admin.id,
          action: "TOURNAMENT_CHECK_IN_LOCKED",
          entity: "Tournament",
          entityId: tournament.id,
          oldValue: toAuditJson({ status: tournament.status }),
          newValue: toAuditJson({ status: "UPCOMING", checkedIn: checkedInCount, noShows: noShows.length, bracketGenerated }),
        },
      });
      return { tournament, checkedInCount, noShowCount: noShows.length, bracketGenerated };
    }, { isolationLevel: "Serializable", maxWait: 5_000, timeout: 10_000 });

    revalidateTournamentCheckIn(outcome.tournament);
    await dispatchTelegramNotificationsCreatedSince(notificationSince);
    return { success: true, data: { checkedInCount: outcome.checkedInCount, noShowCount: outcome.noShowCount, bracketGenerated: outcome.bracketGenerated } };
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

export async function runTournamentLifecycleManually() {
  try {
    const admin = await requireRole([...tournamentManagerRoles]);
    const notificationSince = new Date();
    const summary = await runTournamentLifecycle();
    const processed = summary.registrationsClosed + summary.checkInOpened + summary.noShowsLocked + summary.bracketsGenerated + summary.tournamentsStarted + summary.tournamentsCompleted + summary.prizeRewards;
    const description = processed
      ? `Closed ${summary.registrationsClosed} registration(s), opened ${summary.checkInOpened} check-in window(s), locked ${summary.noShowsLocked} no-show entry(ies), generated ${summary.bracketsGenerated} bracket(s), started ${summary.tournamentsStarted} event(s), completed ${summary.tournamentsCompleted} event(s), and issued ${summary.prizeRewards} prize reward(s).`
      : "No tournaments are due for a lifecycle step right now.";

    await prisma.auditLog.create({
      data: {
        adminId: admin.id,
        action: "TOURNAMENT_LIFECYCLE_RUN_MANUALLY",
        entity: "System",
        entityId: "tournament-lifecycle",
        newValue: toAuditJson(summary),
      },
    });

    revalidatePath("/", "layout");
    revalidatePath("/admin", "layout");
    await dispatchTelegramNotificationsCreatedSince(notificationSince);
    return {
      success: true,
      data: summary,
      warning: summary.warnings.length ? `${description} ${summary.warnings.join(" ")}` : description,
    };
  } catch (error) {
    if (error instanceof Error && ["UNAUTHENTICATED", "FORBIDDEN"].includes(error.message)) {
      return { success: false, error: "Only tournament managers can run the lifecycle manually." };
    }
    console.error("Manual tournament lifecycle run failed", error);
    return { success: false, error: "The lifecycle run did not finish. Review the tournament queue before trying again." };
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
    const notificationSince = new Date();
    const admin = await requireRole([...administratorRoles]);
    const payments = await prisma.$transaction(async (tx) => {
      const tournament = await tx.tournament.findUnique({ where: { id: parsed.data }, select: { id: true, title: true, status: true } });
      if (!tournament) throw new Error("TOURNAMENT_NOT_FOUND");
      if (tournament.status === "CANCELLED") throw new Error("TOURNAMENT_CANCELLED");
      await tx.tournament.update({ where: { id: tournament.id }, data: { status: "CANCELLED" } });
      await tx.auditLog.create({ data: { adminId: admin.id, action: "TOURNAMENT_CANCELLED", entity: "Tournament", entityId: tournament.id, oldValue: toAuditJson({ status: tournament.status }), newValue: toAuditJson({ status: "CANCELLED" }) } });
      await tx.notification.createMany({
        data: (await tx.tournamentRegistration.findMany({ where: { tournamentId: tournament.id, status: "CONFIRMED" }, select: { userId: true } })).map((registration) => ({ userId: registration.userId, type: "TOURNAMENT", title: "Tournament cancelled", message: `${tournament.title} was cancelled. Eligible paid entries are being refunded.`, metadata: { tournamentId: tournament.id }, telegramDeliveryEligible: true })),
      });
      return tx.telegramPayment.findMany({ where: { tournamentId: tournament.id, status: "COMPLETED" }, select: { id: true } });
    }, { isolationLevel: "Serializable", maxWait: 5_000, timeout: 15_000 });

    const refundResults = await Promise.all(payments.map((payment) => refundStarsPayment(payment.id)));
    const refunded = refundResults.filter((result) => result.success).length;
    revalidatePath("/tournaments");
    revalidatePath("/admin");
    revalidatePath("/admin/tournaments");
    revalidatePath("/admin/finance");
    await dispatchTelegramNotificationsCreatedSince(notificationSince);
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
    const disputes = await prisma.dispute.findMany({
      where: { status: "OPEN" },
      include: { match: { include: { tournament: { select: { title: true } } } } },
      orderBy: { createdAt: "asc" },
      take: 100,
    });
    const playerIds = [...new Set(disputes.flatMap((dispute) => [dispute.match.player1Id, dispute.match.player2Id]).filter((id): id is string => Boolean(id)))];
    const teamIds = [...new Set(disputes.flatMap((dispute) => [dispute.match.team1Id, dispute.match.team2Id]).filter((id): id is string => Boolean(id)))];
    const [players, teams] = await Promise.all([
      prisma.user.findMany({ where: { id: { in: playerIds } }, select: { id: true, username: true, firstName: true } }),
      prisma.team.findMany({ where: { id: { in: teamIds } }, select: { id: true, name: true } }),
    ]);
    const playerNames = new Map(players.map((player) => [player.id, player.username ?? player.firstName ?? "Player"]));
    const teamNames = new Map(teams.map((team) => [team.id, team.name]));

    return {
      success: true,
      data: disputes.map((dispute) => ({
        ...dispute,
        match: {
          ...dispute.match,
          participants: [
            dispute.match.player1Id ?? dispute.match.team1Id,
            dispute.match.player2Id ?? dispute.match.team2Id,
          ].filter((id): id is string => Boolean(id)).map((id) => ({ id, name: playerNames.get(id) ?? teamNames.get(id) ?? "Participant" })),
        },
      })),
    };
  } catch (error) {
    if (error instanceof Error && ["UNAUTHENTICATED", "FORBIDDEN"].includes(error.message)) return { success: false, error: "You do not have permission to review disputes." };
    console.error("Dispute fetch failed", error);
    return { success: false, error: "We couldn't load disputes." };
  }
}
