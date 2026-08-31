import "server-only";

import { prisma } from "@/lib/database/prisma";
import { requireRole } from "@/lib/auth/current-user";
import { webAdminRoles } from "@/lib/auth/web-admin";

export const adminInsightMetrics = [
  "players",
  "active-players",
  "tournaments",
  "live-events",
  "confirmed-entries",
  "verified-stars",
  "refunded-stars",
  "prize-rewards",
] as const;

export type AdminInsightMetric = (typeof adminInsightMetrics)[number];

export type AdminInsightItem = {
  id: string;
  title: string;
  detail: string;
  status: string;
  date: Date | null;
  dateLabel: string;
  meta?: string;
  amount?: number;
  imageUrl?: string | null;
  href?: string;
};

export type AdminInsight = {
  eyebrow: string;
  title: string;
  description: string;
  itemLabel: string;
  total: number;
  totalAmount?: number;
  canModeratePlayers?: boolean;
  items: AdminInsightItem[];
};

const playerAccountFilter = { NOT: { telegramId: { startsWith: "web-admin:" } } };
const listLimit = 250;

export function isAdminInsightMetric(value: string): value is AdminInsightMetric {
  return adminInsightMetrics.includes(value as AdminInsightMetric);
}

export async function getAdminInsight(metric: AdminInsightMetric): Promise<{ success: true; data: AdminInsight } | { success: false; error: string }> {
  try {
    const admin = await requireRole([...webAdminRoles]);

    const activeSince = new Date();
    activeSince.setDate(activeSince.getDate() - 30);

    switch (metric) {
      case "players": {
        const [total, players] = await Promise.all([
          prisma.user.count({ where: playerAccountFilter }),
          prisma.user.findMany({
            where: playerAccountFilter,
            orderBy: { createdAt: "desc" },
            take: listLimit,
            select: playerSelect,
          }),
        ]);
        return { success: true, data: { ...playerInsight({ total, players, activeOnly: false }), canModeratePlayers: admin.role === "SUPER_ADMIN" } };
      }
      case "active-players": {
        const where = { ...playerAccountFilter, status: "ACTIVE" as const, lastLogin: { gte: activeSince } };
        const [total, players] = await Promise.all([
          prisma.user.count({ where }),
          prisma.user.findMany({ where, orderBy: { lastLogin: "desc" }, take: listLimit, select: playerSelect }),
        ]);
        return { success: true, data: { ...playerInsight({ total, players, activeOnly: true }), canModeratePlayers: admin.role === "SUPER_ADMIN" } };
      }
      case "tournaments":
        return { success: true, data: await tournamentInsight({}) };
      case "live-events":
        return { success: true, data: await tournamentInsight({ status: "LIVE" }) };
      case "confirmed-entries":
        return { success: true, data: await confirmedEntriesInsight() };
      case "verified-stars":
        return { success: true, data: await paymentInsight("payments") };
      case "refunded-stars":
        return { success: true, data: await paymentInsight("refunds") };
      case "prize-rewards":
        return { success: true, data: await paymentInsight("rewards") };
    }
  } catch (error) {
    if (error instanceof Error && ["UNAUTHENTICATED", "FORBIDDEN"].includes(error.message)) {
      return { success: false, error: "You do not have permission to view this Command Center data." };
    }
    console.error("Admin insight fetch failed", error);
    return { success: false, error: "We couldn't load this Command Center view." };
  }
}

export async function getAdminTournamentDetail(tournamentId: string) {
  try {
    await requireRole([...webAdminRoles]);
    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: {
        id: true,
        title: true,
        status: true,
        format: true,
        gameMode: true,
        region: true,
        prizePool: true,
        entryFee: true,
        isPaid: true,
        maxParticipants: true,
        currentParticipants: true,
        registrationDeadline: true,
        startDate: true,
        game: { select: { name: true } },
        _count: { select: { matches: true, registrations: true } },
        registrations: {
          orderBy: { createdAt: "desc" },
          take: listLimit,
          select: {
            id: true,
            status: true,
            checkedIn: true,
            createdAt: true,
            user: {
              select: {
                username: true,
                firstName: true,
                profileImage: true,
                profile: { select: { veloxUsername: true, rank: true, level: true } },
              },
            },
            team: { select: { name: true, logoUrl: true } },
          },
        },
      },
    });

    if (!tournament) return { success: false as const, error: "Tournament not found." };
    return { success: true as const, data: tournament };
  } catch (error) {
    if (error instanceof Error && ["UNAUTHENTICATED", "FORBIDDEN"].includes(error.message)) {
      return { success: false as const, error: "You do not have permission to view tournament registrations." };
    }
    console.error("Admin tournament detail fetch failed", error);
    return { success: false as const, error: "We couldn't load this tournament." };
  }
}

