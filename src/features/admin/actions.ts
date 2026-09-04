"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/database/prisma";
import { requireRole } from "@/lib/auth/current-user";
import { MatchStatus, NotificationType, PaymentStatus, Prisma, Rank, RegistrationStatus, Role, TeamRole, TournamentFormat, TournamentParticipantType, TournamentStatus, UserStatus } from "@/lib/generated/prisma/client";
import { getTournamentRulesTemplate } from "@/lib/tournaments/rule-templates";
import { getCheckInWindow } from "@/lib/tournaments/check-in";
import { generateSingleEliminationBracketInTransaction } from "@/lib/tournaments/bracket";
import { runTournamentLifecycle } from "@/lib/tournaments/lifecycle";
import { dispatchPendingTelegramNotifications, dispatchTelegramNotificationsCreatedSince } from "@/lib/notifications/delivery";
import { refundStarsPayment } from "@/features/payments/actions";

const administratorRoles = ["SUPER_ADMIN", "ADMIN"] as const;
const tournamentManagerRoles = ["SUPER_ADMIN", "ADMIN", "TOURNAMENT_MANAGER"] as const;
const financeRoles = ["SUPER_ADMIN", "ADMIN", "FINANCE_MANAGER"] as const;
const moderatorRoles = ["SUPER_ADMIN", "ADMIN", "TOURNAMENT_MANAGER", "MODERATOR"] as const;
const webAdminRoles = ["SUPER_ADMIN", "ADMIN", "TOURNAMENT_MANAGER", "FINANCE_MANAGER", "MODERATOR", "SUPPORT"] as const;
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

export async function getAdminSettings() {
  try {
    await requireRole([...administratorRoles]);
    const [settings, adminAccounts] = await Promise.all([
      prisma.systemSetting.findMany({ orderBy: { key: "asc" } }),
      prisma.webAdminAccount.findMany({
        select: {
          id: true,
          username: true,
          role: true,
          isActive: true,
          lastLoginAt: true,
          failedLoginCount: true,
          lockedUntil: true,
          createdAt: true,
        },
        orderBy: { createdAt: "asc" },
      }),
    ]);

    const systemStatus = {
      database: true,
      telegramBot: Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_WEBHOOK_SECRET),
      storage: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
      discord: Boolean(process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET),
      aiAssistant: Boolean(process.env.OPENAI_API_KEY),
      appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "Not configured",
    };

    return { success: true, data: { settings, adminAccounts, systemStatus } };
  } catch (error) {
    if (error instanceof Error && ["UNAUTHENTICATED", "FORBIDDEN"].includes(error.message)) {
      return { success: false, error: "You do not have permission to view administrator settings." };
    }
    console.error("Admin settings fetch failed", error);
    return { success: false, error: "We couldn't load administrator settings." };
  }
}

const systemSettingSchema = z.object({
  key: z.string().trim().min(1).max(64),
  value: z.unknown(),
});

export async function updateSystemSetting(input: unknown) {
  const parsed = systemSettingSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Invalid setting payload." };

  try {
    const admin = await requireRole(["SUPER_ADMIN"]);
    const setting = await prisma.systemSetting.upsert({
      where: { key: parsed.data.key },
      update: { value: parsed.data.value as Prisma.InputJsonValue },
      create: { key: parsed.data.key, value: parsed.data.value as Prisma.InputJsonValue },
    });

    await prisma.auditLog.create({
      data: {
        adminId: admin.id,
        action: "SYSTEM_SETTING_UPDATED",
        entity: "SystemSetting",
        entityId: setting.key,
        newValue: toAuditJson({ key: setting.key, value: setting.value }),
      },
    });

    revalidatePath("/admin/settings");
    return { success: true, data: setting };
  } catch (error) {
    if (error instanceof Error && ["UNAUTHENTICATED", "FORBIDDEN"].includes(error.message)) {
      return { success: false, error: "Only Super Admins can update system settings." };
    }
    console.error("Admin setting update failed", error);
    return { success: false, error: "We couldn't update that setting." };
  }
}

// ---------------------------------------------------------------------------
// Comprehensive Admin Command Center Actions
// ---------------------------------------------------------------------------

export type AdminDashboardOverviewData = {
  admin: { id: string; name: string; role: string };
  counts: {
    totalTournaments: number;
    activeTournaments: number;
    upcomingTournaments: number;
    liveTournaments: number;
    completedTournaments: number;
    draftTournaments: number;

    totalMatches: number;
    matchesToday: number;
    liveMatches: number;
    completedMatches: number;
    disputedMatches: number;
    underReviewMatches: number;
    awaitingResultMatches: number;
    matchesNeedingAttention: number;

    totalUsers: number;
    activeUsers: number;
    totalTeams: number;
    connectedDiscordUsers: number;
    discordConnectionRate: number;

    pendingDisputes: number;
    pendingRegistrations: number;
    confirmedRegistrations: number;
    pendingPayments: number;
    pendingTransactions: number;
    failedNotifications: number;

    verifiedPaymentStars: number;
    refundedStars: number;
    prizeRewardStars: number;
  };
  attentionRequired: {
    pendingDisputes: number;
    pendingRegistrations: number;
    matchesNeedingAttention: number;
    failedNotifications: number;
  };
  activeTournaments: Array<{
    id: string;
    title: string;
    slug: string;
    status: TournamentStatus;
    startDate: Date;
    currentParticipants: number;
    maxParticipants: number;
    prizePool: number;
    entryFee: number;
    isPaid: boolean;
    game: { id: string; name: string };
    _count: { registrations: number; matches: number };
  }>;
  liveMatches: Array<{
    id: string;
    tournamentId: string;
    tournamentTitle: string;
    gameName: string;
    round: number;
    status: MatchStatus;
    score1: number | null;
    score2: number | null;
    participant1: string;
    participant2: string;
    hasDispute: boolean;
    disputeReason?: string;
  }>;
  openDisputes: Array<{
    id: string;
    reason: string;
    match: {
      id: string;
      round: number;
      tournament: { id: string; title: string };
    };
  }>;
  recentRegistrations: Array<{
    id: string;
    status: RegistrationStatus;
    createdAt: Date;
    tournament: { id: string; title: string; game: { name: string } };
    user: {
      id: string;
      username: string | null;
      firstName: string | null;
      profileImage: string | null;
      profile: { veloxUsername: string | null; discordUsername: string | null } | null;
    };
    team: { id: string; name: string; logoUrl: string | null } | null;
  }>;
  recentMatches: Array<{
    id: string;
    tournamentId: string;
    tournamentTitle: string;
    gameName: string;
    round: number;
    status: MatchStatus;
    score1: number | null;
    score2: number | null;
    updatedAt: Date;
    participant1: string;
    participant2: string;
  }>;
  recentDiscordConnections: Array<{
    id: string;
    veloxUsername: string | null;
    discordUsername: string | null;
    discordDisplayName: string | null;
    discordAvatarUrl: string | null;
    discordConnected: boolean;
    discordConnectedAt: Date | null;
    user: {
      id: string;
      username: string | null;
      firstName: string | null;
      profileImage: string | null;
    };
  }>;
  recentAuditLogs: Array<{
    id: string;
    action: string;
    entity: string;
    entityId: string;
    createdAt: Date;
    admin: {
      id: string;
      username: string | null;
      firstName: string | null;
    };
  }>;
};

