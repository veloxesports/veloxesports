"use server";

import { z } from "zod";
import { prisma } from "@/lib/database/prisma";
import { requireCurrentUser, requireRole } from "@/lib/auth/current-user";
import { createTournamentInvoice, refundTelegramStarsPayment } from "@/lib/telegram/bot";
import { createLedgerTransactionInTransaction } from "@/features/wallet/services";
import { TournamentParticipantType } from "@/lib/generated/prisma/client";
import { teamEntryErrorMessage, validateTeamEntry } from "@/lib/tournaments/team-registration";
import { dispatchTelegramNotificationsCreatedSince } from "@/lib/notifications/delivery";
import { revalidatePath } from "next/cache";

const paymentIdSchema = z.string().uuid();
const tournamentPaymentSchema = z.union([
  z.string().uuid().transform((tournamentId) => ({ tournamentId })),
  z.object({ tournamentId: z.string().uuid(), teamId: z.string().uuid().optional() }),
]);

class PaymentActionError extends Error {
  constructor(
    public code:
      | "TOURNAMENT_NOT_FOUND"
      | "NOT_PAID"
      | "REGISTRATION_CLOSED"
      | "FULL"
      | "ALREADY_REGISTERED"
      | "REFUND_IN_PROGRESS"
      | "REFUND_NOT_ELIGIBLE",
  ) {
    super(code);
  }
}

function paymentErrorMessage(code: PaymentActionError["code"]) {
  const messages = {
    TOURNAMENT_NOT_FOUND: "Tournament not found.",
    NOT_PAID: "This tournament is free to enter.",
    REGISTRATION_CLOSED: "Registration is closed.",
    FULL: "Tournament is full.",
    ALREADY_REGISTERED: "You are already registered.",
    REFUND_IN_PROGRESS: "A refund is already being processed for this payment.",
    REFUND_NOT_ELIGIBLE: "This payment is not eligible for a refund.",
  };

  return messages[code];
}

export async function initiateTournamentPayment(input: unknown) {
  const parsedPayment = tournamentPaymentSchema.safeParse(input);
  if (!parsedPayment.success) return { success: false, error: "Invalid tournament." };
  const requestedTeamId = "teamId" in parsedPayment.data ? parsedPayment.data.teamId : undefined;

  try {
    const user = await requireCurrentUser();
    const now = new Date();
    const { payment, title } = await prisma.$transaction(async (tx) => {
      const tournament = await tx.tournament.findUnique({
        where: { id: parsedPayment.data.tournamentId },
        select: {
          id: true,
          title: true,
          isPaid: true,
          entryFee: true,
          status: true,
          registrationDeadline: true,
          maxParticipants: true,
          currentParticipants: true,
          participantType: true,
          teamSize: true,
        },
      });

      if (!tournament) throw new PaymentActionError("TOURNAMENT_NOT_FOUND");
      if (!tournament.isPaid) throw new PaymentActionError("NOT_PAID");
      if (tournament.status !== "REGISTRATION_OPEN" || tournament.registrationDeadline <= now) {
        throw new PaymentActionError("REGISTRATION_CLOSED");
      }
      if (tournament.currentParticipants >= tournament.maxParticipants) throw new PaymentActionError("FULL");

      let selectedTeamId: string | null = null;
      if (tournament.participantType === TournamentParticipantType.TEAM) {
        if (!requestedTeamId) throw new Error("TEAM_REQUIRED");
        const team = await validateTeamEntry(tx, tournament, user.id, requestedTeamId);
        selectedTeamId = team.teamId;
      } else if (requestedTeamId) {
        throw new Error("TEAM_NOT_ALLOWED");
      }

      const registration = await tx.tournamentRegistration.findUnique({
        where: { tournamentId_userId: { tournamentId: tournament.id, userId: user.id } },
        select: { id: true },
      });
      if (registration) throw new PaymentActionError("ALREADY_REGISTERED");

      const pendingPayment = await tx.telegramPayment.findFirst({
        where: { userId: user.id, tournamentId: tournament.id, teamId: selectedTeamId, status: "PENDING" },
        orderBy: { createdAt: "desc" },
      });

      if (pendingPayment) return { payment: pendingPayment, title: tournament.title };

      const created = await tx.telegramPayment.create({
        data: {
          userId: user.id,
          tournamentId: tournament.id,
          teamId: selectedTeamId,
          amount: tournament.entryFee,
          currency: "XTR",
          status: "PENDING",
        },
      });
      const payment = await tx.telegramPayment.update({
        where: { id: created.id },
        data: { invoicePayload: `khemora:${created.id}` },
      });

      return { payment, title: tournament.title };
    }, { isolationLevel: "Serializable", maxWait: 5_000, timeout: 10_000 });

    const invoiceUrl = await createTournamentInvoice({
      paymentId: payment.id,
      title,
      amount: payment.amount,
    });

    return { success: true, data: { paymentId: payment.id, invoiceUrl } };
  } catch (error) {
    if (error instanceof PaymentActionError) {
      return { success: false, error: paymentErrorMessage(error.code) };
    }
    if (error instanceof Error && ["TEAM_REQUIRED", "TEAM_NOT_ALLOWED", "TEAM_EVENT_REQUIRED", "TEAM_NOT_FOUND", "NOT_TEAM_CAPTAIN", "TEAM_ROSTER_SIZE_INVALID", "TEAM_MEMBER_UNAVAILABLE", "TEAM_MEMBER_ALREADY_REGISTERED"].includes(error.message)) {
      const message = error.message === "TEAM_REQUIRED"
        ? "Choose the team roster that your captain will enter."
        : error.message === "TEAM_NOT_ALLOWED"
          ? "This is an individual tournament."
          : teamEntryErrorMessage(error.message);
      return { success: false, error: message };
    }
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return { success: false, error: "Open Khemora in Telegram to make a payment." };
    }
    if (error instanceof Error && error.message === "TELEGRAM_NOT_CONFIGURED") {
      return { success: false, error: "Payments are not configured yet." };
    }
    console.error("Tournament payment initiation failed", error);
    return { success: false, error: "We couldn't create your payment request. Please try again." };
  }
}

