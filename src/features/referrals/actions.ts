"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/database/prisma";
import { requireCurrentUser } from "@/lib/auth/current-user";
import { createLedgerTransactionInTransaction } from "@/features/wallet/services";
import { ensureReferralCode } from "./service";
import { dispatchTelegramNotificationsCreatedSince } from "@/lib/notifications/delivery";

const referralCodeSchema = z.string().trim().toUpperCase().regex(/^[A-Z0-9]{8}$/);

async function getReferralReward() {
  const setting = await prisma.systemSetting.findUnique({ where: { key: "referral_reward_xtr" }, select: { value: true } });
  const value = typeof setting?.value === "number" ? setting.value : 0;
  return Number.isInteger(value) && value >= 0 && value <= 100_000 ? value : 0;
}

export async function getMyReferral() {
  try {
    const user = await requireCurrentUser();
    const result = await prisma.$transaction(async (tx) => {
      const code = await ensureReferralCode(tx, user.id);
      const referrals = await tx.referral.findMany({
        where: { referrerId: user.id, referredUserId: { not: null } },
        select: { id: true, status: true, rewardAmount: true, completedAt: true, referredUser: { select: { username: true, firstName: true } } },
        orderBy: { completedAt: "desc" },
      });
      return { code, referrals };
    });
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") return { success: false, error: "Sign in with Telegram to use referrals." };
    console.error("Referral fetch failed", error);
    return { success: false, error: "We couldn't load your referral details." };
  }
}

export async function redeemReferralCode(code: unknown) {
  const parsed = referralCodeSchema.safeParse(code);
  if (!parsed.success) return { success: false, error: "Enter an 8-character referral code." };

  try {
    const notificationSince = new Date();
    const user = await requireCurrentUser();
    const rewardAmount = await getReferralReward();
    const referral = await prisma.$transaction(async (tx) => {
      const existingReferral = await tx.referral.findUnique({ where: { referredUserId: user.id }, select: { id: true } });
      if (existingReferral) throw new Error("REFERRAL_ALREADY_USED");

      const source = await tx.referral.findUnique({ where: { code: parsed.data } });
      if (!source || source.referredUserId || source.status !== "PENDING") throw new Error("REFERRAL_INVALID");
      if (source.referrerId === user.id) throw new Error("REFERRAL_SELF");

      const claimed = await tx.referral.updateMany({
        where: { id: source.id, referredUserId: null, status: "PENDING" },
        data: { referredUserId: user.id, status: "COMPLETED", rewardAmount, completedAt: new Date() },
      });
      if (claimed.count !== 1) throw new Error("REFERRAL_INVALID");

      if (rewardAmount > 0) {
        await createLedgerTransactionInTransaction(tx, {
          userId: source.referrerId,
          amount: rewardAmount,
          type: "BONUS",
          status: "COMPLETED",
          description: "Referral promotion bonus",
        });
      }
      await tx.notification.create({
        data: {
          userId: source.referrerId,
          type: "SYSTEM",
          title: "Referral completed",
          message: "A player you invited joined VELOX.",
          metadata: { referralId: source.id },
          telegramDeliveryEligible: true,
        },
      });
      return source.id;
    }, { isolationLevel: "Serializable", maxWait: 5_000, timeout: 10_000 });
    await dispatchTelegramNotificationsCreatedSince(notificationSince);
    revalidatePath("/referrals");
    revalidatePath("/wallet");
    return { success: true, data: { referralId: referral } };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const known: Record<string, string> = {
      UNAUTHENTICATED: "Open VELOX in Telegram to redeem a referral.",
      REFERRAL_ALREADY_USED: "You have already redeemed a referral code.",
      REFERRAL_INVALID: "That referral code is invalid or has already been used.",
      REFERRAL_SELF: "You cannot use your own referral code.",
    };
    if (known[message]) return { success: false, error: known[message] };
    console.error("Referral redemption failed", error);
    return { success: false, error: "We couldn't redeem this referral. Please try again." };
  }
}
