"use client";

import { useState } from "react";
import { ChevronRight, Swords } from "lucide-react";

export function Screen6Matches() {
  const [stage, setStage] = useState<"quarter" | "semi" | "champion">("semi");

  return (
    <div className="flex h-full flex-col items-center justify-between text-center select-none">
      {/* Animated Bracket & Match Progression */}
      <div className="relative flex flex-1 w-full flex-col items-center justify-center py-2">
        {/* Ambient Glow */}
        <div
          className="absolute h-56 w-56 rounded-full bg-[#c5f94d]/10 blur-[50px]"
          aria-hidden
        />

        {/* Bracket Match Simulation Card */}
        <div className="relative z-10 w-full max-w-[320px] rounded-[24px] border border-[#2f432d] bg-gradient-to-b from-[#131d14] via-[#0c130d] to-[#070b08] p-4 text-left shadow-xl ring-1 ring-[#c5f94d]/15">
          {/* Stage selector tabs */}
          <div className="flex items-center justify-between border-b border-[#202e21] pb-2 text-[10px] font-black uppercase">
            <span className="text-[#849782]">Round Progression</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setStage("quarter")}
                className={`rounded-md px-1.5 py-0.5 transition ${stage === "quarter" ? "bg-[#c5f94d] text-[#0a0e0a]" : "text-[#7a8c78]"}`}
              >
                QF
              </button>
              <button
                type="button"
                onClick={() => setStage("semi")}
                className={`rounded-md px-1.5 py-0.5 transition ${stage === "semi" ? "bg-[#c5f94d] text-[#0a0e0a]" : "text-[#7a8c78]"}`}
              >
                SF
              </button>
              <button
                type="button"
                onClick={() => setStage("champion")}
                className={`rounded-md px-1.5 py-0.5 transition ${stage === "champion" ? "bg-[#c5f94d] text-[#0a0e0a]" : "text-[#7a8c78]"}`}
              >
                Final
              </button>
            </div>
          </div>

          {/* Active Fixture Box */}
          <div className="mt-3 rounded-2xl border border-[#273827] bg-[#101811] p-3">
            <div className="flex items-center justify-between text-[10px] font-bold text-[#7d907b]">
              <span>Best of 3 • Round 2</span>
              <span className="rounded-full bg-emerald-500/20 px-2 py-0.2 text-emerald-400">
                {stage === "champion" ? "Champion 🏆" : "Victory 2 - 0 ✓"}
              </span>
            </div>

            {/* Competitor 1 (You) */}
            <div className="mt-2.5 flex items-center justify-between rounded-xl bg-[#182718] p-2 border border-[#3e5e3a]">
              <div className="flex items-center gap-2">
                <span className="grid h-6 w-6 place-items-center rounded-md bg-[#20361c] text-xs font-black text-[#c5f94d]">
                  Y
                </span>
                <span className="text-xs font-black text-white">You & Your Squad</span>
              </div>
              <span className="font-mono text-xs font-black text-[#c5f94d]">2</span>
            </div>

            {/* Competitor 2 (Opponent) */}
            <div className="mt-1.5 flex items-center justify-between rounded-xl bg-[#0e140f] p-2 opacity-70">
              <div className="flex items-center gap-2">
                <span className="grid h-6 w-6 place-items-center rounded-md bg-[#192119] text-xs font-black text-[#7a8b78]">
                  O
                </span>
                <span className="text-xs font-bold text-[#b1c2af]">Shadow Esports</span>
              </div>
              <span className="font-mono text-xs font-bold text-[#7a8b78]">0</span>
            </div>
          </div>

          {/* Progression Line */}
          <div className="mt-3 flex items-center justify-between text-[11px] text-[#91a48f]">
            <span>Next Round:</span>
            <span className="flex items-center gap-1 font-bold text-[#c5f94d]">
              <span>{stage === "champion" ? "Trophy Awarded!" : "Advancing to Final"}</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </span>
          </div>
        </div>
      </div>

      {/* Headline & Description */}
      <div className="w-full space-y-2.5 px-4 pt-2 pb-4">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-[#2a3c28] bg-[#101811] px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#c5f94d]">
          <Swords className="h-3 w-3" />
          <span>Live Match Center</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-black tracking-[-0.03em] text-white">
          Play. Win. <span className="text-[#c5f94d]">Advance.</span>
        </h2>
        <p className="text-xs sm:text-sm font-medium leading-relaxed text-[#9ab097] max-w-xs mx-auto">
          Everything you need for your next match is right inside Velox.
        </p>
      </div>
    </div>
  );
}
