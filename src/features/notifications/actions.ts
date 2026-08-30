"use server";

import { prisma } from "@/lib/database/prisma";
import { requireCurrentUser } from "@/lib/auth/current-user";
import { revalidatePath } from "next/cache";

export async function getNotifications() {
  try {
    const user = await requireCurrentUser();
    const notifications = await prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return { success: true, data: notifications };
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return { success: false, error: "Sign in with Telegram to see your alerts." };
    }
    console.error("Notification fetch failed", error);
    return { success: false, error: "We couldn't load your alerts." };
  }
}

export async function markAllNotificationsRead() {
  try {
    const user = await requireCurrentUser();
    await prisma.notification.updateMany({ where: { userId: user.id, isRead: false }, data: { isRead: true } });
    revalidatePath("/notifications");
    return { success: true };
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return { success: false, error: "Sign in with Telegram to manage your alerts." };
    }
    console.error("Mark notifications read failed", error);
    return { success: false, error: "We couldn't update your alerts." };
  }
}
