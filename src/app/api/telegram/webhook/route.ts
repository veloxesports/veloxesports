import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { createLedgerTransaction } from "@/features/wallet/services";

export async function POST(req: NextRequest) {
  try {
    const update = await req.json();

    // Handle pre_checkout_query (Telegram asks if we are ready to process)
    if (update.pre_checkout_query) {
      const queryId = update.pre_checkout_query.id;
      // We accept all checkout queries for now.
      // In production, we'd verify the payload matches an existing pending payment record
      // and that the tournament still has slots.
      
      const responsePayload = JSON.stringify({
        ok: true,
        pre_checkout_query_id: queryId,
      });

      // We need to reply to the Telegram API. Usually done via a POST back to Telegram,
      // but some webhook architectures allow returning it in the response.
      // For Next.js, we should probably call fetch(`https://api.telegram.org/bot${token}/answerPreCheckoutQuery`)
      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      if (botToken) {
        await fetch(`https://api.telegram.org/bot${botToken}/answerPreCheckoutQuery`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pre_checkout_query_id: queryId, ok: true }),
        });
      }

      return NextResponse.json({ ok: true });
    }

    // Handle successful_payment (Message contains successful_payment object)
    if (update.message && update.message.successful_payment) {
      const payment = update.message.successful_payment;
      const payload = payment.invoice_payload; // Custom payload we set during createInvoiceLink
      const telegramPaymentChargeId = payment.telegram_payment_charge_id;
      const providerPaymentChargeId = payment.provider_payment_charge_id;

      // Extract our internal reference from payload
      let internalPaymentId = "";
      try {
        const parsed = JSON.parse(payload);
        internalPaymentId = parsed.paymentId;
      } catch (e) {
        console.error("Invalid payment payload", payload);
        return NextResponse.json({ ok: false }, { status: 400 });
      }

      // Idempotency check using PaymentEvent
      const existingEvent = await prisma.paymentEvent.findUnique({
        where: { idempotencyKey: telegramPaymentChargeId }
      });

      if (existingEvent) {
        return NextResponse.json({ ok: true }); // Already processed
      }

      // Process payment in a transaction
      await prisma.$transaction(async (tx) => {
        // 1. Fetch our internal payment record
        const pendingPayment = await tx.telegramPayment.findUnique({
          where: { id: internalPaymentId },
          include: { tournament: true }
        });

        if (!pendingPayment || pendingPayment.status === "COMPLETED") {
          return; // Ignore
        }

        // 2. Mark payment as completed
        await tx.telegramPayment.update({
          where: { id: internalPaymentId },
          data: { 
            status: "COMPLETED", 
            telegramPaymentRef: telegramPaymentChargeId,
            completedAt: new Date()
          }
        });

        // 3. Register user for tournament
        if (pendingPayment.tournamentId) {
          const t = await tx.tournament.findUnique({ where: { id: pendingPayment.tournamentId } });
          if (t && t.currentParticipants < t.maxParticipants) {
            await tx.tournamentRegistration.create({
              data: {
                tournamentId: pendingPayment.tournamentId,
                userId: pendingPayment.userId,
                status: "CONFIRMED",
                paymentId: pendingPayment.id
              }
            });

            await tx.tournament.update({
              where: { id: pendingPayment.tournamentId },
              data: { currentParticipants: { increment: 1 } }
            });
          } else {
            // Edge case: tournament got full while payment was processing
            // In a real system, we'd trigger an automatic refund here.
            console.error("Tournament full after payment. Need manual refund for:", internalPaymentId);
          }
        }

        // 4. Update Wallet Ledger
        await createLedgerTransaction({
          userId: pendingPayment.userId,
          amount: pendingPayment.amount,
          type: "TOURNAMENT_ENTRY",
          status: "COMPLETED",
          tournamentId: pendingPayment.tournamentId || undefined,
          telegramPaymentId: telegramPaymentChargeId,
          description: `Entry fee for ${pendingPayment.tournament?.title}`,
        });

        // 5. Record Event for idempotency
        await tx.paymentEvent.create({
          data: {
            paymentId: pendingPayment.id,
            eventType: "successful_payment",
            payload: update,
            idempotencyKey: telegramPaymentChargeId
          }
        });
      });

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json({ ok: false, error: "Internal Error" }, { status: 500 });
  }
}
