"use client";

import { useState } from "react";
import { Bell, CheckCircle2, Swords, Trophy, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { markAllNotificationsRead } from "@/features/notifications/actions";

type NotificationItem = {
  id: string;
  type: "SYSTEM" | "TOURNAMENT" | "PAYMENT" | "MATCH" | "TEAM" | "ACHIEVEMENT";
  title: string;
  message: string;
  isRead: boolean;
  createdAt: Date;
};

const notificationVisuals = {
  SYSTEM: { icon: Bell, color: "text-blue-400" },
  TOURNAMENT: { icon: Trophy, color: "text-yellow-500" },
  PAYMENT: { icon: Wallet, color: "text-green-400" },
  MATCH: { icon: Swords, color: "text-[#c5f94d]" },
  TEAM: { icon: Swords, color: "text-cyan-400" },
  ACHIEVEMENT: { icon: CheckCircle2, color: "text-yellow-500" },
};

export function NotificationsList({ initialNotifications }: { initialNotifications: NotificationItem[] }) {
  const [notifications, setNotifications] = useState(initialNotifications);
  const [markingRead, setMarkingRead] = useState(false);

  const markAllRead = async () => {
    setMarkingRead(true);
    const result = await markAllNotificationsRead();
    if (result.success) setNotifications((items) => items.map((item) => ({ ...item, isRead: true })));
    setMarkingRead(false);
  };

  if (notifications.length === 0) {
    return (
      <div className="rounded-2xl border border-white/5 bg-gray-900 p-8 text-center">
        <Bell className="mx-auto mb-3 h-12 w-12 text-gray-700" />
        <h2 className="text-lg font-bold text-gray-200">You&apos;re all caught up</h2>
        <p className="mt-1 text-sm text-gray-500">Tournament, payment, and match updates will appear here.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <Button onClick={markAllRead} disabled={markingRead || notifications.every((item) => item.isRead)} variant="ghost" className="h-auto p-0 text-xs text-[#c5f94d] hover:bg-transparent hover:text-[#d5ff70]">
          {markingRead ? "Updating…" : "Mark all read"}
        </Button>
      </div>
      {notifications.map((notification) => {
        const visual = notificationVisuals[notification.type];
        const Icon = visual.icon;
        return (
          <article key={notification.id} className={`flex gap-4 rounded-2xl border p-4 ${notification.isRead ? "border-[#2a352b] bg-[#111811]/70 opacity-70" : "border-[#4b663e] bg-[#111811]"}`}>
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-black ${visual.color}`}>
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-sm font-bold text-white">{notification.title}</h2>
                <time className="shrink-0 text-[10px] font-medium text-gray-500">{new Date(notification.createdAt).toLocaleDateString()}</time>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-gray-400">{notification.message}</p>
            </div>
          </article>
        );
      })}
    </div>
  );
}