export type AdminMatchItem = {
  id: string;
  tournamentId: string;
  tournamentTitle: string;
  tournamentStatus: TournamentStatus;
  gameName: string;
  format: TournamentFormat;
  round: number;
  bracketPosition: number | null;
  status: MatchStatus;
  score1: number | null;
  score2: number | null;
  winnerId: string | null;
  player1Id: string | null;
  player2Id: string | null;
  team1Id: string | null;
  team2Id: string | null;
  scheduledTime: Date | null;
  createdAt: Date;
  updatedAt: Date;
  player1: {
    id: string;
    username: string | null;
    firstName: string | null;
    profileImage: string | null;
    profile: {
      veloxUsername: string | null;
      discordUsername: string | null;
      discordDisplayName: string | null;
      discordAvatarUrl: string | null;
      rank: Rank;
      level: number;
    } | null;
  } | null;
  player2: {
    id: string;
    username: string | null;
    firstName: string | null;
    profileImage: string | null;
    profile: {
      veloxUsername: string | null;
      discordUsername: string | null;
      discordDisplayName: string | null;
      discordAvatarUrl: string | null;
      rank: Rank;
      level: number;
    } | null;
  } | null;
  team1: { id: string; name: string; logoUrl: string | null } | null;
  team2: { id: string; name: string; logoUrl: string | null } | null;
  disputes: Array<{ id: string; reason: string; status: string; createdAt: Date }>;
  resultsCount: number;
  latestResult: unknown | null;
};

export type AdminPlayerItem = {
  id: string;
  telegramId: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImage: string | null;
  status: UserStatus;
  role: Role;
  createdAt: Date;
  lastLogin: Date | null;
  profile: {
    veloxUsername: string | null;
    rank: Rank;
    level: number;
    xp: number;
    country: string | null;
    wins: number;
    losses: number;
    tournamentWins: number;
    discordId: string | null;
    discordUsername: string | null;
    discordDisplayName: string | null;
    discordAvatarUrl: string | null;
    discordConnected: boolean;
    discordConnectedAt: Date | null;
  } | null;
  _count: {
    registrations: number;
    payments: number;
    teamMemberships: number;
  };
};

export type AdminTeamItem = {
  id: string;
  name: string;
  logoUrl: string | null;
  captainId: string;
  createdAt: Date;
  updatedAt: Date;
  captain: {
    id: string;
    username: string | null;
    firstName: string | null;
    profileImage: string | null;
    profile: { veloxUsername: string | null } | null;
  } | null;
  members: Array<{
    id: string;
    role: TeamRole;
    user: {
      id: string;
      username: string | null;
      firstName: string | null;
      profileImage: string | null;
      profile: {
        veloxUsername: string | null;
        rank: Rank;
        level: number;
        discordUsername: string | null;
      } | null;
    };
  }>;
  _count: {
    registrations: number;
    members: number;
    payments: number;
  };
};

export type AdminRegistrationItem = {
  id: string;
  tournamentId: string;
  userId: string;
  teamId: string | null;
  status: RegistrationStatus;
  checkedIn: boolean;
  createdAt: Date;
  tournament: {
    id: string;
    title: string;
    status: TournamentStatus;
    entryFee: number;
    isPaid: boolean;
    game: { name: string };
  };
  user: {
    id: string;
    username: string | null;
    firstName: string | null;
    profileImage: string | null;
    profile: {
      veloxUsername: string | null;
      rank: Rank;
      level: number;
      discordUsername: string | null;
      discordDisplayName: string | null;
      discordConnected: boolean;
    } | null;
  };
  team: {
    id: string;
    name: string;
    logoUrl: string | null;
  } | null;
  payment: {
    id: string;
    amount: number;
    status: PaymentStatus;
  } | null;
};

export type AdminDiscordStatsData = {
  totalUsers: number;
  totalConnected: number;
  recentConnected: number;
  unconnected: number;
  connectionRate: number;
  profiles: Array<{
    id: string;
    userId: string;
    telegramId: string;
    playerName: string;
    profileImage: string | null;
    rank: Rank;
    level: number;
    discordConnected: boolean;
    discordId: string | null;
    discordUsername: string | null;
    discordDisplayName: string | null;
    discordAvatarUrl: string | null;
    discordConnectedAt: Date | null;
  }>;
};

export type AdminNotificationsData = {
  totalCount: number;
  failedCount: number;
  notifications: Array<{
    id: string;
    title: string;
    message: string;
    type: NotificationType;
    isRead: boolean;
    telegramDeliveryEligible: boolean;
    telegramSentAt: Date | null;
    telegramDeliveryError: string | null;
    telegramDeliveryAttempts: number;
    createdAt: Date;
    user: {
      id: string;
      telegramId: string;
      name: string;
    };
  }>;
};

export async function getAdminDashboardOverview(): Promise<
  { success: true; data: AdminDashboardOverviewData } | { success: false; error: string }