const playerSelect = {
  id: true,
  username: true,
  firstName: true,
  profileImage: true,
  status: true,
  createdAt: true,
  lastLogin: true,
  profile: { select: { veloxUsername: true, rank: true, level: true } },
  _count: { select: { registrations: true } },
} as const;

async function tournamentInsight(where: { status?: "LIVE" }): Promise<AdminInsight> {
  const [total, tournaments] = await Promise.all([
    prisma.tournament.count({ where }),
    prisma.tournament.findMany({
      where,
      orderBy: where.status === "LIVE" ? { startDate: "asc" } : { createdAt: "desc" },
      take: listLimit,
      select: {
        id: true,
        title: true,
        status: true,
        format: true,
        startDate: true,
        currentParticipants: true,
        maxParticipants: true,
        game: { select: { name: true } },
        _count: { select: { registrations: true, matches: true } },
      },
    }),
  ]);

  const isLive = where.status === "LIVE";
  return {
    eyebrow: isLive ? "Competition now" : "Competition archive",
    title: isLive ? "Live events" : "All tournaments",
    description: isLive ? "Tournaments that are currently in play. Open any event to review its confirmed and pending registrations." : "Every tournament in the VELOX operating archive. Select an event to see its player roster.",
    itemLabel: "tournament",
    total,
    items: tournaments.map((tournament) => ({
      id: tournament.id,
      title: tournament.title,
      detail: `${tournament.game.name} · ${labelFor(tournament.format)}`,
      status: tournament.status,
      date: tournament.startDate,
      dateLabel: "Starts",
      meta: `${tournament._count.registrations}/${tournament.maxParticipants} registered · ${tournament._count.matches} matches`,
      href: `/admin/tournaments/${tournament.id}`,
    })),
  };
}

async function confirmedEntriesInsight(): Promise<AdminInsight> {
  const where = { status: "CONFIRMED" as const };
  const [total, registrations] = await Promise.all([
    prisma.tournamentRegistration.count({ where }),
    prisma.tournamentRegistration.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: listLimit,
      select: {
        id: true,
        status: true,
        checkedIn: true,
        createdAt: true,
        tournament: { select: { id: true, title: true, game: { select: { name: true } } } },
        user: { select: { username: true, firstName: true, profileImage: true, profile: { select: { veloxUsername: true } } } },
        team: { select: { name: true } },
      },
    }),
  ]);

  return {
    eyebrow: "Competition ready",
    title: "Confirmed entries",
    description: "Players with a confirmed place in a tournament. Select the tournament to inspect its complete roster.",
    itemLabel: "entry",
    total,
    items: registrations.map((registration) => ({
      id: registration.id,
      title: playerName(registration.user),
      detail: `${registration.tournament.title} · ${registration.tournament.game.name}`,
      status: registration.status,
      date: registration.createdAt,
      dateLabel: "Registered",
      meta: `${registration.checkedIn ? "Checked in" : "Awaiting check-in"}${registration.team ? ` · ${registration.team.name}` : ""}`,
      imageUrl: registration.user.profileImage,
      href: `/admin/tournaments/${registration.tournament.id}`,
    })),
  };
}

