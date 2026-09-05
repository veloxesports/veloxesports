"use client";

import { useState } from "react";
import { Check, Filter, Gamepad2, Globe, Trophy, Users } from "lucide-react";

export function Screen2Discovery() {
  const [activeFilter, setActiveFilter] = useState<"game" | "format" | "region">("game");
  const [isJoined, setIsJoined] = useState(false);

  return (
    <div className="flex h-full flex-col items-center justify-between text-center select-none">
      {/* Interactive Discovery Simulation Card */}
      <div className="relative flex flex-1 w-full flex-col items-center justify-center py-2">
        {/* Glow */}
        <div
          className="absolute h-56 w-56 rounded-full bg-[#c5f94d]/10 blur-[50px]"
          aria-hidden
        />

        {/* Filter Pills Bar */}
        <div className="relative z-10 flex items-center gap-1.5 rounded-2xl border border-[#273a27] bg-[#0c140d]/90 p-1 backdrop-blur shadow-lg">
          <button
            type="button"
            onClick={() => setActiveFilter("game")}
            className={`flex items-center gap-1 rounded-xl px-2.5 py-1 text-[10px] font-black uppercase tracking-wider transition ${
              activeFilter === "game"
                ? "bg-[#c5f94d] text-[#0a0e0a] shadow-[0_0_12px_rgba(197,249,77,0.3)]"
                : "text-[#8e9f8e] hover:text-white"
            }`}
          >
            <Gamepad2 className="h-3 w-3" />
            <span>Game</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter("format")}
            className={`flex items-center gap-1 rounded-xl px-2.5 py-1 text-[10px] font-black uppercase tracking-wider transition ${
              activeFilter === "format"
                ? "bg-[#c5f94d] text-[#0a0e0a] shadow-[0_0_12px_rgba(197,249,77,0.3)]"
                : "text-[#8e9f8e] hover:text-white"
            }`}
          >
            <Users className="h-3 w-3" />
            <span>Format</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter("region")}
            className={`flex items-center gap-1 rounded-xl px-2.5 py-1 text-[10px] font-black uppercase tracking-wider transition ${
              activeFilter === "region"
                ? "bg-[#c5f94d] text-[#0a0e0a] shadow-[0_0_12px_rgba(197,249,77,0.3)]"
                : "text-[#8e9f8e] hover:text-white"
            }`}
          >
            <Globe className="h-3 w-3" />
            <span>Region</span>
          </button>
        </div>

        {/* Floating Tournament Card */}
        <div className="relative z-10 mt-3.5 w-full max-w-[310px] rounded-[24px] border border-[#344d32] bg-gradient-to-b from-[#142015] via-[#0d160e] to-[#080d09] p-4 text-left shadow-[0_16px_40px_rgba(0,0,0,0.6)] ring-1 ring-[#c5f94d]/15">
          {/* Header row */}
          <div className="flex items-center justify-between gap-2">
            <span className="rounded-md bg-[#1f311c] px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-[#c5f94d]">
              {activeFilter === "game" ? "FC 26 • PRO SERIES" : activeFilter === "format" ? "5v5 SQUAD PLAY" : "GLOBAL REGION"}
            </span>
            <span className="flex items-center gap-1 text-[10px] font-black text-amber-300">
              <Trophy className="h-3 w-3" />
              <span>$2,500</span>
            </span>
          </div>

          <h3 className="mt-2 text-sm font-black text-white">
            Khemora Champions Cup
          </h3>
          <p className="text-[11px] text-[#869984]">
            Single Elimination • 32 Teams • Direct Seeding
          </p>

          <div className="mt-3 flex items-center justify-between border-t border-[#233324] pt-2.5 text-[10px] text-[#93a791]">
            <span>Slots: <strong className="text-white">28/32 filled</strong></span>
            <span className="text-[#c5f94d] font-bold">Registration Open</span>
          </div>

          {/* Interactive Join / Registered Button */}
          <button
            type="button"
            onClick={() => setIsJoined(!isJoined)}
            className={`mt-3 flex h-9 w-full items-center justify-center gap-1.5 rounded-xl text-xs font-black transition-all active:scale-95 ${
              isJoined
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-[0_0_15px_rgba(16,185,129,0.25)]"
                : "bg-[#c5f94d] text-[#0a0e0a] hover:bg-[#d5ff70] shadow-[0_0_15px_rgba(197,249,77,0.3)]"
            }`}
          >
            {isJoined ? (
              <>
                <Check className="h-4 w-4" />
                <span>Registered ✓</span>
              </>
            ) : (
              <>
                <span>Join Tournament</span>
                <span className="text-[10px] font-normal opacity-80">(Tap to try)</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Headline & Description */}
      <div className="w-full space-y-2.5 px-4 pt-2 pb-4">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-[#2a3c28] bg-[#101811] px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#c5f94d]">
          <Filter className="h-3 w-3" />
          <span>Smart Tournament Discovery</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-black tracking-[-0.03em] text-white">
          Find Your Next <span className="text-[#c5f94d]">Tournament</span>
        </h2>
        <p className="text-xs sm:text-sm font-medium leading-relaxed text-[#9ab097] max-w-xs mx-auto">
          Discover competitions for your favorite games and join in just a few taps.
        </p>
      </div>
    </div>
  );
}
