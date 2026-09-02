"use server";

import { prisma } from "@/lib/database/prisma";
import { getCurrentUser, requireCurrentUser } from "@/lib/auth/current-user";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { notificationTarget } from "@/lib/notifications/links";

const notificationIdSchema = z.string().uuid();

function revalidateNotificationViews() {
  revalidatePath("/", "layout");
  revalidatePath("/notifications");
}

export async function getNotifications() {
  try {
    const user = await requireCurrentUser();
    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      prisma.notification.count({ where: { userId: user.id, isRead: false } }),
    ]);
    return {
      success: true,
      data: {
        notifications: notifications.map((notification) => ({
          ...notification,
          target: notificationTarget(notification.type, notification.metadata),
        })),
        unreadCount,
      },
    };
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return { success: false, error: "Sign in with Telegram to see your alerts." };
    }
    console.error("Notification fetch failed", error);
    return { success: false, error: "We couldn't load your alerts." };
  }
}

/** Safe for the mobile bell to poll; signed-out visitors simply have no unread alerts. */
export async function getUnreadNotificationCount() {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: true, data: 0 };
    return { success: true, data: await prisma.notification.count({ where: { userId: user.id, isRead: false } }) };
  } catch (error) {
    console.error("Unread notification count failed", error);
    return { success: false, error: "We couldn't refresh your alerts." };
  }
}

export async function markNotificationRead(notificationId: unknown) {
  const parsed = notificationIdSchema.safeParse(notificationId);
  if (!parsed.success) return { success: false, error: "Invalid notification." };

  try {
    const user = await requireCurrentUser();
    await prisma.notification.updateMany({
      where: { id: parsed.data, userId: user.id, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
    revalidateNotificationViews();
    return { success: true };
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return { success: false, error: "Sign in with Telegram to manage your alerts." };
    }
    console.error("Mark notification read failed", error);
    return { success: false, error: "We couldn't update this alert." };
  }
}

export async function markAllNotificationsRead() {
  try {
    const user = await requireCurrentUser();
    await prisma.notification.updateMany({ where: { userId: user.id, isRead: false }, data: { isRead: true, readAt: new Date() } });
    revalidateNotificationViews();
    return { success: true };
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return { success: false, error: "Sign in with Telegram to manage your alerts." };
    }
    console.error("Mark notifications read failed", error);
    return { success: false, error: "We couldn't update your alerts." };
  }
}
