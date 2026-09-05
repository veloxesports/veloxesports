"use client";

import { Bell, Crown, Trophy, Zap } from "lucide-react";

export function Screen7StayUpdated() {
  const notifications = [
    { icon: Zap, text: "Check-in window is now OPEN", time: "Just now", badge: "URGENT" },
    { icon: Trophy, text: "Tournament fixture ready: Round 2", time: "2m ago", badge: "MATCH" },
    { icon: Crown, text: "Victory! You advanced to Finals", time: "10m ago", badge: "VICTORY" },
  ];

  return (
    <div className="flex h-full flex-col items-center justify-between text-center select-none">
      {/* Grand Championship & Notification Stream Stage */}
      <div className="relative flex flex-1 w-full flex-col items-center justify-center py-2">
        {/* Glow */}
        <div
          className="absolute h-64 w-64 rounded-full bg-[#c5f94d]/15 blur-[60px] animate-pulse"
          aria-hidden
        />
        <div
          className="absolute h-40 w-40 rounded-full bg-amber-400/15 blur-[45px]"
          aria-hidden
        />

        {/* Center Golden Trophy Visual */}
        <div className="relative z-10 flex flex-col items-center">
          <div className="group relative grid h-24 w-24 place-items-center rounded-3xl border border-amber-400/40 bg-gradient-to-b from-[#2a2412] via-[#15120a] to-[#0a0e0a] p-4 shadow-[0_0_35px_rgba(251,191,36,0.3)]">
            <Trophy className="h-14 w-14 text-amber-300 drop-shadow-[0_0_12px_rgba(251,191,36,0.6)]" />
            <span className="absolute -top-2 rounded-full bg-[#c5f94d] px-2 py-0.5 text-[8px] font-black uppercase text-[#0a0e0a] shadow">
              READY TO COMPETE
            </span>
          </div>

          {/* Floating Notifications Cards Feed */}
          <div className="mt-3.5 flex w-full max-w-[310px] flex-col gap-1.5 text-left">
            {notifications.map((n, i) => {
              const Icon = n.icon;
              return (
                <div
                  key={n.text}
                  style={{ animationDelay: `${i * 150}ms` }}
                  className="flex items-center gap-2.5 rounded-xl border border-[#273a27] bg-[#0c140d]/90 p-2.5 shadow-md backdrop-blur"
                >
                  <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[#19271a] text-[#c5f94d]">
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold text-white">{n.text}</p>
                    <span className="text-[9px] font-semibold text-[#7f947d]">{n.time}</span>
                  </div>
                  <span className="rounded bg-[#1f311c] px-1.5 py-0.5 text-[8px] font-black text-[#c5f94d]">
                    {n.badge}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Headline & Description */}
      <div className="w-full space-y-2 px-4 pt-2 pb-3">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-[#2a3c28] bg-[#101811] px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#c5f94d]">
          <Bell className="h-3 w-3" />
          <span>Telegram Push Alerts</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-black tracking-[-0.03em] text-white">
          You&apos;re Ready to <span className="text-[#c5f94d]">Compete</span>
        </h2>
        <p className="text-xs sm:text-sm font-medium leading-relaxed text-[#9ab097] max-w-xs mx-auto">
          Stay updated, enter the arena and make your mark with Khemora.
        </p>
      </div>
    </div>
  );
}
