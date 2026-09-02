import "server-only";

import { prisma } from "@/lib/database/prisma";
import { sendTelegramMiniAppNotification } from "@/lib/telegram/bot";
import { notificationMiniAppUrl, notificationTarget } from "./links";

type PendingDeliveryOptions = {
  createdSince?: Date;
  userIds?: string[];
  limit?: number;
};

function deliveryErrorCode(error: unknown) {
  return error instanceof Error ? error.message.slice(0, 120) : "TELEGRAM_DELIVERY_FAILED";
}

/**
 * Sends only notification rows explicitly created for Telegram delivery. The optimistic update
 * prevents two concurrent server actions from sending the same bot message twice.
 */
export async function dispatchPendingTelegramNotifications(options: PendingDeliveryOptions = {}) {
  const userIds = [...new Set(options.userIds ?? [])];
  const notifications = await prisma.notification.findMany({
    where: {
      telegramDeliveryEligible: true,
      telegramSentAt: null,
      telegramDeliveryAttempts: { lt: 3 },
      ...(options.createdSince ? { createdAt: { gte: options.createdSince } } : {}),
      ...(userIds.length ? { userId: { in: userIds } } : {}),
    },
    include: { user: { select: { telegramId: true } } },
    orderBy: { createdAt: "asc" },
    take: Math.min(Math.max(options.limit ?? 100, 1), 100),
  });

  const deliverOne = async (notification: typeof notifications[number]) => {
    const claimed = await prisma.notification.updateMany({
      where: {
        id: notification.id,
        telegramSentAt: null,
        telegramDeliveryAttempts: notification.telegramDeliveryAttempts,
      },
      data: {
        telegramDeliveryAttempts: { increment: 1 },
        telegramDeliveryError: null,
      },
    });
    if (claimed.count !== 1) return { delivered: 0, failed: 0 };

    try {
      const target = notificationTarget(notification.type, notification.metadata);
      await sendTelegramMiniAppNotification({
        telegramUserId: notification.user.telegramId,
        title: notification.title,
        message: notification.message,
        actionLabel: target.label,
        webAppUrl: notificationMiniAppUrl(target.href),
      });
      await prisma.notification.update({
        where: { id: notification.id },
        data: { telegramSentAt: new Date(), telegramDeliveryError: null },
      });
      return { delivered: 1, failed: 0 };
    } catch (error) {
      await prisma.notification.update({
        where: { id: notification.id },
        data: { telegramDeliveryError: deliveryErrorCode(error) },
      }).catch(() => undefined);
      return { delivered: 0, failed: 1 };
    }
  };

  let delivered = 0;
  let failed = 0;
  // Keep requests fast enough for serverless actions without exceeding Telegram's bulk-send limits.
  for (let index = 0; index < notifications.length; index += 5) {
    const outcomes = await Promise.all(notifications.slice(index, index + 5).map(deliverOne));
    for (const outcome of outcomes) {
      delivered += outcome.delivered;
      failed += outcome.failed;
    }
  }

  return { delivered, failed };
}

/** Notification delivery must never roll back the tournament, match, or payment event that created it. */
export async function dispatchTelegramNotificationsCreatedSince(createdSince: Date) {
  try {
    return await dispatchPendingTelegramNotifications({ createdSince });
  } catch (error) {
    console.error("Telegram notification dispatch failed", error);
    return { delivered: 0, failed: 0 };
  }
}
