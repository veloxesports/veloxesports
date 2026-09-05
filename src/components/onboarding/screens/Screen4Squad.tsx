"use client";

import { Crown, Shield, Users, Check } from "lucide-react";

export function Screen4Squad() {
  const members = [
    { role: "Captain", name: "You (Capt)", isCaptain: true, ready: true },
    { role: "Fragger", name: "Vortex", isCaptain: false, ready: true },
    { role: "Support", name: "Nexus", isCaptain: false, ready: true },
    { role: "IGL", name: "Aero", isCaptain: false, ready: true },
  ];

  return (
    <div className="flex h-full flex-col items-center justify-between text-center select-none">
      {/* Tactical Squad Formation */}
      <div className="relative flex flex-1 w-full flex-col items-center justify-center py-2">
        {/* Glow */}
        <div
          className="absolute h-56 w-56 rounded-full bg-[#c5f94d]/10 blur-[50px]"
          aria-hidden
        />

        {/* Tactical Roster Board */}
        <div className="relative z-10 w-full max-w-[320px] rounded-[24px] border border-[#2e432c] bg-gradient-to-b from-[#131d14] via-[#0c130d] to-[#070b08] p-3.5 shadow-xl ring-1 ring-[#c5f94d]/15">
          {/* Team header */}
          <div className="flex items-center justify-between border-b border-[#202e21] pb-2.5">
            <div className="flex items-center gap-2">
              <div className="grid h-7 w-7 place-items-center rounded-lg bg-[#20331b] text-[#c5f94d]">
                <Shield className="h-4 w-4" />
              </div>
              <div className="text-left">
                <span className="block text-xs font-black text-white">KHEMORA PHANTOM</span>
                <span className="block text-[9px] font-bold text-[#798e78]">Competitive 4-Man Squad</span>
              </div>
            </div>
            <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[9px] font-black uppercase text-emerald-400">
              Ready ✓
            </span>
          </div>

          {/* Active 4-Player Lineup Grid */}
          <div className="mt-3 grid grid-cols-2 gap-2">
            {members.map((m) => (
              <div
                key={m.name}
                className="relative flex items-center gap-2 rounded-xl border border-[#273827] bg-[#111912] p-2 text-left shadow-sm"
              >
                <div className="relative grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#1a291b] font-black text-xs text-white">
                  {m.name[0]}
                  {m.isCaptain && (
                    <span className="absolute -top-1.5 -right-1.5 grid h-4 w-4 place-items-center rounded-full bg-amber-400 text-[#0a0e0a]">
                      <Crown className="h-2.5 w-2.5" />
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="truncate text-[11px] font-bold text-white">{m.name}</span>
                    <Check className="h-3 w-3 text-[#c5f94d]" />
                  </div>
                  <span className="text-[9px] font-semibold text-[#869884]">{m.role}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Substitute Reserve Bench */}
          <div className="mt-2.5 flex items-center justify-between rounded-xl border border-dashed border-[#293c29] bg-[#0c120d]/80 px-3 py-1.5 text-[10px]">
            <span className="font-medium text-[#7d907c]">Reserve Substitute:</span>
            <span className="font-bold text-white">ShadowSniper (Ready)</span>
          </div>
        </div>
      </div>

      {/* Headline & Description */}
      <div className="w-full space-y-2.5 px-4 pt-2 pb-4">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-[#2a3c28] bg-[#101811] px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#c5f94d]">
          <Users className="h-3 w-3" />
          <span>Squad Operations</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-black tracking-[-0.03em] text-white">
          Build Your <span className="text-[#c5f94d]">Squad</span>
        </h2>
        <p className="text-xs sm:text-sm font-medium leading-relaxed text-[#9ab097] max-w-xs mx-auto">
          Create your team, invite your crew and assemble the perfect lineup for every tournament.
        </p>
      </div>
    </div>
  );
}
