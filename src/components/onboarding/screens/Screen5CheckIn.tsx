"use client";

import { useState } from "react";
import { BellRing, Check, Clock, Timer } from "lucide-react";

export function Screen5CheckIn() {
  const [isCheckedIn, setIsCheckedIn] = useState(false);

  return (
    <div className="flex h-full flex-col items-center justify-between text-center select-none">
      {/* Interactive Check-In Experience */}
      <div className="relative flex flex-1 w-full flex-col items-center justify-center py-2">
        {/* Glow */}
        <div
          className="absolute h-56 w-56 rounded-full bg-emerald-500/15 blur-[50px]"
          aria-hidden
        />

        {/* Check-In Console Card */}
        <div className="relative z-10 w-full max-w-[310px] rounded-[24px] border border-[#2f452d] bg-gradient-to-b from-[#131e14] via-[#0d140e] to-[#070b08] p-4 text-center shadow-xl ring-1 ring-[#c5f94d]/20">
          {/* Status badge */}
          <div className="inline-flex items-center gap-1.5 rounded-full bg-[#1b2b1a] px-3 py-0.5 text-[10px] font-black uppercase tracking-wider text-[#c5f94d]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#c5f94d] animate-ping" />
            <span>Check-In Window Open</span>
          </div>

          {/* Digital Countdown Timer */}
          <div className="mt-3.5 flex items-center justify-center gap-1.5 rounded-2xl border border-[#2a3c28] bg-[#0c130d] py-3 font-mono text-2xl font-black text-white shadow-inner">
            <Timer className="h-5 w-5 text-[#c5f94d] animate-pulse" />
            <span>01:42:16</span>
          </div>
          <span className="mt-1 block text-[10px] font-bold text-[#7d917b]">
            Window closes 15m before kickoff
          </span>

          {/* Interactive Check In Button */}
          <button
            type="button"
            onClick={() => setIsCheckedIn(!isCheckedIn)}
            className={`mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all active:scale-95 ${
              isCheckedIn
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.3)]"
                : "bg-[#c5f94d] text-[#0a0e0a] hover:bg-[#d5ff70] shadow-[0_0_20px_rgba(197,249,77,0.35)] animate-pulse"
            }`}
          >
            {isCheckedIn ? (
              <>
                <Check className="h-4 w-4 stroke-[3]" />
                <span>Checked In & Seated ✓</span>
              </>
            ) : (
              <>
                <BellRing className="h-4 w-4" />
                <span>Check In Now (Tap to Try)</span>
              </>
            )}
          </button>

          <p className="mt-2 text-[10px] text-[#869984]">
            {isCheckedIn
              ? "Your tournament slot is confirmed! Generating bracket..."
              : "Checking in confirms your attendance and locks your bracket slot."}
          </p>
        </div>
      </div>

      {/* Headline & Description */}
      <div className="w-full space-y-2.5 px-4 pt-2 pb-4">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-[#2a3c28] bg-[#101811] px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#c5f94d]">
          <Clock className="h-3 w-3" />
          <span>Attendance Confirmation</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-black tracking-[-0.03em] text-white">
          Check In. <span className="text-[#c5f94d]">Get Ready.</span>
        </h2>
        <p className="text-xs sm:text-sm font-medium leading-relaxed text-[#9ab097] max-w-xs mx-auto">
          Confirm your participation before the competition begins.
        </p>
      </div>
    </div>
  );
}