> {
  try {
    const admin = await requireRole(["SUPER_ADMIN", "ADMIN", "TOURNAMENT_MANAGER", "FINANCE_MANAGER", "MODERATOR", "SUPPORT"]);
    const playerAccounts = { NOT: { telegramId: { startsWith: "web-admin:" } } };
    const now = new Date();
    const activeSince = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);

    const [
      totalTournaments,
      tournamentsByStatus,
      totalMatches,
      matchesByStatus,
      matchesToday,
      totalUsers,
      activeUsers,
      totalTeams,
      connectedDiscordUsers,
      pendingDisputes,
      pendingRegistrations,
      confirmedRegistrations,
      pendingPayments,
      pendingTransactions,
      failedNotifications,
      paymentTotals,
      refundTotals,
      rewardTotals,
      activeTournaments,
      liveMatches,
      openDisputes,
      recentRegistrations,
      recentMatches,
      recentDiscordConnections,
      recentAuditLogs,
    ] = await Promise.all([
      prisma.tournament.count(),
      prisma.tournament.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.match.count(),
      prisma.match.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.match.count({
        where: {
          scheduledTime: { gte: startOfToday, lte: endOfToday },
        },
      }),
      prisma.user.count({ where: playerAccounts }),
      prisma.user.count({ where: { ...playerAccounts, status: "ACTIVE", lastLogin: { gte: activeSince } } }),
      prisma.team.count(),
      prisma.userProfile.count({ where: { discordConnected: true } }),
      prisma.dispute.count({ where: { status: "OPEN" } }),
      prisma.tournamentRegistration.count({ where: { status: "PENDING" } }),
      prisma.tournamentRegistration.count({ where: { status: "CONFIRMED" } }),
      prisma.telegramPayment.count({ where: { status: "PENDING" } }),
      prisma.walletTransaction.count({ where: { status: { in: ["PENDING", "PROCESSING"] } } }),
      prisma.notification.count({ where: { telegramDeliveryError: { not: null } } }),
      prisma.telegramPayment.aggregate({ _sum: { amount: true }, where: { status: "COMPLETED" } }),
      prisma.refund.aggregate({ _sum: { amount: true }, where: { status: "COMPLETED" } }),
      prisma.walletTransaction.aggregate({ _sum: { amount: true }, where: { type: "PRIZE_REWARD", status: "COMPLETED" } }),
      prisma.tournament.findMany({
        where: { status: { in: ["REGISTRATION_OPEN", "UPCOMING", "CHECK_IN", "LIVE"] } },
        orderBy: { startDate: "asc" },
        take: 6,
        select: {
          id: true,
          title: true,
          slug: true,
          status: true,
          startDate: true,
          currentParticipants: true,
          maxParticipants: true,
          prizePool: true,
          entryFee: true,
          isPaid: true,
          game: { select: { id: true, name: true } },
          _count: { select: { registrations: true, matches: true } },
        },
      }),
      prisma.match.findMany({
        where: { status: { in: ["LIVE", "AWAITING_RESULT", "UNDER_REVIEW", "DISPUTED"] } },
        orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
        take: 6,
        include: {
          tournament: { select: { id: true, title: true, game: { select: { name: true } } } },
          disputes: { where: { status: "OPEN" }, select: { id: true, reason: true } },
        },
      }),
      prisma.dispute.findMany({
        where: { status: "OPEN" },
        orderBy: { createdAt: "desc" },
        take: 4,
        include: {
          match: {
            select: {
              id: true,
              round: true,
              tournament: { select: { id: true, title: true } },
            },
          },
        },
      }),
      prisma.tournamentRegistration.findMany({
        orderBy: { createdAt: "desc" },
        take: 6,
        include: {
          tournament: { select: { id: true, title: true, game: { select: { name: true } } } },
          user: {
            select: {
              id: true,
              username: true,
              firstName: true,
              profileImage: true,
              profile: { select: { veloxUsername: true, discordUsername: true } },
            },
          },
          team: { select: { id: true, name: true, logoUrl: true } },
        },
      }),
      prisma.match.findMany({
        where: { status: "COMPLETED" },
        orderBy: { updatedAt: "desc" },
        take: 6,
        include: {
          tournament: { select: { id: true, title: true, game: { select: { name: true } } } },
        },
      }),
      prisma.userProfile.findMany({
        where: { discordConnected: true, discordConnectedAt: { not: null } },
        orderBy: { discordConnectedAt: "desc" },
        take: 6,
        include: {
          user: {
            select: {
              id: true,
              username: true,
              firstName: true,
              profileImage: true,
            },
          },
        },
      }),
      prisma.auditLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 6,
        include: {
          admin: {
            select: {
              id: true,
              username: true,
              firstName: true,
            },
          },
        },
      }),
    ]);

    const participantIds = [
      ...new Set(
        [
          ...liveMatches.flatMap((m) => [m.player1Id, m.player2Id, m.team1Id, m.team2Id]),
          ...recentMatches.flatMap((m) => [m.player1Id, m.player2Id, m.team1Id, m.team2Id]),
        ].filter(Boolean) as string[]
      ),
    ];

    const [playersMap, teamsMap] = await Promise.all([
      participantIds.length > 0
        ? prisma.user.findMany({
            where: { id: { in: participantIds } },
            select: {
              id: true,
              username: true,
              firstName: true,
              profile: { select: { veloxUsername: true, discordUsername: true } },
            },
          }).then((users) => new Map(users.map((u) => [u.id, u.profile?.veloxUsername ?? u.username ?? u.firstName ?? "Player"])))
        : new Map<string, string>(),
      participantIds.length > 0
        ? prisma.team.findMany({
            where: { id: { in: participantIds } },
            select: { id: true, name: true },
          }).then((teams) => new Map(teams.map((t) => [t.id, t.name])))
        : new Map<string, string>(),
    ]);

    const formattedLiveMatches = liveMatches.map((match) => ({
      id: match.id,
      tournamentId: match.tournament.id,
      tournamentTitle: match.tournament.title,
      gameName: match.tournament.game.name,
      round: match.round,
      status: match.status,
      score1: match.score1,
      score2: match.score2,
      participant1: match.team1Id ? (teamsMap.get(match.team1Id) ?? "Team 1") : match.player1Id ? (playersMap.get(match.player1Id) ?? "Player 1") : "TBD",
      participant2: match.team2Id ? (teamsMap.get(match.team2Id) ?? "Team 2") : match.player2Id ? (playersMap.get(match.player2Id) ?? "Player 2") : "TBD",
      hasDispute: match.disputes.length > 0,
      disputeReason: match.disputes[0]?.reason,
    }));

    const formattedRecentMatches = recentMatches.map((match) => ({
      id: match.id,
      tournamentId: match.tournament.id,
      tournamentTitle: match.tournament.title,
      gameName: match.tournament.game.name,
      round: match.round,
      status: match.status,
      score1: match.score1,
      score2: match.score2,
      updatedAt: match.updatedAt,
      participant1: match.team1Id ? (teamsMap.get(match.team1Id) ?? "Team 1") : match.player1Id ? (playersMap.get(match.player1Id) ?? "Player 1") : "TBD",
      participant2: match.team2Id ? (teamsMap.get(match.team2Id) ?? "Team 2") : match.player2Id ? (playersMap.get(match.player2Id) ?? "Player 2") : "TBD",
    }));

    const statusMap = (entries: Array<{ status: string; _count: { _all: number } }>) =>
      Object.fromEntries(entries.map((e) => [e.status, e._count._all]));

    const tStatus = statusMap(tournamentsByStatus);
    const mStatus = statusMap(matchesByStatus);

    return {
      success: true as const,
      data: {
        admin: { id: admin.id, name: admin.username ?? "Admin", role: admin.role },
        counts: {
          totalTournaments,
          activeTournaments: (tStatus.REGISTRATION_OPEN ?? 0) + (tStatus.UPCOMING ?? 0) + (tStatus.CHECK_IN ?? 0) + (tStatus.LIVE ?? 0),
          upcomingTournaments: tStatus.UPCOMING ?? 0,
          liveTournaments: tStatus.LIVE ?? 0,
          completedTournaments: tStatus.COMPLETED ?? 0,
          draftTournaments: tStatus.DRAFT ?? 0,

          totalMatches,
          matchesToday,
          liveMatches: mStatus.LIVE ?? 0,
          completedMatches: mStatus.COMPLETED ?? 0,
          disputedMatches: mStatus.DISPUTED ?? 0,
          underReviewMatches: mStatus.UNDER_REVIEW ?? 0,
          awaitingResultMatches: mStatus.AWAITING_RESULT ?? 0,
          matchesNeedingAttention: (mStatus.LIVE ?? 0) + (mStatus.AWAITING_RESULT ?? 0) + (mStatus.UNDER_REVIEW ?? 0) + (mStatus.DISPUTED ?? 0),

          totalUsers,
          activeUsers,
          totalTeams,
          connectedDiscordUsers,
          discordConnectionRate: totalUsers > 0 ? Math.round((connectedDiscordUsers / totalUsers) * 100) : 0,

          pendingDisputes,
          pendingRegistrations,
          confirmedRegistrations,
          pendingPayments,
          pendingTransactions,
          failedNotifications,

          verifiedPaymentStars: paymentTotals._sum.amount ?? 0,
          refundedStars: refundTotals._sum.amount ?? 0,
          prizeRewardStars: rewardTotals._sum.amount ?? 0,
        },
        attentionRequired: {
          pendingDisputes,
          pendingRegistrations,
          matchesNeedingAttention: (mStatus.LIVE ?? 0) + (mStatus.AWAITING_RESULT ?? 0) + (mStatus.UNDER_REVIEW ?? 0) + (mStatus.DISPUTED ?? 0),
          failedNotifications,
        },
        activeTournaments,
        liveMatches: formattedLiveMatches,
        openDisputes,
        recentRegistrations,
        recentMatches: formattedRecentMatches,
        recentDiscordConnections,
        recentAuditLogs,
      },
    };
  } catch (error) {
    if (error instanceof Error && ["UNAUTHENTICATED", "FORBIDDEN"].includes(error.message)) {
      return { success: false as const, error: "Access denied." };
    }
    console.error("getAdminDashboardOverview error", error);
    return { success: false as const, error: "Failed to load admin overview." };
  }
}

