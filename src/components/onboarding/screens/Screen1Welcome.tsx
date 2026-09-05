"use client";

import { Crown, Gamepad2, Sparkles, Swords, Trophy, Zap } from "lucide-react";

export function Screen1Welcome() {
  return (
    <div className="flex h-full flex-col items-center justify-between text-center select-none">
      {/* Animated Esports Hero Stage */}
      <div className="relative flex flex-1 w-full items-center justify-center py-2">
        {/* Ambient background glow and grid */}
        <div
          className="absolute h-64 w-64 rounded-full bg-[#c5f94d]/10 blur-[60px] animate-pulse"
          aria-hidden
        />
        <div
          className="absolute h-40 w-40 rounded-full bg-emerald-500/15 blur-[40px]"
          aria-hidden
        />

        {/* Center Holographic Stage */}
        <div className="relative z-10 flex flex-col items-center">
          {/* Main Crest / Trophy Emblem */}
          <div className="group relative grid h-32 w-32 place-items-center rounded-[32px] border-2 border-[#c5f94d]/50 bg-gradient-to-b from-[#182a17] via-[#0e170f] to-[#070b08] p-5 shadow-[0_0_50px_rgba(197,249,77,0.25)] transition-transform duration-500">
            {/* Cyber corner accents */}
            <span className="absolute -top-1.5 -left-1.5 h-3.5 w-3.5 border-t-2 border-l-2 border-[#c5f94d]" />
            <span className="absolute -top-1.5 -right-1.5 h-3.5 w-3.5 border-t-2 border-r-2 border-[#c5f94d]" />
            <span className="absolute -bottom-1.5 -left-1.5 h-3.5 w-3.5 border-b-2 border-l-2 border-[#c5f94d]" />
            <span className="absolute -bottom-1.5 -right-1.5 h-3.5 w-3.5 border-b-2 border-r-2 border-[#c5f94d]" />

            <Trophy className="h-16 w-16 text-[#c5f94d] drop-shadow-[0_0_15px_rgba(197,249,77,0.6)] animate-[bounce_3s_ease-in-out_infinite]" />

            {/* Inner Ring Glow */}
            <div className="absolute inset-2 rounded-[24px] border border-[#c5f94d]/20 pointer-events-none" />
          </div>

          {/* Floating UI Badges */}
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2 max-w-[320px]">
            <div className="flex items-center gap-1.5 rounded-xl border border-[#2d402b] bg-[#121c13]/90 px-3 py-1.5 text-[11px] font-black uppercase tracking-wider text-[#c5f94d] shadow-[0_4px_16px_rgba(0,0,0,0.4)] backdrop-blur">
              <Zap className="h-3.5 w-3.5 text-[#c5f94d]" />
              <span>Instant Check-In</span>
            </div>
            <div className="flex items-center gap-1.5 rounded-xl border border-[#2d402b] bg-[#121c13]/90 px-3 py-1.5 text-[11px] font-black uppercase tracking-wider text-white shadow-[0_4px_16px_rgba(0,0,0,0.4)] backdrop-blur">
              <Swords className="h-3.5 w-3.5 text-amber-400" />
              <span>Live Brackets</span>
            </div>
            <div className="flex items-center gap-1.5 rounded-xl border border-[#2d402b] bg-[#121c13]/90 px-3 py-1.5 text-[11px] font-black uppercase tracking-wider text-white shadow-[0_4px_16px_rgba(0,0,0,0.4)] backdrop-blur">
              <Gamepad2 className="h-3.5 w-3.5 text-blue-400" />
              <span>Multi-Game</span>
            </div>
            <div className="flex items-center gap-1.5 rounded-xl border border-[#2d402b] bg-[#121c13]/90 px-3 py-1.5 text-[11px] font-black uppercase tracking-wider text-[#c5f94d] shadow-[0_4px_16px_rgba(0,0,0,0.4)] backdrop-blur">
              <Crown className="h-3.5 w-3.5 text-amber-300" />
              <span>Real Prizes</span>
            </div>
          </div>
        </div>
      </div>

      {/* Headline & Description */}
      <div className="w-full space-y-2.5 px-4 pt-2 pb-4">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-[#2a3c28] bg-[#101811] px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#c5f94d]">
          <Sparkles className="h-3 w-3" />
          <span>Esports Command Center</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-black tracking-[-0.03em] text-white">
          Welcome to <span className="text-[#c5f94d]">Khemora</span>
        </h2>
        <p className="text-xs sm:text-sm font-medium leading-relaxed text-[#9ab097] max-w-xs mx-auto">
          Discover tournaments. Build your squad. Compete. Win. Repeat.
        </p>
      </div>
    </div>
  );
}
