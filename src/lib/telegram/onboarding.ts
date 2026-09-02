import fs from "node:fs/promises";
import path from "node:path";
import {
  answerCallbackQuery,
  editTelegramMessageMedia,
  sendTelegramPhoto,
} from "@/lib/telegram/bot";

async function getPrisma() {
  const { prisma } = await import("@/lib/database/prisma");
  return prisma;
}

let heroBufferCache: Buffer | null = null;
let competeBufferCache: Buffer | null = null;

export async function getWelcomeHeroImage(): Promise<Buffer | string> {
  if (heroBufferCache) return heroBufferCache;
  try {
    const filePath = path.join(process.cwd(), "public", "images", "velox-welcome-hero.jpg");
    heroBufferCache = await fs.readFile(filePath);
    return heroBufferCache;
  } catch (err) {
    console.warn("Could not read local welcome hero image, falling back to public URL", err);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
    return appUrl ? `${appUrl}/images/velox-welcome-hero.jpg` : "";
  }
}

export async function getCompetePromoImage(): Promise<Buffer | string> {
  if (competeBufferCache) return competeBufferCache;
  try {
    const filePath = path.join(process.cwd(), "public", "images", "velox-compete-promo.jpg");
    competeBufferCache = await fs.readFile(filePath);
    return competeBufferCache;
  } catch (err) {
    console.warn("Could not read local compete promo image, falling back to public URL", err);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
    return appUrl ? `${appUrl}/images/velox-compete-promo.jpg` : "";
  }
}

export function getMiniAppUrl(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) {
    try {
      const url = new URL(configured);
      if (url.protocol === "https:") {
        return url.toString();
      }
    } catch {
      // ignore
    }
  }
  return "https://veloxesports.com";
}

export function getCommunityUrl(): string {
  const configured = process.env.TELEGRAM_COMMUNITY_URL?.trim();
  if (configured) {
    try {
      const url = new URL(configured);
      if (url.protocol === "https:" || url.protocol === "http:") {
        return url.toString();
      }
    } catch {
      // ignore
    }
  }
  return "https://t.me/veloxesports";
}

export function getWelcomeCardCaption(): string {
  return [
    "<b>Welcome to VELOX 🎮🏆</b>",
    "<i>The Premier Esports Arena on Telegram</i>",
    "",
    "Discover high-stakes tournaments, challenge real opponents, track brackets, and win verified prizes—all inside Telegram.",
    "",
    "⚡ <b>What You Can Do:</b>",
    "• <b>Discover Tournaments</b> — Free &amp; premium competitive events",
    "• <b>Register &amp; Compete</b> — Join solo or squad up with a team",
    "• <b>Follow Brackets</b> — Live fixtures, pairings &amp; schedules",
    "• <b>Submit Results</b> — Fast score submission &amp; evidence verification",
    "• <b>Track Progress</b> — Global rankings, leaderboards &amp; XP tiers",
    "• <b>Win Prizes</b> — Verified payouts &amp; Telegram Stars rewards",
    "",
    "⚔️ <b>How It Works:</b>",
    "1️⃣ <b>Join or register</b> for a tournament",
    "2️⃣ <b>Check your scheduled matches</b> in Match Center",
    "3️⃣ <b>Play against your opponent</b> in-game",
    "4️⃣ <b>Submit/confirm the result</b> with match proof",
    "5️⃣ <b>Advance through the bracket</b> to become the champion",
    "",
    "Tap below to start your competitive journey.",
  ].join("\n");
}

export function getWelcomeCardKeyboard() {
  return {
    inline_keyboard: [
      [
        {
          text: "🚀 START",
          callback_data: "onboarding_start",
        },
      ],
    ],
  };
}

