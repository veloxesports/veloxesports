"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/database/prisma";
import { requireRole } from "@/lib/auth/current-user";
import { Prisma, TournamentFormat, TournamentStatus } from "@/lib/generated/prisma/client";
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
  status: z.nativeEnum(TournamentStatus).default(TournamentStatus.DRAFT),
}).superRefine((value, context) => {
  if (value.isPaid && value.entryFee < 1) context.addIssue({ code: "custom", path: ["entryFee"], message: "Paid tournaments must have an entry fee." });
  if (!value.isPaid && value.entryFee !== 0) context.addIssue({ code: "custom", path: ["entryFee"], message: "Free tournaments must have a zero entry fee." });
  if (value.registrationDeadline >= value.startDate) context.addIssue({ code: "custom", path: ["registrationDeadline"], message: "Registration must close before the tournament starts." });
});
const statusSchema = z.object({ tournamentId: z.string().uuid(), status: z.nativeEnum(TournamentStatus) });
const tournamentIdSchema = z.string().uuid();

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

export async function getAdminStats() {
  try {
    await requireRole(["SUPER_ADMIN", "ADMIN", "TOURNAMENT_MANAGER", "FINANCE_MANAGER", "MODERATOR", "SUPPORT"]);
    const [totalUsers, activeTournaments, pendingDisputes, registrations, pendingPayments, recentTransactions] = await Promise.all([
      prisma.user.count(),
      prisma.tournament.count({ where: { status: { in: ["REGISTRATION_OPEN", "UPCOMING", "LIVE"] } } }),
      prisma.dispute.count({ where: { status: "OPEN" } }),
      prisma.tournamentRegistration.count({ where: { status: "CONFIRMED" } }),
      prisma.telegramPayment.count({ where: { status: "PENDING" } }),
      prisma.walletTransaction.findMany({ take: 5, orderBy: { createdAt: "desc" }, include: { wallet: { include: { user: true } } } }),
    ]);

    return {
      success: true,
      data: { totalUsers, activeTournaments, pendingDisputes, registrations, pendingPayments, recentTransactions },
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
      include: { game: { select: { name: true } }, _count: { select: { registrations: true, matches: true } } },
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
    const game = await prisma.game.findFirst({ where: { id: parsed.data.gameId, isActive: true }, select: { id: true } });
    if (!game) return { success: false, error: "Select an active game." };
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
          rules: parsed.data.rules ? { create: { content: parsed.data.rules } } : undefined,
        },
      });
      await tx.auditLog.create({ data: { adminId: admin.id, action: "TOURNAMENT_CREATED", entity: "Tournament", entityId: created.id, newValue: toAuditJson({ ...parsed.data, slug }) } });
      return created;
    });
    revalidatePath("/tournaments");
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
  try {
    const admin = await requireRole([...tournamentManagerRoles]);
    const current = await prisma.tournament.findUnique({ where: { id: parsed.data.tournamentId }, select: { status: true } });
    if (!current) return { success: false, error: "Tournament not found." };
    await prisma.$transaction(async (tx) => {
      await tx.tournament.update({ where: { id: parsed.data.tournamentId }, data: { status: parsed.data.status } });
      await tx.auditLog.create({ data: { adminId: admin.id, action: "TOURNAMENT_STATUS_CHANGED", entity: "Tournament", entityId: parsed.data.tournamentId, oldValue: toAuditJson(current), newValue: toAuditJson({ status: parsed.data.status }) } });
    });
    revalidatePath("/tournaments");
    revalidatePath("/admin/tournaments");
    return { success: true };
  } catch (error) {
    if (error instanceof Error && ["UNAUTHENTICATED", "FORBIDDEN"].includes(error.message)) return { success: false, error: "You do not have permission to update tournaments." };
    console.error("Tournament status update failed", error);
    return { success: false, error: "We couldn't update the tournament status." };
  }
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