// ---------------------------------------------------------------------------
// Match Operations Desk
// ---------------------------------------------------------------------------

export async function getAdminMatches(filter?: {
  tournamentId?: string;
  gameId?: string;
  status?: string;
  search?: string;
  limit?: number;
}): Promise<{ success: true; data: AdminMatchItem[] } | { success: false; error: string }> {
  try {
    await requireRole([...tournamentManagerRoles, ...moderatorRoles]);
    const where: Prisma.MatchWhereInput = {};

    if (filter?.tournamentId) where.tournamentId = filter.tournamentId;
    if (filter?.gameId) where.tournament = { gameId: filter.gameId };
    if (filter?.status && filter.status !== "ALL") {
      where.status = filter.status as MatchStatus;
    }

    const matches = await prisma.match.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      take: Math.min(Math.max(filter?.limit ?? 50, 1), 100),
      include: {
        tournament: {
          select: {
            id: true,
            title: true,
            status: true,
            format: true,
            participantType: true,
            game: { select: { id: true, name: true, slug: true } },
          },
        },
        disputes: {
          select: {
            id: true,
            reason: true,
            status: true,
            createdAt: true,
          },
        },
        results: {
          orderBy: { createdAt: "desc" },
          take: 3,
        },
      },
    });

    const userIds = [
      ...new Set(
        matches
          .flatMap((m) => [m.player1Id, m.player2Id])
          .filter(Boolean) as string[]
      ),
    ];
    const teamIds = [
      ...new Set(
        matches
          .flatMap((m) => [m.team1Id, m.team2Id])
          .filter(Boolean) as string[]
      ),
    ];

    const [players, teams] = await Promise.all([
      userIds.length > 0
        ? prisma.user.findMany({
            where: { id: { in: userIds } },
            select: {
              id: true,
              username: true,
              firstName: true,
              profileImage: true,
              profile: {
                select: {
                  veloxUsername: true,
                  discordUsername: true,
                  discordDisplayName: true,
                  discordAvatarUrl: true,
                  rank: true,
                  level: true,
                },
              },
            },
          })
        : [],
      teamIds.length > 0
        ? prisma.team.findMany({
            where: { id: { in: teamIds } },
            select: { id: true, name: true, logoUrl: true },
          })
        : [],
    ]);

    const playerMap = new Map(players.map((p) => [p.id, p]));
    const teamMap = new Map(teams.map((t) => [t.id, t]));

    const formatted = matches.map((match) => ({
      id: match.id,
      tournamentId: match.tournamentId,
      tournamentTitle: match.tournament.title,
      tournamentStatus: match.tournament.status,
      gameName: match.tournament.game.name,
      format: match.tournament.format,
      round: match.round,
      bracketPosition: match.bracketPosition,
      status: match.status,
      score1: match.score1,
      score2: match.score2,
      winnerId: match.winnerId,
      player1Id: match.player1Id,
      player2Id: match.player2Id,
      team1Id: match.team1Id,
      team2Id: match.team2Id,
      scheduledTime: match.scheduledTime,
      createdAt: match.createdAt,
      updatedAt: match.updatedAt,
      player1: match.player1Id ? playerMap.get(match.player1Id) ?? null : null,
      player2: match.player2Id ? playerMap.get(match.player2Id) ?? null : null,
      team1: match.team1Id ? teamMap.get(match.team1Id) ?? null : null,
      team2: match.team2Id ? teamMap.get(match.team2Id) ?? null : null,
      disputes: match.disputes,
      resultsCount: match.results.length,
      latestResult: match.results[0] ?? null,
    }));

    return { success: true as const, data: formatted };
  } catch (error) {
    if (error instanceof Error && ["UNAUTHENTICATED", "FORBIDDEN"].includes(error.message)) {
      return { success: false as const, error: "You do not have permission to view matches." };
    }
    console.error("getAdminMatches error", error);
    return { success: false as const, error: "Failed to load matches." };
  }
}

