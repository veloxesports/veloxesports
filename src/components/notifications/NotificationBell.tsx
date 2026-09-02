"use client";

import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { getUnreadNotificationCount } from "@/features/notifications/actions";
import { NotificationSheet } from "./NotificationSheet";

export function NotificationBell({ initialUnreadCount }: { initialUnreadCount: number }) {
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      const result = await getUnreadNotificationCount();
      if (active && result.success) setUnreadCount(result.data ?? 0);
    };
    const onVisibilityChange = () => { if (document.visibilityState === "visible") void refresh(); };
    const interval = window.setInterval(() => void refresh(), 30_000);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      active = false;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  const triggerHaptic = () => {
    try {
      if (typeof window !== "undefined" && window.Telegram?.WebApp?.HapticFeedback) {
        window.Telegram.WebApp.HapticFeedback.impactOccurred("light");
      }
    } catch {
      // ignore
    }
  };

  const handleOpen = () => {
    triggerHaptic();
    setSheetOpen(true);
  };

  const countLabel = unreadCount > 99 ? "99+" : String(unreadCount);

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        aria-label={unreadCount ? `Open notifications, ${unreadCount} unread` : "Open notifications"}
        className="group relative grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-[#233124] bg-[#0e1610] text-[#dce3d6] transition active:scale-95 hover:border-[#c5f94d]/50 hover:text-[#c5f94d] shadow-[0_4px_16px_rgba(0,0,0,0.4)]"
      >
        <Bell className="h-5 w-5 transition-transform group-hover:scale-105" aria-hidden />
        {unreadCount > 0 && (
          <span
            aria-hidden
            className="absolute -right-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full border-2 border-[#080d09] bg-[#c5f94d] px-1 text-[10px] font-black leading-none text-[#090d09] shadow-[0_0_8px_rgba(197,249,77,0.7)]"
          >
            {countLabel}
          </span>
        )}
      </button>

      <NotificationSheet
        isOpen={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onUnreadCountChange={setUnreadCount}
      />
    </>
  );
}
