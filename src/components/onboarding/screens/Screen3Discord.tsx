"use client";

import { useState } from "react";
import { Gamepad2, Link2, ShieldCheck, Sparkles, User } from "lucide-react";

export function Screen3Discord() {
  const [isConnected, setIsConnected] = useState(true);

  return (
    <div className="flex h-full flex-col items-center justify-between text-center select-none">
      {/* Visual Connection Pipeline */}
      <div className="relative flex flex-1 w-full flex-col items-center justify-center py-2">
        {/* Glow behind connection */}
        <div
          className="absolute h-52 w-52 rounded-full bg-[#5865F2]/15 blur-[50px]"
          aria-hidden
        />
        <div
          className="absolute h-48 w-48 rounded-full bg-[#c5f94d]/10 blur-[45px]"
          aria-hidden
        />

        {/* Dual Cards Bridge Container */}
        <div className="relative z-10 flex w-full max-w-[320px] flex-col items-center gap-3">
          {/* Top Row: Khemora Card <-> Discord Card */}
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 w-full">
            {/* Khemora Player Card */}
            <div className="flex flex-col items-center rounded-2xl border border-[#30452e] bg-gradient-to-b from-[#131f14] to-[#0a100b] p-3 text-center shadow-lg">
              <div className="grid h-10 w-10 place-items-center rounded-xl border border-[#c5f94d]/60 bg-[#1e2f1d] text-[#c5f94d] shadow-[0_0_12px_rgba(197,249,77,0.3)]">
                <User className="h-5 w-5" />
              </div>
              <span className="mt-1.5 text-xs font-black text-white truncate max-w-[85px]">
                KHEMORA
              </span>
              <span className="text-[9px] font-bold text-[#8ba089]">
                Player Profile
              </span>
            </div>

            {/* Connecting Animated Pipeline */}
            <div className="flex flex-col items-center justify-center px-1">
              <div className="relative flex items-center justify-center">
                <div className={`h-0.5 w-10 transition-colors duration-500 ${isConnected ? "bg-gradient-to-r from-[#c5f94d] via-white to-[#5865F2]" : "bg-[#273628]"}`} />
                <div className="absolute grid h-7 w-7 place-items-center rounded-full border border-white/30 bg-[#101711] shadow-md">
                  <Link2 className={`h-3.5 w-3.5 transition-colors ${isConnected ? "text-[#c5f94d]" : "text-[#7a8a78]"}`} />
                </div>
              </div>
              <span className="mt-2 text-[9px] font-black uppercase tracking-wider text-[#a0b39e]">
                OAuth 2.0
              </span>
            </div>

            {/* Discord Profile Card */}
            <div className="flex flex-col items-center rounded-2xl border border-[#3b4382] bg-gradient-to-b from-[#161a3b] to-[#0c0d1c] p-3 text-center shadow-lg">
              <div className="grid h-10 w-10 place-items-center rounded-xl border border-[#5865F2] bg-[#242b5c] text-white shadow-[0_0_15px_rgba(88,101,242,0.4)]">
                <Gamepad2 className="h-5 w-5" />
              </div>
              <span className="mt-1.5 text-xs font-black text-white truncate max-w-[85px]">
                Discord
              </span>
              <span className="text-[9px] font-bold text-[#8fa0de]">
                @champion
              </span>
            </div>
          </div>

          {/* Connection Status Banner */}
          <div className="w-full rounded-2xl border border-[#273a28] bg-[#0d140e]/90 p-3 text-center backdrop-blur shadow-md">
            <div className="flex items-center justify-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
              <span className="text-xs font-black text-white">
                {isConnected ? "Account Linked & Verified" : "Ready to Link"}
              </span>
              <ShieldCheck className="h-3.5 w-3.5 text-[#c5f94d]" />
            </div>

            <p className="mt-1 text-[10px] text-[#869984]">
              Enables lobby channels, player tags, and direct match coordination.
            </p>

            <button
              type="button"
              onClick={() => setIsConnected(!isConnected)}
              className="mt-2.5 inline-flex items-center gap-1 text-[11px] font-black text-[#c5f94d] hover:underline"
            >
              <span>{isConnected ? "✓ Discord Connected" : "Link Account Preview"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Headline & Description */}
      <div className="w-full space-y-2.5 px-4 pt-2 pb-4">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-[#2a3c28] bg-[#101811] px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#c5f94d]">
          <Sparkles className="h-3 w-3" />
          <span>Official Tournament Sync</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-black tracking-[-0.03em] text-white">
          Connect Your <span className="text-[#5865F2]">Discord</span>
        </h2>
        <p className="text-xs sm:text-sm font-medium leading-relaxed text-[#9ab097] max-w-xs mx-auto">
          Link Discord with Khemora and stay connected with your tournament community.
        </p>
      </div>
    </div>
  );
}