const updateMatchSchema = z.object({
  matchId: z.string().uuid(),
  score1: z.coerce.number().int().min(0).max(999).optional().nullable(),
  score2: z.coerce.number().int().min(0).max(999).optional().nullable(),
  winnerId: z.string().uuid().optional().nullable(),
  status: z.nativeEnum(MatchStatus).optional(),
  scheduledTime: z.coerce.date().optional().nullable(),
});

export async function updateAdminMatch(input: unknown) {
  const parsed = updateMatchSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid match data." };

  try {
    const admin = await requireRole([...tournamentManagerRoles, ...moderatorRoles]);
    const { matchId, score1, score2, winnerId, status, scheduledTime } = parsed.data;

    const currentMatch = await prisma.match.findUnique({
      where: { id: matchId },
      select: { id: true, tournamentId: true, status: true, score1: true, score2: true, winnerId: true },
    });
    if (!currentMatch) return { success: false, error: "Match not found." };

    const updateData: Prisma.MatchUpdateInput = {};
    if (score1 !== undefined) updateData.score1 = score1;
    if (score2 !== undefined) updateData.score2 = score2;
    if (winnerId !== undefined) updateData.winnerId = winnerId;
    if (status !== undefined) updateData.status = status;
    if (scheduledTime !== undefined) updateData.scheduledTime = scheduledTime;

    const updated = await prisma.match.update({
      where: { id: matchId },
      data: updateData,
    });

    await prisma.auditLog.create({
      data: {
        adminId: admin.id,
        action: "MATCH_UPDATED_BY_ADMIN",
        entity: "Match",
        entityId: matchId,
        oldValue: toAuditJson(currentMatch),
        newValue: toAuditJson(updated),
      },
    });

    revalidatePath("/admin");
    revalidatePath("/admin/matches");
    revalidatePath(`/admin/tournaments/${currentMatch.tournamentId}`);
    return { success: true, data: updated };
  } catch (error) {
    if (error instanceof Error && ["UNAUTHENTICATED", "FORBIDDEN"].includes(error.message)) {
      return { success: false, error: "Access denied." };
    }
    console.error("updateAdminMatch error", error);
    return { success: false, error: "Failed to update match." };
  }
}

const createMatchSchema = z.object({
  tournamentId: z.string().uuid(),
  round: z.coerce.number().int().min(1).default(1),
  bracketPosition: z.coerce.number().int().min(1).optional().nullable(),
  player1Id: z.string().uuid().optional().nullable(),
  player2Id: z.string().uuid().optional().nullable(),
  team1Id: z.string().uuid().optional().nullable(),
  team2Id: z.string().uuid().optional().nullable(),
  scheduledTime: z.coerce.date().optional().nullable(),
  status: z.nativeEnum(MatchStatus).default(MatchStatus.SCHEDULED),
});

export async function createAdminMatch(input: unknown) {
  const parsed = createMatchSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid match payload." };

  try {
    const admin = await requireRole([...tournamentManagerRoles]);
    const { tournamentId, round, bracketPosition, player1Id, player2Id, team1Id, team2Id, scheduledTime, status } = parsed.data;

    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: { id: true, title: true, status: true },
    });
    if (!tournament) return { success: false, error: "Tournament not found." };

    const match = await prisma.match.create({
      data: {
        tournamentId,
        round,
        bracketPosition,
        player1Id,
        player2Id,
        team1Id,
        team2Id,
        scheduledTime,
        status,
      },
    });

    await prisma.auditLog.create({
      data: {
        adminId: admin.id,
        action: "MATCH_CREATED_BY_ADMIN",
        entity: "Match",
        entityId: match.id,
        newValue: toAuditJson({ tournamentId, round, bracketPosition, player1Id, player2Id }),
      },
    });

    revalidatePath("/admin/matches");
    revalidatePath(`/admin/tournaments/${tournamentId}`);
    return { success: true, data: match };
  } catch (error) {
    if (error instanceof Error && ["UNAUTHENTICATED", "FORBIDDEN"].includes(error.message)) {
      return { success: false, error: "Access denied." };
    }
    console.error("createAdminMatch error", error);
    return { success: false, error: "Failed to create match." };
  }
}

// ---------------------------------------------------------------------------
// Player & Team Management Actions
// ---------------------------------------------------------------------------

export async function getAdminPlayers(filter?: {
  search?: string;
  status?: string;
  rank?: string;
  discordOnly?: boolean;
  limit?: number;
}): Promise<{ success: true; data: AdminPlayerItem[] } | { success: false; error: string }> {
  try {
    await requireRole([...webAdminRoles]);
    const playerAccounts = { NOT: { telegramId: { startsWith: "web-admin:" } } };
    const where: Prisma.UserWhereInput = { AND: [playerAccounts] };

    if (filter?.search?.trim()) {
      const q = filter.search.trim();
      const contains = { contains: q, mode: "insensitive" as const };
      (where.AND as Prisma.UserWhereInput[]).push({
        OR: [
          { username: contains },
          { firstName: contains },
          { lastName: contains },
          { telegramId: contains },
          { profile: { is: { veloxUsername: contains } } },
          { profile: { is: { discordUsername: contains } } },
          { profile: { is: { discordDisplayName: contains } } },
          { profile: { is: { discordId: contains } } },
        ],
      });
    }

    if (filter?.status && filter.status !== "ALL") {
      (where.AND as Prisma.UserWhereInput[]).push({ status: filter.status as UserStatus });
    }

    if (filter?.discordOnly) {
      (where.AND as Prisma.UserWhereInput[]).push({ profile: { is: { discordConnected: true } } });
    }

    const players = await prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: Math.min(Math.max(filter?.limit ?? 50, 1), 100),
      select: {
        id: true,
        telegramId: true,
        username: true,
        firstName: true,
        lastName: true,
        profileImage: true,
        status: true,
        role: true,
        createdAt: true,
        lastLogin: true,
        profile: {
          select: {
            veloxUsername: true,
            rank: true,
            level: true,
            xp: true,
            country: true,
            wins: true,
            losses: true,
            tournamentWins: true,
            discordId: true,
            discordUsername: true,
            discordDisplayName: true,
            discordAvatarUrl: true,
            discordConnected: true,
            discordConnectedAt: true,
          },
        },
        _count: {
          select: {
            registrations: true,
            payments: true,
            teamMemberships: true,
          },
        },
      },
    });

    return { success: true as const, data: players };
  } catch (error) {
    if (error instanceof Error && ["UNAUTHENTICATED", "FORBIDDEN"].includes(error.message)) {
      return { success: false as const, error: "Access denied." };
    }
    console.error("getAdminPlayers error", error);
    return { success: false as const, error: "Failed to load players." };
  }
}

