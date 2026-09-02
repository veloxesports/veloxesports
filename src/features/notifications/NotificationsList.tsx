"use client";

import { useState } from "react";
import { Bell, CheckCircle2, ChevronRight, Swords, Trophy, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { markAllNotificationsRead, markNotificationRead } from "@/features/notifications/actions";

type NotificationItem = {
  id: string;
  type: "SYSTEM" | "TOURNAMENT" | "PAYMENT" | "MATCH" | "TEAM" | "ACHIEVEMENT";
  title: string;
  message: string;
  isRead: boolean;
  createdAt: Date;
  target: { href: string; label: string };
};

const notificationVisuals = {
  SYSTEM: { icon: Bell, color: "text-blue-400" },
  TOURNAMENT: { icon: Trophy, color: "text-yellow-500" },
  PAYMENT: { icon: Wallet, color: "text-green-400" },
  MATCH: { icon: Swords, color: "text-[#c5f94d]" },
  TEAM: { icon: Swords, color: "text-cyan-400" },
  ACHIEVEMENT: { icon: CheckCircle2, color: "text-yellow-500" },
};

export function NotificationsList({ initialNotifications, initialUnreadCount }: { initialNotifications: NotificationItem[]; initialUnreadCount: number }) {
  const router = useRouter();
  const [notifications, setNotifications] = useState(initialNotifications);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [markingRead, setMarkingRead] = useState(false);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const markAllRead = async () => {
    setMarkingRead(true);
    setError(null);
    try {
      const result = await markAllNotificationsRead();
      if (result.success) {
        setNotifications((items) => items.map((item) => ({ ...item, isRead: true })));
        setUnreadCount(0);
      }
      else setError(result.error ?? "We couldn't update your alerts.");
    } catch {
      setError("We couldn't update your alerts. Check your connection and try again.");
    } finally {
      setMarkingRead(false);
    }
  };

  const openNotification = async (notification: NotificationItem) => {
    setOpeningId(notification.id);
    setError(null);
    try {
      if (!notification.isRead) {
        const result = await markNotificationRead(notification.id);
        if (!result.success) {
          setError(result.error ?? "We couldn't open this alert.");
          return;
        }
        setNotifications((items) => items.map((item) => item.id === notification.id ? { ...item, isRead: true } : item));
        setUnreadCount((count) => Math.max(0, count - 1));
      }
      router.push(notification.target.href);
    } catch {
      setError("We couldn't open this alert. Check your connection and try again.");
    } finally {
      setOpeningId(null);
    }
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
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-black uppercase tracking-[0.1em] text-[#aeb8ad]">{unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}</span>
        <Button onClick={markAllRead} disabled={markingRead || notifications.every((item) => item.isRead)} variant="ghost" className="h-auto p-0 text-xs text-[#c5f94d] hover:bg-transparent hover:text-[#d5ff70]">
          {markingRead ? "Updating…" : "Mark all read"}
        </Button>
      </div>
      {error && <p role="status" className="rounded-xl border border-[#87493d] bg-[#2b1d19] px-3 py-2 text-xs font-medium text-[#ffb1a0]">{error}</p>}
      {notifications.map((notification) => {
        const visual = notificationVisuals[notification.type];
        const Icon = visual.icon;
        return (
          <button key={notification.id} type="button" onClick={() => void openNotification(notification)} disabled={openingId === notification.id} className={`flex w-full gap-4 rounded-2xl border p-4 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c5f94d] disabled:cursor-wait ${notification.isRead ? "border-[#2a352b] bg-[#111811]/70 opacity-70" : "border-[#4b663e] bg-[#111811] hover:border-[#c5f94d]/60"}`}>
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-black ${visual.color}`}>
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-sm font-bold text-white">{notification.title}</h2>
                <time className="shrink-0 text-[10px] font-medium text-gray-500">{new Date(notification.createdAt).toLocaleDateString()}</time>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-gray-400">{notification.message}</p>
              <span className="mt-3 inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-[0.08em] text-[#c5f94d]">{openingId === notification.id ? "Opening…" : notification.target.label}<ChevronRight className="h-3.5 w-3.5" aria-hidden /></span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
