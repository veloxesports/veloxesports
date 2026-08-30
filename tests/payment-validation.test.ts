import { describe, expect, it } from "vitest";
import { canAcceptTournamentRegistration, isVerifiedStarsPaymentEvent, paymentIdFromInvoicePayload } from "../src/lib/payments/validation";

const payment = { status: "PENDING", invoicePayload: "velox:123e4567-e89b-42d3-a456-426614174000", currency: "XTR", amount: 100, userTelegramId: "42" };
const successfulPayment = { invoice_payload: "velox:123e4567-e89b-42d3-a456-426614174000", currency: "XTR", total_amount: 100 };

describe("Telegram Stars verification invariants", () => {
  it("accepts only the pending payment belonging to the Telegram sender", () => {
    expect(isVerifiedStarsPaymentEvent({ payment, senderTelegramId: 42, successfulPayment })).toBe(true);
  });

  it("rejects a fake frontend success for a different Telegram user or amount", () => {
    expect(isVerifiedStarsPaymentEvent({ payment, senderTelegramId: 99, successfulPayment })).toBe(false);
    expect(isVerifiedStarsPaymentEvent({ payment, senderTelegramId: 42, successfulPayment: { ...successfulPayment, total_amount: 1 } })).toBe(false);
  });

  it("requires a valid VELOX invoice UUID payload", () => {
    expect(paymentIdFromInvoicePayload(successfulPayment.invoice_payload)).toBe("123e4567-e89b-42d3-a456-426614174000");
    expect(paymentIdFromInvoicePayload("payment:123")).toBeNull();
  });

  it("rejects registrations after deadline or capacity", () => {
    const now = new Date("2026-08-30T12:00:00Z");
    expect(canAcceptTournamentRegistration({ status: "REGISTRATION_OPEN", registrationDeadline: new Date("2026-08-30T13:00:00Z"), currentParticipants: 7, maxParticipants: 8 }, now)).toBe(true);
    expect(canAcceptTournamentRegistration({ status: "REGISTRATION_OPEN", registrationDeadline: new Date("2026-08-30T11:00:00Z"), currentParticipants: 7, maxParticipants: 8 }, now)).toBe(false);
    expect(canAcceptTournamentRegistration({ status: "REGISTRATION_OPEN", registrationDeadline: new Date("2026-08-30T13:00:00Z"), currentParticipants: 8, maxParticipants: 8 }, now)).toBe(false);
  });
});
