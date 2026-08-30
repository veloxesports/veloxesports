"use server";

import { z } from "zod";
import { clearSession, createSession } from "@/lib/auth/session";
import { prisma } from "@/lib/database/prisma";
import { validateTelegramWebAppData } from "@/lib/telegram/auth";
import { ensureReferralCode } from "@/features/referrals/service";

const initDataSchema = z.string().trim().min(1).max(4_096);

export async function authenticateTelegram(initData: unknown) {
  const parsedInitData = initDataSchema.safeParse(initData);
  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  if (!parsedInitData.success || !botToken) {
    return { success: false, error: "Telegram authentication is unavailable." };
  }

  const verification = validateTelegramWebAppData(parsedInitData.data, botToken);
  const telegramUser = verification.data;
  if (!verification.isValid || !telegramUser?.id || !telegramUser.first_name) {
    return { success: false, error: "We couldn't verify your Telegram session." };
  }

  try {
    const user = await prisma.$transaction(async (tx) => {
      const account = await tx.user.upsert({
        where: { telegramId: String(telegramUser.id) },
        update: {
          username: telegramUser.username ?? null,
          firstName: telegramUser.first_name,
          lastName: telegramUser.last_name ?? null,
          languageCode: telegramUser.language_code ?? null,
          profileImage: telegramUser.photo_url ?? null,
          isPremium: telegramUser.is_premium ?? false,
          lastLogin: new Date(),
        },
        create: {
          telegramId: String(telegramUser.id),
          username: telegramUser.username ?? null,
          firstName: telegramUser.first_name,
          lastName: telegramUser.last_name ?? null,
          languageCode: telegramUser.language_code ?? null,
          profileImage: telegramUser.photo_url ?? null,
          isPremium: telegramUser.is_premium ?? false,
          lastLogin: new Date(),
          profile: { create: { favoriteGames: [] } },
          wallet: { create: {} },
        },
        select: { id: true, telegramId: true, firstName: true, username: true, status: true },
      });

      await ensureReferralCode(tx, account.id);

      return account;
    });

    if (user.status !== "ACTIVE") {
      return { success: false, error: "This VELOX account is not currently available." };
    }

    await createSession(user.id, user.telegramId);
    return { success: true, data: { firstName: user.firstName, username: user.username } };
  } catch (error) {
    console.error("Telegram authentication failed", error);
    return { success: false, error: "We couldn't sign you in. Please try again." };
  }
}

export async function logout() {
  await clearSession();
  return { success: true };
}
