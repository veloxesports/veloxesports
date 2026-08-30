import "server-only";

import crypto from "node:crypto";
import { Prisma } from "@/lib/generated/prisma/client";

function createReferralCode() {
  return crypto.randomBytes(5).toString("hex").toUpperCase().slice(0, 8);
}

export async function ensureReferralCode(tx: Prisma.TransactionClient, userId: string) {
  const existing = await tx.referral.findFirst({
    where: { referrerId: userId, referredUserId: null, status: "PENDING" },
    select: { code: true },
  });
  if (existing) return existing.code;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const referral = await tx.referral.create({ data: { referrerId: userId, code: createReferralCode() } });
      return referral.code;
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "P2002")) throw error;
    }
  }
  throw new Error("REFERRAL_CODE_UNAVAILABLE");
}
