import { prisma } from "@/lib/database/prisma";
import { Prisma, TransactionType, TransactionStatus } from "@/lib/generated/prisma/client";
import { requireCurrentUser } from "@/lib/auth/current-user";
import { z } from "zod";

export async function getOrCreateWallet(userId: string) {
  return prisma.wallet.upsert({ where: { userId }, update: {}, create: { userId } });
}

type LedgerTransactionParams = {
  userId: string;
  amount: number;
  type: TransactionType;
  status: TransactionStatus;
  tournamentId?: string;
  telegramPaymentId?: string;
  description?: string;
};

/**
 * Creates an append-only ledger entry and its derived wallet totals inside the
 * caller's transaction. Financial workflows must use this helper rather than
 * opening a second transaction.
 */
export async function createLedgerTransactionInTransaction(
  tx: Prisma.TransactionClient,
  params: LedgerTransactionParams,
) {
  const wallet = await tx.wallet.upsert({
    where: { userId: params.userId },
    update: {},
    create: { userId: params.userId },
  });

  const transaction = await tx.walletTransaction.create({
    data: {
      walletId: wallet.id,
      amount: params.amount,
      type: params.type,
      status: params.status,
      tournamentId: params.tournamentId,
      telegramPaymentId: params.telegramPaymentId,
      description: params.description,
      completedAt: params.status === "COMPLETED" ? new Date() : null,
    },
  });

  if (params.status === "COMPLETED") {
    let updateData: Prisma.WalletUpdateInput = {};
    if (params.type === "TOURNAMENT_ENTRY") {
      updateData = { totalSpent: { increment: params.amount } };
    } else if (params.type === "PRIZE_REWARD" || params.type === "BONUS") {
      updateData = { totalRewards: { increment: params.amount } };
    } else if (params.type === "REFUND") {
      updateData = { totalRefunds: { increment: params.amount } };
    }

    if (Object.keys(updateData).length > 0) {
      await tx.wallet.update({
        where: { id: wallet.id },
        data: updateData,
      });
    }
  }

  return transaction;
}

export async function createLedgerTransaction(params: LedgerTransactionParams) {
  return prisma.$transaction(async (tx) => {
    return createLedgerTransactionInTransaction(tx, params);
  });
}

export async function getWalletSummary() {
  try {
    const user = await requireCurrentUser();
    const wallet = await getOrCreateWallet(user.id);
    
    const recentTransactions = await prisma.walletTransaction.findMany({
      where: { walletId: wallet.id },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        tournament: { select: { title: true } }
      }
    });

    return { success: true, data: { wallet, transactions: recentTransactions } };
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return { success: false, error: "Sign in with Telegram to view your wallet." };
    }
    console.error("Error fetching wallet summary", error);
    return { success: false, error: "Failed to fetch wallet summary" };
  }
}

const transactionIdSchema = z.string().uuid();

export async function getWalletTransaction(transactionId: unknown) {
  const parsed = transactionIdSchema.safeParse(transactionId);
  if (!parsed.success) return { success: false, error: "Invalid transaction." };

  try {
    const user = await requireCurrentUser();
    const transaction = await prisma.walletTransaction.findFirst({
      where: { id: parsed.data, wallet: { userId: user.id } },
      include: { tournament: { select: { title: true, slug: true } } },
    });
    if (!transaction) return { success: false, error: "Transaction not found." };
    return { success: true, data: transaction };
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") return { success: false, error: "Sign in with Telegram to view transaction details." };
    console.error("Wallet transaction fetch failed", error);
    return { success: false, error: "We couldn't load this transaction." };
  }
}