async function paymentInsight(kind: "payments" | "refunds" | "rewards"): Promise<AdminInsight> {
  if (kind === "payments") {
    const where = { status: "COMPLETED" as const };
    const [total, paymentTotal, payments] = await Promise.all([
      prisma.telegramPayment.count({ where }),
      prisma.telegramPayment.aggregate({ _sum: { amount: true }, where }),
      prisma.telegramPayment.findMany({
        where,
        orderBy: { completedAt: "desc" },
        take: listLimit,
        select: {
          id: true,
          amount: true,
          completedAt: true,
          createdAt: true,
          user: { select: { username: true, firstName: true, profileImage: true, profile: { select: { veloxUsername: true } } } },
          tournament: { select: { id: true, title: true } },
        },
      }),
    ]);
    return {
      eyebrow: "Telegram Stars",
      title: "Verified payments",
      description: "Completed Telegram Stars payments recorded by the verified payment flow.",
      itemLabel: "payment",
      total,
      totalAmount: paymentTotal._sum.amount ?? 0,
      items: payments.map((payment) => ({
        id: payment.id,
        title: payment.tournament?.title ?? "VELOX transaction",
        detail: playerName(payment.user),
        status: "COMPLETED",
        date: payment.completedAt ?? payment.createdAt,
        dateLabel: "Completed",
        amount: payment.amount,
        imageUrl: payment.user.profileImage,
        href: payment.tournament ? `/admin/tournaments/${payment.tournament.id}` : undefined,
      })),
    };
  }

  if (kind === "refunds") {
    const where = { status: "COMPLETED" as const };
    const [total, refundTotal, refunds] = await Promise.all([
      prisma.refund.count({ where }),
      prisma.refund.aggregate({ _sum: { amount: true }, where }),
      prisma.refund.findMany({
        where,
        orderBy: { completedAt: "desc" },
        take: listLimit,
        select: {
          id: true,
          amount: true,
          completedAt: true,
          createdAt: true,
          payment: {
            select: {
              user: { select: { username: true, firstName: true, profileImage: true, profile: { select: { veloxUsername: true } } } },
              tournament: { select: { id: true, title: true } },
            },
          },
        },
      }),
    ]);
    return {
      eyebrow: "Telegram Stars",
      title: "Completed refunds",
      description: "Telegram Stars refunds that have been completed for a player payment.",
      itemLabel: "refund",
      total,
      totalAmount: refundTotal._sum.amount ?? 0,
      items: refunds.map((refund) => ({
        id: refund.id,
        title: refund.payment.tournament?.title ?? "VELOX refund",
        detail: playerName(refund.payment.user),
        status: "REFUNDED",
        date: refund.completedAt ?? refund.createdAt,
        dateLabel: "Refunded",
        amount: refund.amount,
        imageUrl: refund.payment.user.profileImage,
        href: refund.payment.tournament ? `/admin/tournaments/${refund.payment.tournament.id}` : undefined,
      })),
    };
  }

  const where = { type: "PRIZE_REWARD" as const, status: "COMPLETED" as const };
  const [total, rewardTotal, rewards] = await Promise.all([
    prisma.walletTransaction.count({ where }),
    prisma.walletTransaction.aggregate({ _sum: { amount: true }, where }),
    prisma.walletTransaction.findMany({
      where,
      orderBy: { completedAt: "desc" },
      take: listLimit,
      select: {
        id: true,
        amount: true,
        completedAt: true,
        createdAt: true,
        description: true,
        tournament: { select: { id: true, title: true } },
        wallet: { select: { user: { select: { username: true, firstName: true, profileImage: true, profile: { select: { veloxUsername: true } } } } } },
      },
    }),
  ]);
  return {
    eyebrow: "Player earnings",
    title: "Prize rewards",
    description: "Completed prize rewards credited to player wallets after tournament results.",
    itemLabel: "reward",
    total,
    totalAmount: rewardTotal._sum.amount ?? 0,
    items: rewards.map((reward) => ({
      id: reward.id,
      title: reward.tournament?.title ?? reward.description ?? "VELOX prize reward",
      detail: playerName(reward.wallet.user),
      status: "COMPLETED",
      date: reward.completedAt ?? reward.createdAt,
      dateLabel: "Rewarded",
      amount: reward.amount,
      imageUrl: reward.wallet.user.profileImage,
      href: reward.tournament ? `/admin/tournaments/${reward.tournament.id}` : undefined,
    })),
  };
}

function playerInsight({ total, players, activeOnly }: { total: number; players: Array<{ id: string; username: string | null; firstName: string | null; profileImage: string | null; status: string; createdAt: Date; lastLogin: Date | null; profile: { veloxUsername: string | null; rank: string; level: number } | null; _count: { registrations: number } }>; activeOnly: boolean }): AdminInsight {
  return {
    eyebrow: activeOnly ? "Last 30 days" : "Platform accounts",
    title: activeOnly ? "Active players" : "All players",
    description: activeOnly ? "Active player accounts with a recorded VELOX or Telegram sign-in during the last 30 days." : "Every player account in VELOX, excluding administrative service accounts.",
    itemLabel: "player",
    total,
    items: players.map((player) => ({
      id: player.id,
      title: playerName(player),
      detail: player.profile ? `${labelFor(player.profile.rank)} · Level ${player.profile.level}` : "Player profile incomplete",
      status: player.status,
      date: activeOnly ? player.lastLogin : player.createdAt,
      dateLabel: activeOnly ? "Last active" : "Joined",
      meta: `${player._count.registrations} tournament registration${player._count.registrations === 1 ? "" : "s"}`,
      imageUrl: player.profileImage,
    })),
  };
}

function playerName(user: { username: string | null; firstName: string | null; profile: { veloxUsername: string | null } | null }) {
  return user.profile?.veloxUsername ?? user.username ?? user.firstName ?? "VELOX player";
}

function labelFor(value: string) {
  return value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}
