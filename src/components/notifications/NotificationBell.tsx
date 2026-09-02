"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { getUnreadNotificationCount } from "@/features/notifications/actions";

export function NotificationBell({ initialUnreadCount }: { initialUnreadCount: number }) {
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);

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

  const countLabel = unreadCount > 99 ? "99+" : String(unreadCount);
  return (
    <Link href="/notifications" aria-label={unreadCount ? `Open notifications, ${unreadCount} unread` : "Open notifications"} className="relative mt-1 grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-[#2a352b] bg-[#111811] text-[#dce3d6] transition hover:border-[#c5f94d]/50 hover:text-[#c5f94d]">
      <Bell className="h-5 w-5" aria-hidden />
      {unreadCount > 0 && <span aria-hidden className="absolute -right-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full border-2 border-[#080d09] bg-[#c5f94d] px-1 text-[10px] font-black leading-none text-[#090d09]">{countLabel}</span>}
    </Link>
  );
}
