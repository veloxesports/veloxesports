import { prisma } from "@/lib/database/prisma";
import { TransactionType, TransactionStatus } from "@/lib/generated/prisma/client";

export async function getOrCreateWallet(userId: string) {
  let wallet = await prisma.wallet.findUnique({
    where: { userId },
  });

  if (!wallet) {
    wallet = await prisma.wallet.create({
      data: { userId },
    });
  }

  return wallet;
}

export async function createLedgerTransaction(params: {
  userId: string;
  amount: number;
  type: TransactionType;
  status: TransactionStatus;
  tournamentId?: string;
  telegramPaymentId?: string;
  description?: string;
}) {
  const wallet = await getOrCreateWallet(params.userId);

  return prisma.$transaction(async (tx) => {
    // 1. Create the transaction record
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

    // 2. Update wallet totals ONLY if completed
    if (params.status === "COMPLETED") {
      let updateData = {};
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
  });
}

export async function getWalletSummary(userId: string) {
  try {
    const wallet = await getOrCreateWallet(userId);
    
    const recentTransactions = await prisma.walletTransaction.findMany({
      where: { walletId: wallet.id },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: {
        tournament: { select: { title: true } }
      }
    });

    return { success: true, data: { wallet, transactions: recentTransactions } };
  } catch (error) {
    console.error("Error fetching wallet summary", error);
    return { success: false, error: "Failed to fetch wallet summary" };
  }
}