export async function getAdminTeams(filter?: {
  search?: string;
  limit?: number;
}): Promise<{ success: true; data: AdminTeamItem[] } | { success: false; error: string }> {
  try {
    await requireRole([...webAdminRoles]);
    const where: Prisma.TeamWhereInput = {};

    if (filter?.search?.trim()) {
      const q = filter.search.trim();
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
      ];
    }

    const teams = await prisma.team.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: Math.min(Math.max(filter?.limit ?? 50, 1), 100),
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                firstName: true,
                profileImage: true,
                profile: { select: { veloxUsername: true, rank: true, level: true, discordUsername: true } },
              },
            },
          },
        },
        _count: {
          select: {
            registrations: true,
            members: true,
            payments: true,
          },
        },
      },
    });

    const captainIds = [...new Set(teams.map((t) => t.captainId))];
    const captains = await prisma.user.findMany({
      where: { id: { in: captainIds } },
      select: {
        id: true,
        username: true,
        firstName: true,
        profileImage: true,
        profile: { select: { veloxUsername: true } },
      },
    });
    const captainMap = new Map(captains.map((c) => [c.id, c]));

    const formatted = teams.map((team) => ({
      ...team,
      captain: captainMap.get(team.captainId) ?? null,
    }));

    return { success: true as const, data: formatted };
  } catch (error) {
    if (error instanceof Error && ["UNAUTHENTICATED", "FORBIDDEN"].includes(error.message)) {
      return { success: false as const, error: "Access denied." };
    }
    console.error("getAdminTeams error", error);
    return { success: false as const, error: "Failed to load teams." };
  }
}

// ---------------------------------------------------------------------------
// Registration Management Actions
// ---------------------------------------------------------------------------

export async function getAdminRegistrations(filter?: {
  tournamentId?: string;
  status?: string;
  search?: string;
  limit?: number;
}): Promise<{ success: true; data: AdminRegistrationItem[] } | { success: false; error: string }> {
  try {
    await requireRole([...webAdminRoles]);
    const where: Prisma.TournamentRegistrationWhereInput = {};

    if (filter?.tournamentId) where.tournamentId = filter.tournamentId;
    if (filter?.status && filter.status !== "ALL") {
      where.status = filter.status as RegistrationStatus;
    }

    if (filter?.search?.trim()) {
      const contains = { contains: filter.search.trim(), mode: "insensitive" as const };
      where.OR = [
        { user: { username: contains } },
        { user: { firstName: contains } },
        { user: { profile: { is: { veloxUsername: contains } } } },
        { user: { profile: { is: { discordUsername: contains } } } },
        { team: { is: { name: contains } } },
        { tournament: { title: contains } },
      ];
    }

    const registrations = await prisma.tournamentRegistration.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: Math.min(Math.max(filter?.limit ?? 50, 1), 100),
      include: {
        tournament: {
          select: {
            id: true,
            title: true,
            status: true,
            entryFee: true,
            isPaid: true,
            game: { select: { name: true } },
          },
        },
        user: {
          select: {
            id: true,
            username: true,
            firstName: true,
            profileImage: true,
            profile: {
              select: {
                veloxUsername: true,
                rank: true,
                level: true,
                discordUsername: true,
                discordDisplayName: true,
                discordConnected: true,
              },
            },
          },
        },
        team: {
          select: {
            id: true,
            name: true,
            logoUrl: true,
          },
        },
        payment: {
          select: {
            id: true,
            amount: true,
            status: true,
            currency: true,
            completedAt: true,
          },
        },
      },
    });

    return { success: true as const, data: registrations };
  } catch (error) {
    if (error instanceof Error && ["UNAUTHENTICATED", "FORBIDDEN"].includes(error.message)) {
      return { success: false as const, error: "Access denied." };
    }
    console.error("getAdminRegistrations error", error);
    return { success: false as const, error: "Failed to load registrations." };
  }
}

const updateRegistrationSchema = z.object({
  registrationId: z.string().uuid(),
  status: z.nativeEnum(RegistrationStatus).optional(),
  checkedIn: z.boolean().optional(),
});

export async function updateRegistrationStatus(input: unknown) {
  const parsed = updateRegistrationSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid request." };

  try {
    const admin = await requireRole([...tournamentManagerRoles]);
    const { registrationId, status, checkedIn } = parsed.data;

    const current = await prisma.tournamentRegistration.findUnique({
      where: { id: registrationId },
      select: { id: true, tournamentId: true, status: true, checkedIn: true, userId: true },
    });
    if (!current) return { success: false, error: "Registration not found." };

    const updateData: Prisma.TournamentRegistrationUpdateInput = {};
    if (status) updateData.status = status;
    if (checkedIn !== undefined) updateData.checkedIn = checkedIn;

    const updated = await prisma.tournamentRegistration.update({
      where: { id: registrationId },
      data: updateData,
    });

    await prisma.auditLog.create({
      data: {
        adminId: admin.id,
        action: "REGISTRATION_STATUS_UPDATED",
        entity: "TournamentRegistration",
        entityId: registrationId,
        oldValue: toAuditJson({ status: current.status, checkedIn: current.checkedIn }),
        newValue: toAuditJson({ status: updated.status, checkedIn: updated.checkedIn }),
      },
    });

    revalidatePath("/admin/registrations");
    revalidatePath(`/admin/tournaments/${current.tournamentId}`);
    return { success: true, data: updated };
  } catch (error) {
    if (error instanceof Error && ["UNAUTHENTICATED", "FORBIDDEN"].includes(error.message)) {
      return { success: false, error: "Access denied." };
    }
    console.error("updateRegistrationStatus error", error);
    return { success: false, error: "Failed to update registration." };
  }
}

