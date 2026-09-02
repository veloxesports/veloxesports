"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  CheckCircle2,
  ChevronRight,
  ShieldCheck,
  Swords,
  Trophy,
  Wallet,
  X,
} from "lucide-react";
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/features/notifications/actions";
import { TelegramBottomSheet } from "@/components/ui/TelegramBottomSheet";

type NotificationItem = {
  id: string;
  type: "SYSTEM" | "TOURNAMENT" | "PAYMENT" | "MATCH" | "TEAM" | "ACHIEVEMENT";
  title: string;
  message: string;
  isRead: boolean;
  createdAt: Date;
  target: { href: string; label: string };
};

const filterTabs = [
  { id: "ALL", label: "All" },
  { id: "TOURNAMENT", label: "Tournaments" },
  { id: "MATCH", label: "Matches" },
  { id: "PAYMENT", label: "Wallet" },
  { id: "SYSTEM", label: "System" },
] as const;

const notificationVisuals = {
  SYSTEM: { icon: Bell, color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
  TOURNAMENT: { icon: Trophy, color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20" },
  PAYMENT: { icon: Wallet, color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
  MATCH: { icon: Swords, color: "text-[#c5f94d]", bg: "bg-[#c5f94d]/10 border-[#c5f94d]/20" },
  TEAM: { icon: ShieldCheck, color: "text-cyan-400", bg: "bg-cyan-500/10 border-cyan-500/20" },
  ACHIEVEMENT: { icon: CheckCircle2, color: "text-amber-300", bg: "bg-amber-400/10 border-amber-400/20" },
};

export function NotificationSheet({
  isOpen,
  onClose,
  onUnreadCountChange,
}: {
  isOpen: boolean;
  onClose: () => void;
  onUnreadCountChange?: (count: number) => void;
}) {
  const router = useRouter();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<(typeof filterTabs)[number]["id"]>("ALL");
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    let active = true;
    const fetchLatest = async () => {
      setLoading(true);
      try {
        const res = await getNotifications();
        if (active && res.success && res.data) {
          setNotifications(res.data.notifications);
          setUnreadCount(res.data.unreadCount);
          onUnreadCountChange?.(res.data.unreadCount);
        }
      } catch (err) {
        console.error("Failed to load notifications in sheet", err);
      } finally {
        if (active) setLoading(false);
      }
    };

    void fetchLatest();
    return () => {
      active = false;
    };
  }, [isOpen, onUnreadCountChange]);

  const filtered = useMemo(() => {
    if (activeTab === "ALL") return notifications;
    if (activeTab === "SYSTEM") {
      return notifications.filter((n) => n.type === "SYSTEM" || n.type === "ACHIEVEMENT");
    }
    return notifications.filter((n) => n.type === activeTab);
  }, [activeTab, notifications]);

  const handleMarkAllRead = async () => {
    setIsProcessing(true);
    try {
      const res = await markAllNotificationsRead();
      if (res.success) {
        setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })));
        setUnreadCount(0);
        onUnreadCountChange?.(0);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleItemClick = async (item: NotificationItem) => {
    if (!item.isRead) {
      void markNotificationRead(item.id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, isRead: true } : n))
      );
      const newCount = Math.max(0, unreadCount - 1);
      setUnreadCount(newCount);
      onUnreadCountChange?.(newCount);
    }
    onClose();
    router.push(item.target.href);
  };

  if (!isOpen) return null;

  return (
    <TelegramBottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Alerts & Updates"
      maxWidthClass="max-w-xl"
      showDragHandle
    >
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-[#202d21] px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-[#19271a] text-[#c5f94d]">
            <Bell className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-black tracking-tight text-white">Alerts & Updates</h2>
              {unreadCount > 0 && (
                <span className="rounded-full bg-[#c5f94d] px-2 py-0.5 text-[10px] font-black text-[#090d09]">
                  {unreadCount > 99 ? "99+" : unreadCount} new
                </span>
              )}
            </div>
            <p className="text-[11px] font-semibold text-[#809081]">
              Tournament, match, and wallet events
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={handleMarkAllRead}
              disabled={isProcessing}
              className="text-xs font-bold text-[#c5f94d] hover:text-[#d5ff70] disabled:opacity-50"
            >
              Mark read
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close notifications"
            className="grid h-8 w-8 place-items-center rounded-xl border border-[#273628] bg-[#121c13] text-[#8e9f8f] transition hover:bg-[#1a281b] hover:text-white"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>

      {/* Filter Tabs - Pinned at top while scrolling */}
      <div className="flex shrink-0 gap-1.5 overflow-x-auto border-b border-[#1c281d] px-5 py-2.5 scrollbar-hide">
        {filterTabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`shrink-0 rounded-xl px-3 py-1.5 text-xs font-black transition ${
                isActive
                  ? "bg-[#c5f94d] text-[#090d09]"
                  : "border border-[#223023] bg-[#111912] text-[#819182] hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Notification List - Scrollable with safe bottom clearance */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 py-2 pb-4">
        {loading ? (
          <div className="space-y-3 py-6">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-20 animate-pulse rounded-2xl border border-[#1f2b20] bg-[#121a13]"
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-[#263527] bg-[#121b13] text-[#637364]">
              <Bell className="h-6 w-6" aria-hidden />
            </div>
            <p className="mt-3 text-sm font-bold text-white">You&apos;re all caught up</p>
            <p className="mt-1 text-xs text-[#7d8c7e]">No alerts matching this filter.</p>
          </div>
        ) : (
          <div className="space-y-2.5 py-1">
            {filtered.map((item) => {
              const visual = notificationVisuals[item.type] ?? notificationVisuals.SYSTEM;
              const Icon = visual.icon;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleItemClick(item)}
                  className={`group relative flex w-full items-start gap-3 rounded-2xl border p-3.5 text-left transition active:scale-[0.99] ${
                    item.isRead
                      ? "border-[#1e2a1f] bg-[#101711]/60 opacity-75 hover:border-[#2f4030] hover:bg-[#131d14]"
                      : "border-[#364936] bg-[#141e15] shadow-[0_4px_20px_rgba(0,0,0,0.35)] hover:border-[#c5f94d]/60"
                  }`}
                >
                  {!item.isRead && (
                    <span
                      className="absolute right-3 top-3 h-2 w-2 rounded-full bg-[#c5f94d] shadow-[0_0_8px_#c5f94d]"
                      aria-hidden
                    />
                  )}

                  <div
                    className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border ${visual.bg} ${visual.color}`}
                  >
                    <Icon className="h-5 w-5" aria-hidden />
                  </div>

                  <div className="min-w-0 flex-1 pr-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-xs font-black text-white">{item.title}</p>
                      <time className="shrink-0 text-[10px] font-semibold text-[#738274]">
                        {formatTime(item.createdAt)}
                      </time>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[#9bb09c]">
                      {item.message}
                    </p>
                    <div className="mt-2 flex items-center gap-1 text-[11px] font-black text-[#c5f94d] group-hover:text-[#d5ff70]">
                      <span>{item.target.label}</span>
                      <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </TelegramBottomSheet>
  );
}

function formatTime(dateVal: Date) {
  const d = new Date(dateVal);
  const diffHours = (Date.now() - d.getTime()) / (1000 * 60 * 60);
  if (diffHours < 1) return "Just now";
  if (diffHours < 24) return `${Math.floor(diffHours)}h ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
