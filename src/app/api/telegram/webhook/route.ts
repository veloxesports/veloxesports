import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/database/prisma";
import { Prisma } from "@/lib/generated/prisma/client";
import { answerPreCheckoutQuery, refundTelegramStarsPayment } from "@/lib/telegram/bot";
import { createLedgerTransactionInTransaction } from "@/features/wallet/services";
import { canAcceptTournamentRegistration, invoicePayloadSchema, isVerifiedStarsPaymentEvent, paymentIdFromInvoicePayload } from "@/lib/payments/validation";
import { TournamentParticipantType } from "@/lib/generated/prisma/client";
import { validateTeamEntry } from "@/lib/tournaments/team-registration";
import { dispatchTelegramNotificationsCreatedSince } from "@/lib/notifications/delivery";
import { handleBotCallbackQuery, handleBotStartCommand } from "@/lib/telegram/onboarding";

export const runtime = "nodejs";

const preCheckoutSchema = z.object({
  id: z.string().min(1),
  from: z.object({ id: z.number().int().positive() }),
  currency: z.literal("XTR"),
  total_amount: z.number().int().positive(),
  invoice_payload: invoicePayloadSchema,
});

const successfulPaymentSchema = z.object({
  invoice_payload: invoicePayloadSchema,
  telegram_payment_charge_id: z.string().min(1),
  provider_payment_charge_id: z.string().optional(),
  currency: z.literal("XTR"),
  total_amount: z.number().int().positive(),
});

const telegramUserSchema = z.object({
  id: z.number().int().positive(),
  is_bot: z.boolean().optional(),
  first_name: z.string(),
  last_name: z.string().optional(),
  username: z.string().optional(),
  language_code: z.string().optional(),
});