// ---------------------------------------------------------------------------
// Discord Integration Hub Actions
// ---------------------------------------------------------------------------

export async function getAdminDiscordStats(filter?: {
  search?: string;
  limit?: number;
}): Promise<{ success: true; data: AdminDiscordStatsData } | { success: false; error: string }> {
  try {
    await requireRole([...webAdminRoles]);
    const playerAccounts = { NOT: { telegramId: { startsWith: "web-admin:" } } };
    const [totalUsers, totalConnected, recentConnected] = await Promise.all([
      prisma.user.count({ where: playerAccounts }),
      prisma.userProfile.count({ where: { discordConnected: true } }),
      prisma.userProfile.count({
        where: {
          discordConnected: true,
          discordConnectedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
      }),
    ]);

    const where: Prisma.UserProfileWhereInput = {};
    if (filter?.search?.trim()) {
      const q = filter.search.trim();
      const contains = { contains: q, mode: "insensitive" as const };
      where.OR = [
        { discordUsername: contains },
        { discordDisplayName: contains },
        { discordId: contains },
        { veloxUsername: contains },
        { user: { username: contains } },
        { user: { firstName: contains } },
      ];
    }

    const profiles = await prisma.userProfile.findMany({
      where,
      orderBy: [{ discordConnected: "desc" }, { discordConnectedAt: "desc" }],
      take: Math.min(Math.max(filter?.limit ?? 50, 1), 100),
      include: {
        user: {
          select: {
            id: true,
            telegramId: true,
            username: true,
            firstName: true,
            profileImage: true,
            status: true,
            createdAt: true,
          },
        },
      },
    });

    return {
      success: true as const,
      data: {
        totalUsers,
        totalConnected,
        unconnected: Math.max(0, totalUsers - totalConnected),
        connectionRate: totalUsers > 0 ? Math.round((totalConnected / totalUsers) * 100) : 0,
        recentConnected,
        profiles: profiles.map((p) => ({
          id: p.id,
          userId: p.userId,
          playerName: p.veloxUsername ?? p.user.username ?? p.user.firstName ?? "Player",
          telegramId: p.user.telegramId,
          profileImage: p.user.profileImage,
          userStatus: p.user.status,
          userCreatedAt: p.user.createdAt,
          rank: p.rank,
          level: p.level,
          discordId: p.discordId,
          discordUsername: p.discordUsername,
          discordDisplayName: p.discordDisplayName,
          discordAvatarUrl: p.discordAvatarUrl,
          discordConnected: p.discordConnected,
          discordConnectedAt: p.discordConnectedAt,
        })),
      },
    };
  } catch (error) {
    if (error instanceof Error && ["UNAUTHENTICATED", "FORBIDDEN"].includes(error.message)) {
      return { success: false as const, error: "Access denied." };
    }
    console.error("getAdminDiscordStats error", error);
    return { success: false as const, error: "Failed to load Discord integration data." };
  }
}

// ---------------------------------------------------------------------------
// Notification & Broadcast Operations Actions
// ---------------------------------------------------------------------------

export async function getAdminNotifications(filter?: {
  status?: "all" | "sent" | "failed" | "pending";
  limit?: number;
}): Promise<{ success: true; data: AdminNotificationsData } | { success: false; error: string }> {
  try {
    await requireRole([...webAdminRoles]);
    const where: Prisma.NotificationWhereInput = {};

    if (filter?.status === "sent") {
      where.telegramSentAt = { not: null };
    } else if (filter?.status === "failed") {
      where.telegramDeliveryError = { not: null };
    } else if (filter?.status === "pending") {
      where.telegramDeliveryEligible = true;
      where.telegramSentAt = null;
      where.telegramDeliveryError = null;
    }

    const [notifications, totalCount, failedCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: Math.min(Math.max(filter?.limit ?? 50, 1), 100),
        include: {
          user: {
            select: {
              id: true,
              username: true,
              firstName: true,
              telegramId: true,
              profile: { select: { veloxUsername: true } },
            },
          },
        },
      }),
      prisma.notification.count(),
      prisma.notification.count({ where: { telegramDeliveryError: { not: null } } }),
    ]);

    return {
      success: true as const,
      data: {
        totalCount,
        failedCount,
        notifications: notifications.map((n) => ({
          id: n.id,
          title: n.title,
          message: n.message,
          type: n.type,
          isRead: n.isRead,
          telegramDeliveryEligible: n.telegramDeliveryEligible,
          telegramSentAt: n.telegramSentAt,
          telegramDeliveryError: n.telegramDeliveryError,
          telegramDeliveryAttempts: n.telegramDeliveryAttempts,
          createdAt: n.createdAt,
          user: {
            id: n.user.id,
            name: n.user.profile?.veloxUsername ?? n.user.username ?? n.user.firstName ?? "Player",
            telegramId: n.user.telegramId,
          },
        })),
      },
    };
  } catch (error) {
    if (error instanceof Error && ["UNAUTHENTICATED", "FORBIDDEN"].includes(error.message)) {
      return { success: false as const, error: "Access denied." };
    }
    console.error("getAdminNotifications error", error);
    return { success: false as const, error: "Failed to load notifications." };
  }
}

const broadcastSchema = z.object({
  title: z.string().trim().min(3).max(120),
  message: z.string().trim().min(5).max(1000),
  target: z.enum(["ALL", "TOURNAMENT", "PLAYERS"]),
  tournamentId: z.string().uuid().optional(),
  sendTelegram: z.boolean().default(true),
});

