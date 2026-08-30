"use server";

import { prisma } from "@/lib/database/prisma";

export async function initiateTournamentPayment(tournamentId: string, userId: string) {
  try {
    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
    });

    if (!tournament) return { success: false, error: "Tournament not found" };
    if (!tournament.isPaid) return { success: false, error: "Tournament is free" };
    if (tournament.currentParticipants >= tournament.maxParticipants) {
      return { success: false, error: "Tournament is full" };
    }

    // Check if user is already registered
    const existingReg = await prisma.tournamentRegistration.findUnique({
      where: { tournamentId_userId: { tournamentId, userId } }
    });
    if (existingReg) return { success: false, error: "Already registered" };

    // Create a pending payment record in our DB
    const payment = await prisma.telegramPayment.create({
      data: {
        userId,
        tournamentId,
        amount: tournament.entryFee,
        currency: "XTR",
        status: "PENDING",
      }
    });

    // In a real application, you would generate a Telegram Invoice Link here
    // using the Bot API `createInvoiceLink` method:
    // https://core.telegram.org/bots/api#createinvoicelink
    
    // Example:
    // const botToken = process.env.TELEGRAM_BOT_TOKEN;
    // const res = await fetch(`https://api.telegram.org/bot${botToken}/createInvoiceLink`, { ... })
    // const invoiceUrl = res.result;

    // For this demonstration, we'll return a mock invoice URL that the frontend
    // would normally pass to Telegram.WebApp.openInvoice(url)
    const mockInvoiceUrl = `https://t.me/$invoice_mock_${payment.id}`;

    return { 
      success: true, 
      data: { 
        paymentId: payment.id,
        invoiceUrl: mockInvoiceUrl 
      } 
    };
  } catch (error) {
    console.error("Error initiating payment:", error);
    return { success: false, error: "Failed to initiate payment" };
  }
}

export async function refundStarsPayment(paymentId: string, adminId: string) {
  try {
    const payment = await prisma.telegramPayment.findUnique({
      where: { id: paymentId },
    });

    if (!payment || payment.status !== "COMPLETED") {
      return { success: false, error: "Payment not eligible for refund" };
    }

    if (!payment.telegramPaymentRef) {
      return { success: false, error: "Missing Telegram payment reference" };
    }

    // Call Telegram API to refund
    // const botToken = process.env.TELEGRAM_BOT_TOKEN;
    // const res = await fetch(`https://api.telegram.org/bot${botToken}/refundStarPayment`, {
    //   method: "POST",
    //   headers: { "Content-Type": "application/json" },
    //   body: JSON.stringify({
    //     user_id: payment.userId,
    //     telegram_payment_charge_id: payment.telegramPaymentRef,
    //   }),
    // });
    
    // const data = await res.json();
    // if (!data.ok) throw new Error("Telegram refund failed");

    // Perform DB updates in transaction
    await prisma.$transaction(async (tx) => {
      // 1. Create Refund record
      await tx.refund.create({
        data: {
          paymentId: payment.id,
          amount: payment.amount,
          status: "COMPLETED",
          telegramRefundRef: `mock_refund_ref_${payment.id}`,
        }
      });

      // 2. Mark original payment as refunded
      await tx.telegramPayment.update({
        where: { id: payment.id },
        data: { status: "REFUNDED" }
      });

      // 3. Cancel registration if exists
      if (payment.tournamentId) {
        await tx.tournamentRegistration.updateMany({
          where: { paymentId: payment.id },
          data: { status: "REFUNDED" }
        });
        
        // Decrement participant count
        await tx.tournament.update({
          where: { id: payment.tournamentId },
          data: { currentParticipants: { decrement: 1 } }
        });
      }

      // 4. Update Wallet Ledger
      // We must import createLedgerTransaction from wallet/services, 
      // but since we are in a transaction here, we might just inline the ledger logic 
      // to keep it within the single prisma transaction.
      const wallet = await tx.wallet.findUnique({ where: { userId: payment.userId } });
      if (wallet) {
        await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            amount: payment.amount,
            type: "REFUND",
            status: "COMPLETED",
            tournamentId: payment.tournamentId,
            description: "Refund for tournament entry",
            completedAt: new Date()
          }
        });
        await tx.wallet.update({
          where: { id: wallet.id },
          data: { totalRefunds: { increment: payment.amount } }
        });
      }
    });

    return { success: true };
  } catch (error) {
    console.error("Refund error:", error);
    return { success: false, error: "Failed to process refund" };
  }
}
