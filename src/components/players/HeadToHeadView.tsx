"use client";

/* eslint-disable @next/next/no-img-element -- Telegram and Supabase avatars */

import { Swords } from "lucide-react";
import Link from "next/link";
import type { HeadToHeadRecord } from "@/features/players/types";

type HeadToHeadViewProps = {
  record: HeadToHeadRecord | null;
  targetPlayerName: string;
};

export function HeadToHeadView({ record, targetPlayerName }: HeadToHeadViewProps) {
  if (!record) {
    return (
      <div className="velox-card flex flex-col items-center justify-center p-8 text-center">
        <div className="grid h-12 w-12 place-items-center rounded-2xl border border-[#2b3c2a] bg-[#121c13] text-[#71856f]">
          <Swords className="h-6 w-6" />
        </div>
        <h3 className="mt-3 text-sm font-black text-white">Compare with Your Profile</h3>
        <p className="mt-1 text-xs text-[#879986] max-w-xs">
          Sign in via Telegram to compare your tournament record, head-to-head encounters, and match results against {targetPlayerName}.
        </p>
      </div>
    );
  }

  const { playerA, playerB, totalEncounters, playerAWins, playerBWins, matches } = record;
  const aWinPercent = totalEncounters > 0 ? Math.round((playerAWins / totalEncounters) * 100) : 50;

  return (
    <div className="flex flex-col gap-4">
      {/* Head-to-Head Banner Card */}
      <div className="overflow-hidden rounded-[28px] border border-[#2e432c] bg-gradient-to-b from-[#152316] via-[#0d160e] to-[#070b08] p-5 shadow-xl">
        {/* Top Eyebrow */}
        <div className="flex items-center justify-center gap-1.5 text-center">
          <Swords className="h-3.5 w-3.5 text-[#c5f94d]" />
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#c5f94d]">
            Head-to-Head Rivalry
          </span>
        </div>

        {/* Competitor Faceoff Row */}
        <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          {/* Player A (Target Player) */}
          <div className="flex flex-col items-center text-center">
            <div className="grid h-14 w-14 place-items-center overflow-hidden rounded-2xl border-2 border-[#395237] bg-[#142115] font-black text-white shadow-md">
              {playerA.avatar ? (
                <img src={playerA.avatar} alt="" className="h-full w-full object-cover" />
              ) : (
                <span>{playerA.name[0]?.toUpperCase()}</span>
              )}
            </div>
            <span className="mt-2 text-xs font-black text-white truncate max-w-[90px]">
              {playerA.name}
            </span>
            <span className="rounded bg-[#1c2c1c] px-2 py-0.5 text-[9px] font-black uppercase text-[#c5f94d] mt-1">
              {playerA.rank}
            </span>
          </div>

          {/* Center Scoreboard */}
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-2 font-mono text-2xl sm:text-3xl font-black text-white">
              <span className={playerAWins > playerBWins ? "text-[#c5f94d]" : "text-white"}>
                {playerAWins}
              </span>
              <span className="text-[#495f47] text-lg">-</span>
              <span className={playerBWins > playerAWins ? "text-[#c5f94d]" : "text-white"}>
                {playerBWins}
              </span>
            </div>
            <span className="text-[10px] font-black uppercase tracking-wider text-[#798e77] mt-0.5">
              {totalEncounters} {totalEncounters === 1 ? "Battle" : "Battles"}
            </span>
          </div>

          {/* Player B (You / Viewer) */}
          <div className="flex flex-col items-center text-center">
            <div className="grid h-14 w-14 place-items-center overflow-hidden rounded-2xl border-2 border-[#395237] bg-[#142115] font-black text-white shadow-md">
              {playerB.avatar ? (
                <img src={playerB.avatar} alt="" className="h-full w-full object-cover" />
              ) : (
                <span>{playerB.name[0]?.toUpperCase()}</span>
              )}
            </div>
            <span className="mt-2 text-xs font-black text-white truncate max-w-[90px]">
              {playerB.name}
            </span>
            <span className="rounded bg-[#1c2c1c] px-2 py-0.5 text-[9px] font-black uppercase text-[#c5f94d] mt-1">
              {playerB.rank}
            </span>
          </div>
        </div>

        {/* Win Ratio Comparison Bar */}
        {totalEncounters > 0 && (
          <div className="mt-5">
            <div className="flex justify-between text-[10px] font-bold text-[#8ba089] mb-1">
              <span>{playerA.name} ({aWinPercent}%)</span>
              <span>{playerB.name} ({100 - aWinPercent}%)</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-[#162417] flex">
              <div
                className="bg-[#c5f94d] transition-all duration-500"
                style={{ width: `${aWinPercent}%` }}
              />
              <div
                className="bg-emerald-500 transition-all duration-500"
                style={{ width: `${100 - aWinPercent}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Match History List */}
      <div className="flex flex-col gap-2">
        <h4 className="text-xs font-black uppercase tracking-wider text-[#829680] px-1">
          Encounter History
        </h4>

        {matches.length > 0 ? (
          <div className="flex flex-col gap-2">
            {matches.map((m) => (
              <Link
                key={m.matchId}
                href={`/matches/${m.matchId}`}
                className="flex items-center justify-between rounded-2xl border border-[#263725] bg-[#101711] p-3 shadow transition hover:border-[#476344] hover:bg-[#142014]"
              >
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-black text-white truncate">
                    {m.tournamentTitle}
                  </span>
                  <span className="text-[10px] text-[#7e917b]">
                    {m.gameName} · {new Date(m.date).toLocaleDateString()}
                  </span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-mono text-xs font-black text-white">
                    {m.playerAScore} - {m.playerBScore}
                  </span>
                  <span
                    className={`rounded px-1.5 py-0.5 text-[9px] font-black uppercase ${
                      m.playerAWon
                        ? "bg-amber-500/20 text-amber-300"
                        : "bg-emerald-500/20 text-emerald-400"
                    }`}
                  >
                    {m.playerAWon ? `${playerA.name} Won` : `${playerB.name} Won`}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-[#263725] bg-[#0d140e] p-6 text-center">
            <p className="text-xs font-bold text-white">No previous fixtures recorded</p>
            <p className="mt-1 text-[11px] text-[#798e77]">
              You haven&apos;t faced each other in any tournament matches yet. Meet in an upcoming tournament bracket to settle the score!
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