export function getCompeteCardCaption(): string {
  return [
    "<b>🔥 Ready to Compete?</b>",
    "<i>Your tournament journey begins now.</i>",
    "",
    "Join competitive tournaments, challenge other players, climb the brackets, and prove yourself.",
    "",
    "⚡ <b>In the App:</b>",
    "• Register for upcoming tournaments",
    "• Review active brackets and live matches",
    "• Build or manage your competitive squad",
    "• Climb global leaderboards and claim rewards",
    "",
    "Tap <b>OPEN THE APP</b> below to step onto the main stage!",
  ].join("\n");
}

export function getCompeteCardKeyboard() {
  const miniAppUrl = getMiniAppUrl();
  const communityUrl = getCommunityUrl();

  return {
    inline_keyboard: [
      [
        {
          text: "🎮 OPEN THE APP",
          web_app: { url: miniAppUrl },
        },
      ],
      [
        {
          text: "👥 JOIN COMMUNITY",
          url: communityUrl,
        },
      ],
    ],
  };
}

export function isFirstTimeUser(user: {
  createdAt: Date;
  lastLogin: Date | null;
  profile: { gamerIds: unknown } | null;
}): boolean {
  const gamerIds = user.profile?.gamerIds;
  if (gamerIds && typeof gamerIds === "object" && !Array.isArray(gamerIds)) {
    const record = gamerIds as Record<string, unknown>;
    if (record.botOnboarded === true) return false;
    if (record.botOnboarded === false) return true;
  }

  if (user.lastLogin) return false;
  return true;
}

export async function sendWelcomeCard(chatId: number | string) {
  const photo = await getWelcomeHeroImage();
  return sendTelegramPhoto({
    chatId,
    photo,
    caption: getWelcomeCardCaption(),
    parseMode: "HTML",
    replyMarkup: getWelcomeCardKeyboard(),
  });
}

export async function sendCompeteCard(chatId: number | string, messageId?: number) {
  const photo = await getCompetePromoImage();
  const caption = getCompeteCardCaption();
  const replyMarkup = getCompeteCardKeyboard();

  if (messageId) {
    try {
      return await editTelegramMessageMedia({
        chatId,
        messageId,
        photo,
        caption,
        parseMode: "HTML",
        replyMarkup,
      });
    } catch (err) {
      console.warn("Could not edit message media in-place, falling back to sendPhoto", err);
    }
  }

  return sendTelegramPhoto({
    chatId,
    photo,
    caption,
    parseMode: "HTML",
    replyMarkup,
  });
}

export async function markBotOnboarded(telegramUserId: string | number) {
  const telegramId = String(telegramUserId);
  const prisma = await getPrisma();
  const user = await prisma.user.findUnique({
    where: { telegramId },
    select: { id: true, profile: { select: { gamerIds: true } } },
  });
  if (!user) return;

  const currentGamerIds =
    user.profile?.gamerIds && typeof user.profile.gamerIds === "object" && !Array.isArray(user.profile.gamerIds)
      ? (user.profile.gamerIds as Record<string, unknown>)
      : {};

  await prisma.userProfile.upsert({
    where: { userId: user.id },
    update: {
      gamerIds: {
        ...currentGamerIds,
        botOnboarded: true,
        botOnboardedAt: new Date().toISOString(),
      },
    },
    create: {
      userId: user.id,
      favoriteGames: [],
      gamerIds: {
        botOnboarded: true,
        botOnboardedAt: new Date().toISOString(),
      },
    },
  });
}