const telegramChatSchema = z.object({
  id: z.number().int(),
  type: z.string(),
  title: z.string().optional(),
  username: z.string().optional(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
});

const callbackQuerySchema = z.object({
  id: z.string(),
  from: telegramUserSchema,
  message: z.object({
    message_id: z.number().int(),
    chat: telegramChatSchema,
  }).optional(),
  data: z.string().optional(),
});

const updateSchema = z.object({
  pre_checkout_query: preCheckoutSchema.optional(),
  message: z.object({
    message_id: z.number().int().optional(),
    from: telegramUserSchema.optional(),
    chat: telegramChatSchema.optional(),
    text: z.string().optional(),
    successful_payment: successfulPaymentSchema.optional(),
  }).optional(),
  callback_query: callbackQuerySchema.optional(),
}).passthrough();

function hasValidWebhookSecret(request: NextRequest) {
  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const actualSecret = request.headers.get("x-telegram-bot-api-secret-token");
  if (!expectedSecret || !actualSecret) return false;

  const expected = Buffer.from(expectedSecret);
  const actual = Buffer.from(actualSecret);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

async function replyToPreCheckout(query: z.infer<typeof preCheckoutSchema>) {
  const payment = await prisma.telegramPayment.findUnique({
    where: { id: paymentIdFromInvoicePayload(query.invoice_payload)! },
    include: { user: { select: { telegramId: true } }, tournament: true },
  });

  const tournament = payment?.tournament;
  const isEligible = Boolean(
    payment &&
      tournament &&
      payment.status === "PENDING" &&
      payment.invoicePayload === query.invoice_payload &&
      payment.user.telegramId === String(query.from.id) &&
      payment.currency === query.currency &&
      payment.amount === query.total_amount &&
      canAcceptTournamentRegistration(tournament, new Date()),
  );

  await answerPreCheckoutQuery({
    preCheckoutQueryId: query.id,
    ok: isEligible,
    errorMessage: isEligible ? undefined : "This tournament entry is no longer available.",
  });
}

async function finalizeCapacityRefund(payment: {
  id: string;
  userId: string;
  telegramId: string;
  tournamentId: string | null;
  amount: number;
  telegramPaymentRef: string;
}) {
  try {
    await refundTelegramStarsPayment({
      telegramUserId: payment.telegramId,
      telegramPaymentChargeId: payment.telegramPaymentRef,
    });

    await prisma.$transaction(async (tx) => {
      const refund = await tx.refund.findUnique({ where: { paymentId: payment.id } });
      if (!refund || refund.status !== "PENDING") return;

      await tx.refund.update({
        where: { id: refund.id },
        data: {
          status: "COMPLETED",
          telegramRefundRef: payment.telegramPaymentRef,
          completedAt: new Date(),
        },
      });
      await tx.telegramPayment.update({
        where: { id: payment.id },
        data: { status: "REFUNDED" },
      });
      await createLedgerTransactionInTransaction(tx, {
        userId: payment.userId,
        amount: payment.amount,
        type: "REFUND",
        status: "COMPLETED",
        tournamentId: payment.tournamentId ?? undefined,
        telegramPaymentId: payment.telegramPaymentRef,
        description: "Automatic refund: tournament reached capacity",
      });
    }, { isolationLevel: "Serializable", maxWait: 5_000, timeout: 10_000 });
  } catch (error) {
    // The payment and a PENDING refund are retained for safe reconciliation.
    // Never retry blindly after an ambiguous remote refund outcome.
    console.error("Automatic capacity refund requires reconciliation", { paymentId: payment.id, error });
  }
}

async function processSuccessfulPayment(
  update: z.infer<typeof updateSchema>,
  messageFromId: number,
  successfulPayment: z.infer<typeof successfulPaymentSchema>,
) {
  const notificationSince = new Date();
  const paymentId = paymentIdFromInvoicePayload(successfulPayment.invoice_payload);
  if (!paymentId) throw new Error("INVALID_PAYMENT_EVENT");
  const outcome = await prisma.$transaction(async (tx) => {
    const payment = await tx.telegramPayment.findUnique({
      where: { id: paymentId },
      include: {
        tournament: true,
        user: { select: { telegramId: true } },
      },
    });

    if (!payment || payment.status !== "PENDING") return { kind: "IGNORED" as const };
    if (!isVerifiedStarsPaymentEvent({
      payment: {
        status: payment.status,
        invoicePayload: payment.invoicePayload,
        userTelegramId: payment.user.telegramId,
        currency: payment.currency,
        amount: payment.amount,
      },
      senderTelegramId: messageFromId,
      successfulPayment,
    })) {
      throw new Error("INVALID_PAYMENT_EVENT");
    }

    // Inserting this first turns Telegram's at-least-once delivery into exactly-once processing.
    await tx.paymentEvent.create({
      data: {
        paymentId: payment.id,
        eventType: "successful_payment",
        payload: JSON.parse(JSON.stringify(update)) as Prisma.InputJsonValue,
        idempotencyKey: successfulPayment.telegram_payment_charge_id,
      },
    });

    await tx.telegramPayment.update({
      where: { id: payment.id },
      data: {
        status: "COMPLETED",
        telegramPaymentRef: successfulPayment.telegram_payment_charge_id,
        completedAt: new Date(),
        metadata: successfulPayment.provider_payment_charge_id
          ? { providerPaymentChargeId: successfulPayment.provider_payment_charge_id }
          : undefined,
      },
    });

    if (!payment.tournamentId || !payment.tournament) {
      throw new Error("PAYMENT_WITHOUT_TOURNAMENT");
    }

    let teamId: string | null = null;
    if (payment.tournament.participantType === TournamentParticipantType.TEAM) {
      try {
        if (!payment.teamId) throw new Error("TEAM_NOT_FOUND");
        teamId = (await validateTeamEntry(tx, payment.tournament, payment.userId, payment.teamId)).teamId;
      } catch (error) {
        const reason = error instanceof Error ? error.message : "TEAM_ROSTER_INVALID";
        await tx.refund.create({
          data: {
            paymentId: payment.id,
            amount: payment.amount,
            status: "PENDING",
            reason: `Team registration could not be validated: ${reason}.`,
          },
        });
        await tx.notification.create({
          data: {
            userId: payment.userId,
            type: "PAYMENT",
            title: "Team entry requires a refund",
            message: "Your selected team roster changed before payment verification. Khemora is returning the entry fee.",
            metadata: { tournamentId: payment.tournamentId, paymentId: payment.id },
            telegramDeliveryEligible: true,
          },
        });
        return {
          kind: "REFUND_REQUIRED" as const,
          payment: {
            id: payment.id,
            userId: payment.userId,
            telegramId: payment.user.telegramId,
            tournamentId: payment.tournamentId,
            amount: payment.amount,
            telegramPaymentRef: successfulPayment.telegram_payment_charge_id,
          },
        };
      }
    }

    const registration = await tx.tournamentRegistration.create({
      data: {
        tournamentId: payment.tournamentId,
        userId: payment.userId,
        teamId,
        paymentId: payment.id,
        status: "CONFIRMED",
      },
    });

    const capacityUpdate = await tx.tournament.updateMany({
      where: {
        id: payment.tournamentId,
        status: "REGISTRATION_OPEN",
        registrationDeadline: { gt: new Date() },
        currentParticipants: { lt: payment.tournament.maxParticipants },
      },
      data: { currentParticipants: { increment: 1 } },
    });

    await createLedgerTransactionInTransaction(tx, {
      userId: payment.userId,
      amount: payment.amount,
      type: "TOURNAMENT_ENTRY",
      status: "COMPLETED",
      tournamentId: payment.tournamentId,
      telegramPaymentId: successfulPayment.telegram_payment_charge_id,
      description: `Entry fee for ${payment.tournament.title}`,
    });

    if (capacityUpdate.count === 1) {
      await tx.notification.create({
        data: {
          userId: payment.userId,
          type: "PAYMENT",
          title: "Tournament entry confirmed",
          message: `Your entry for ${payment.tournament.title} is confirmed.`,
          metadata: { tournamentId: payment.tournamentId, paymentId: payment.id },
          telegramDeliveryEligible: true,
        },
      });
      return { kind: "COMPLETED" as const, tournamentSlug: payment.tournament.slug };
    }

    // Remove the unconfirmed registration and create a durable refund request.
    // The remote refund is handled after this transaction commits.
    await tx.tournamentRegistration.delete({ where: { id: registration.id } });
    await tx.refund.create({
      data: {
        paymentId: payment.id,
        amount: payment.amount,
        status: "PENDING",
        reason: "Tournament reached capacity after checkout.",
      },
    });
    await tx.notification.create({
      data: {
        userId: payment.userId,
        type: "PAYMENT",
        title: "Tournament entry refunded",
        message: `${payment.tournament?.title ?? "Tournament"} reached maximum capacity before payment verification. Your Telegram Stars were refunded.`,
        metadata: { paymentId: payment.id, tournamentId: payment.tournamentId },
        telegramDeliveryEligible: true,
      },
    });

    return {
      kind: "REFUND_REQUIRED" as const,
      payment: {
        id: payment.id,
        userId: payment.userId,
        telegramId: payment.user.telegramId,
        tournamentId: payment.tournamentId,
        amount: payment.amount,
        telegramPaymentRef: successfulPayment.telegram_payment_charge_id,
      },
    };
  }, { isolationLevel: "Serializable", maxWait: 5_000, timeout: 10_000 });

  if (outcome.kind === "REFUND_REQUIRED") {
    await finalizeCapacityRefund(outcome.payment);
  }
  await dispatchTelegramNotificationsCreatedSince(notificationSince);

  return outcome;
}

export async function POST(request: NextRequest) {
  if (!hasValidWebhookSecret(request)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (!Number.isFinite(contentLength) || contentLength > 1_000_000) {
    return NextResponse.json({ ok: false }, { status: 413 });
  }

  try {
    const parsed = updateSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });

    if (parsed.data.pre_checkout_query) {
      await replyToPreCheckout(parsed.data.pre_checkout_query);
      return NextResponse.json({ ok: true });
    }

    if (parsed.data.callback_query) {
      try {
        await handleBotCallbackQuery(parsed.data.callback_query);
      } catch (error) {
        console.error("Telegram callback query handler error", error);
      }
      return NextResponse.json({ ok: true });
    }

    const successfulPayment = parsed.data.message?.successful_payment;
    const messageFromId = parsed.data.message?.from?.id;
    if (successfulPayment && messageFromId) {
      try {
        await processSuccessfulPayment(parsed.data, messageFromId, successfulPayment);
      } catch (error) {
        // A unique payment-event collision means Telegram retried a payment we already handled.
        if (!(error instanceof Error && "code" in error && error.code === "P2002")) throw error;
      }
      return NextResponse.json({ ok: true });
    }

    const message = parsed.data.message;
    if (message?.text && message.from && message.chat) {
      try {
        await handleBotStartCommand({
          messageId: message.message_id ?? 0,
          from: message.from,
          chat: message.chat,
          text: message.text,
        });
      } catch (error) {
        console.error("Telegram start command handler error", error);
      }
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Telegram webhook processing failed", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
