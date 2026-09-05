import { z } from "zod";

export const invoicePayloadSchema = z.string().regex(/^(?:khemora|velox):[0-9a-f-]{36}$/i);

export type TournamentAvailability = {
  status: string;
  registrationDeadline: Date;
  currentParticipants: number;
  maxParticipants: number;
};

export function paymentIdFromInvoicePayload(payload: string) {
  const parsed = invoicePayloadSchema.safeParse(payload);
  return parsed.success ? payload.replace(/^(?:khemora|velox):/i, "") : null;
}

export function canAcceptTournamentRegistration(tournament: TournamentAvailability, now = new Date()) {
  return tournament.status === "REGISTRATION_OPEN"
    && tournament.registrationDeadline > now
    && tournament.currentParticipants < tournament.maxParticipants;
}

export function isVerifiedStarsPaymentEvent(input: {
  payment: {
    status: string;
    invoicePayload: string | null;
    currency: string;
    amount: number;
    userTelegramId: string;
  };
  senderTelegramId: number;
  successfulPayment: {
    invoice_payload: string;
    currency: string;
    total_amount: number;
  };
}) {
  const { payment, senderTelegramId, successfulPayment } = input;
  return payment.status === "PENDING"
    && payment.invoicePayload === successfulPayment.invoice_payload
    && payment.userTelegramId === String(senderTelegramId)
    && payment.currency === successfulPayment.currency
    && payment.amount === successfulPayment.total_amount;
}