async function tryRedeemReferral(userId: string, refCodeCandidate?: string | null) {
  if (!refCodeCandidate) return;
  const cleanCode = refCodeCandidate.replace(/^ref_/, "").trim().toUpperCase();
  if (!/^[A-Z0-9]{8}$/.test(cleanCode)) return;

  try {
    const prisma = await getPrisma();
    const { createLedgerTransactionInTransaction } = await import("@/features/wallet/services");
    await prisma.$transaction(async (tx) => {
      const existing = await tx.referral.findUnique({ where: { referredUserId: userId } });
      if (existing) return;

      const source = await tx.referral.findUnique({ where: { code: cleanCode } });
      if (!source || source.referredUserId || source.status !== "PENDING" || source.referrerId === userId) return;

      const setting = await tx.systemSetting.findUnique({ where: { key: "referral_reward_xtr" }, select: { value: true } });
      const rewardAmount = typeof setting?.value === "number" && setting.value > 0 ? setting.value : 0;

      await tx.referral.update({
        where: { id: source.id },
        data: {
          referredUserId: userId,
          status: "COMPLETED",
          rewardAmount,
          completedAt: new Date(),
        },
      });

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
          message: "A player you invited joined VELOX via Telegram.",
          metadata: { referralId: source.id },
          telegramDeliveryEligible: true,
        },
      });
    });
  } catch (err) {
    console.warn("Failed to automatically redeem referral during bot onboarding", err);
  }
}

export async function handleBotStartCommand(input: {
  messageId: number;
  from: {
    id: number;
    first_name: string;
    last_name?: string;
    username?: string;
    language_code?: string;
  };
  chat: {
    id: number;
  };
  text?: string;
}) {
  const telegramId = String(input.from.id);
  const rawText = input.text?.trim() || "";
  const startArg = rawText.split(/\s+/)[1] || "";

  const prisma = await getPrisma();
  let user = await prisma.user.findUnique({
    where: { telegramId },
    include: { profile: true },
  });

  const isNew = !user;

  if (!user) {
    user = await prisma.user.create({
      data: {
        telegramId,
        username: input.from.username ?? null,
        firstName: input.from.first_name,
        lastName: input.from.last_name ?? null,
        languageCode: input.from.language_code ?? null,
        role: "PLAYER",
        status: "ACTIVE",
        profile: {
          create: {
            veloxUsername: input.from.username ?? null,
            favoriteGames: [],
            gamerIds: { botOnboarded: false },
          },
        },
        wallet: { create: {} },
      },
      include: { profile: true },
    });

    const { ensureReferralCode } = await import("@/features/referrals/service");
    await prisma.$transaction(async (tx) => {
      await ensureReferralCode(tx, user!.id);
    });

    if (startArg) {
      await tryRedeemReferral(user.id, startArg);
    }
  }

  const wantsRestart =
    startArg.toLowerCase() === "onboarding" ||
    startArg.toLowerCase() === "guide" ||
    rawText.toLowerCase() === "/onboarding" ||
    rawText.toLowerCase() === "/guide";

  if (isNew || isFirstTimeUser(user) || wantsRestart) {
    await sendWelcomeCard(input.chat.id);
  } else {
    await sendCompeteCard(input.chat.id);
  }
}

export async function handleBotCallbackQuery(input: {
  id: string;
  from: {
    id: number;
    first_name: string;
    last_name?: string;
    username?: string;
  };
  message?: {
    message_id: number;
    chat: {
      id: number;
    };
  };
  data?: string;
}) {
  const queryId = input.id;
  const data = input.data;

  if (data === "onboarding_start") {
    await answerCallbackQuery({ callbackQueryId: queryId });
    await markBotOnboarded(input.from.id);

    if (input.message) {
      await sendCompeteCard(input.message.chat.id, input.message.message_id);
    } else {
      await sendCompeteCard(input.from.id);
    }
    return;
  }

  if (data === "onboarding_guide") {
    await answerCallbackQuery({ callbackQueryId: queryId });
    if (input.message) {
      const photo = await getWelcomeHeroImage();
      try {
        await editTelegramMessageMedia({
          chatId: input.message.chat.id,
          messageId: input.message.message_id,
          photo,
          caption: getWelcomeCardCaption(),
          parseMode: "HTML",
          replyMarkup: getWelcomeCardKeyboard(),
        });
      } catch {
        await sendWelcomeCard(input.message.chat.id);
      }
    } else {
      await sendWelcomeCard(input.from.id);
    }
    return;
  }

  await answerCallbackQuery({ callbackQueryId: queryId });
}