export async function sendAdminBroadcastNotification(input: unknown) {
  const parsed = broadcastSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid broadcast payload." };

  try {
    const admin = await requireRole(["SUPER_ADMIN", "ADMIN"]);
    const { title, message, target, tournamentId, sendTelegram } = parsed.data;

    let targetUserIds: string[] = [];

    if (target === "TOURNAMENT" && tournamentId) {
      const registrations = await prisma.tournamentRegistration.findMany({
        where: { tournamentId },
        select: { userId: true },
      });
      targetUserIds = registrations.map((r) => r.userId);
    } else {
      const playerAccounts = { NOT: { telegramId: { startsWith: "web-admin:" } } };
      const users = await prisma.user.findMany({
        where: playerAccounts,
        select: { id: true },
      });
      targetUserIds = users.map((u) => u.id);
    }

    if (targetUserIds.length === 0) {
      return { success: false, error: "No target users found for this broadcast." };
    }

    const createdNotifications = await prisma.$transaction(
      targetUserIds.map((userId) =>
        prisma.notification.create({
          data: {
            userId,
            title,
            message,
            type: NotificationType.SYSTEM,
            telegramDeliveryEligible: sendTelegram,
            metadata: {
              broadcast: true,
              adminId: admin.id,
              tournamentId: tournamentId ?? null,
            },
          },
        })
      )
    );

    if (sendTelegram) {
      void dispatchPendingTelegramNotifications({ userIds: targetUserIds }).catch(() => undefined);
    }

    await prisma.auditLog.create({
      data: {
        adminId: admin.id,
        action: "BROADCAST_NOTIFICATION_SENT",
        entity: "Notification",
        entityId: admin.id,
        newValue: toAuditJson({ title, target, userCount: targetUserIds.length, sendTelegram }),
      },
    });

    revalidatePath("/admin/notifications");
    revalidatePath("/notifications");
    return {
      success: true,
      message: `Broadcast delivered to ${createdNotifications.length} player${createdNotifications.length === 1 ? "" : "s"}.`,
    };
  } catch (error) {
    if (error instanceof Error && ["UNAUTHENTICATED", "FORBIDDEN"].includes(error.message)) {
      return { success: false, error: "Access denied." };
    }
    console.error("sendAdminBroadcastNotification error", error);
    return { success: false, error: "Failed to deliver broadcast." };
  }
}

export async function retryFailedNotifications(notificationIds?: string[]) {
  try {
    await requireRole(["SUPER_ADMIN", "ADMIN"]);
    const where: Prisma.NotificationWhereInput = {
      telegramDeliveryError: { not: null },
    };
    if (notificationIds && notificationIds.length > 0) {
      where.id = { in: notificationIds };
    }

    const updated = await prisma.notification.updateMany({
      where,
      data: {
        telegramDeliveryAttempts: 0,
        telegramDeliveryError: null,
        telegramSentAt: null,
      },
    });

    if (updated.count > 0) {
      void dispatchPendingTelegramNotifications().catch(() => undefined);
    }

    revalidatePath("/admin/notifications");
    return { success: true, message: `Queued ${updated.count} failed notification${updated.count === 1 ? "" : "s"} for re-delivery.` };
  } catch (error) {
    if (error instanceof Error && ["UNAUTHENTICATED", "FORBIDDEN"].includes(error.message)) {
      return { success: false, error: "Access denied." };
    }
    console.error("retryFailedNotifications error", error);
    return { success: false, error: "Failed to retry notifications." };
  }
}

export async function duplicateTournament(tournamentId: string) {
  try {
    await requireRole([...tournamentManagerRoles]);
    const original = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: { rules: true },
    });

    if (!original) {
      return { success: false, error: "Original tournament not found." };
    }

    const uniqueSlug = `${original.slug}-copy-${Math.random().toString(36).slice(2, 7)}`;
    const now = new Date();
    const startDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const registrationDeadline = new Date(now.getTime() + 6 * 24 * 60 * 60 * 1000);

    const duplicated = await prisma.tournament.create({
      data: {
        title: `[Copy] ${original.title}`.slice(0, 140),
        slug: uniqueSlug,
        gameId: original.gameId,
        prizePool: original.prizePool,
        entryFee: original.entryFee,
        isPaid: original.isPaid,
        maxParticipants: original.maxParticipants,
        currentParticipants: 0,
        registrationDeadline,
        startDate,
        format: original.format,
        participantType: original.participantType,
        teamSize: original.teamSize,
        region: original.region,
        gameMode: original.gameMode,
        status: TournamentStatus.DRAFT,
        rules: original.rules
          ? {
              create: {
                content: original.rules.content,
                checkInPeriodMins: original.rules.checkInPeriodMins,
              },
            }
          : undefined,
      },
    });

    await createAuditLog(
      "DUPLICATE_TOURNAMENT",
      "Tournament",
      duplicated.id,
      { originalId: original.id },
      { newId: duplicated.id, title: duplicated.title }
    );

    revalidatePath("/admin/tournaments");
    revalidatePath("/tournaments");

    return {
      success: true,
      message: `Tournament duplicated as draft: “${duplicated.title}”.`,
      data: duplicated,
    };
  } catch (error) {
    if (error instanceof Error && ["UNAUTHENTICATED", "FORBIDDEN"].includes(error.message)) {
      return { success: false, error: "Access denied." };
    }
    console.error("duplicateTournament error", error);
    return { success: false, error: "Failed to duplicate tournament." };
  }
}

export async function bulkUpdateRegistrationStatus({
  registrationIds,
  status,
  checkedIn,
}: {
  registrationIds: string[];
  status?: RegistrationStatus;
  checkedIn?: boolean;
}) {
  try {
    await requireRole([...tournamentManagerRoles]);
    if (!registrationIds || registrationIds.length === 0) {
      return { success: false, error: "No registrations selected." };
    }

    const updateData: Prisma.TournamentRegistrationUpdateManyMutationInput = {};
    if (status) updateData.status = status;
    if (typeof checkedIn === "boolean") {
      updateData.checkedIn = checkedIn;
    }

    await prisma.$transaction(async (tx) => {
      await tx.tournamentRegistration.updateMany({
        where: { id: { in: registrationIds } },
        data: updateData,
      });

      // Recalculate currentParticipants for affected tournaments
      const affected = await tx.tournamentRegistration.findMany({
        where: { id: { in: registrationIds } },
        select: { tournamentId: true },
        distinct: ["tournamentId"],
      });

      for (const item of affected) {
        const confirmedCount = await tx.tournamentRegistration.count({
          where: { tournamentId: item.tournamentId, status: "CONFIRMED" },
        });
        await tx.tournament.update({
          where: { id: item.tournamentId },
          data: { currentParticipants: confirmedCount },
        });
      }
    });

    await createAuditLog(
      "BULK_UPDATE_REGISTRATIONS",
      "TournamentRegistration",
      "bulk",
      { count: registrationIds.length },
      { status, checkedIn }
    );

    revalidatePath("/admin/registrations");
    revalidatePath("/admin/tournaments");
    revalidatePath("/tournaments");

    return {
      success: true,
      message: `Updated ${registrationIds.length} registration${registrationIds.length === 1 ? "" : "s"}.`,
    };
  } catch (error) {
    if (error instanceof Error && ["UNAUTHENTICATED", "FORBIDDEN"].includes(error.message)) {
      return { success: false, error: "Access denied." };
    }
    console.error("bulkUpdateRegistrationStatus error", error);
    return { success: false, error: "Failed to perform bulk update." };
  }
}