export async function refundStarsPayment(paymentId: unknown) {
  const parsedPaymentId = paymentIdSchema.safeParse(paymentId);
  if (!parsedPaymentId.success) return { success: false, error: "Invalid payment." };

  try {
    const notificationSince = new Date();
    await requireRole(["SUPER_ADMIN", "ADMIN", "FINANCE_MANAGER"]);

    const prepared = await prisma.$transaction(async (tx) => {
      const payment = await tx.telegramPayment.findUnique({
        where: { id: parsedPaymentId.data },
        include: { user: { select: { telegramId: true } }, refund: true },
      });

      if (!payment || payment.status !== "COMPLETED" || !payment.telegramPaymentRef) {
        throw new PaymentActionError("REFUND_NOT_ELIGIBLE");
      }
      if (payment.refund?.status === "PENDING" || payment.refund?.status === "COMPLETED") {
        throw new PaymentActionError("REFUND_IN_PROGRESS");
      }

      const refund = payment.refund
        ? await tx.refund.update({
            where: { id: payment.refund.id },
            data: { status: "PENDING", reason: "Administrator-initiated refund retry", telegramRefundRef: null, completedAt: null },
          })
        : await tx.refund.create({
            data: {
              paymentId: payment.id,
              amount: payment.amount,
              status: "PENDING",
              reason: "Administrator-initiated refund",
            },
          });

      return { refundId: refund.id, payment };
    }, { isolationLevel: "Serializable", maxWait: 5_000, timeout: 10_000 });

    try {
      await refundTelegramStarsPayment({
        telegramUserId: prepared.payment.user.telegramId,
        telegramPaymentChargeId: prepared.payment.telegramPaymentRef!,
      });
    } catch (error) {
      await prisma.refund.update({
        where: { id: prepared.refundId },
        data: { status: "FAILED" },
      });
      throw error;
    }

    await prisma.$transaction(async (tx) => {
      const refund = await tx.refund.findUniqueOrThrow({ where: { id: prepared.refundId } });
      if (refund.status !== "PENDING") throw new PaymentActionError("REFUND_IN_PROGRESS");

      await tx.refund.update({
        where: { id: refund.id },
        data: {
          status: "COMPLETED",
          telegramRefundRef: prepared.payment.telegramPaymentRef,
          completedAt: new Date(),
        },
      });
      await tx.telegramPayment.update({
        where: { id: prepared.payment.id },
        data: { status: "REFUNDED" },
      });

      if (prepared.payment.tournamentId) {
        const cancelled = await tx.tournamentRegistration.updateMany({
          where: { paymentId: prepared.payment.id, status: "CONFIRMED" },
          data: { status: "REFUNDED" },
        });
        if (cancelled.count > 0) {
          await tx.tournament.update({
            where: { id: prepared.payment.tournamentId },
            data: { currentParticipants: { decrement: cancelled.count } },
          });
        }
      }

      await createLedgerTransactionInTransaction(tx, {
        userId: prepared.payment.userId,
        amount: prepared.payment.amount,
        type: "REFUND",
        status: "COMPLETED",
        tournamentId: prepared.payment.tournamentId ?? undefined,
        telegramPaymentId: prepared.payment.telegramPaymentRef ?? undefined,
        description: "Tournament entry refund",
      });
      await tx.notification.create({
        data: {
          userId: prepared.payment.userId,
          type: "PAYMENT",
          title: "Tournament refund completed",
          message: "Your Telegram Stars refund has been processed.",
          metadata: { paymentId: prepared.payment.id, refundId: refund.id },
          telegramDeliveryEligible: true,
        },
      });
    }, { isolationLevel: "Serializable", maxWait: 5_000, timeout: 10_000 });

    await dispatchTelegramNotificationsCreatedSince(notificationSince);
    revalidatePath("/wallet");
    return { success: true };
  } catch (error) {
    if (error instanceof PaymentActionError) {
      return { success: false, error: paymentErrorMessage(error.code) };
    }
    if (error instanceof Error && (error.message === "UNAUTHENTICATED" || error.message === "FORBIDDEN")) {
      return { success: false, error: "You do not have permission to refund payments." };
    }
    console.error("Telegram Stars refund failed", error);
    return { success: false, error: "The refund could not be completed. Review the payment before retrying." };
  }
}
