"use client";

/* eslint-disable @next/next/no-img-element -- Avatars originate from Telegram or Supabase */

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import {
  ChevronRight,
  Loader2,
  Search,
  Shield,
  ShieldCheck,
  X,
} from "lucide-react";
import { searchPlayers } from "@/features/players/actions";
import type { PlayerSearchResult } from "@/features/players/types";

type PlayerSearchClientProps = {
  initialPlayers: PlayerSearchResult[];
};

const RANK_FILTERS = [
  { label: "All Ranks", value: "ALL" },
  { label: "Master+", value: "MASTER" },
  { label: "Diamond+", value: "DIAMOND" },
  { label: "Platinum+", value: "PLATINUM" },
  { label: "Gold+", value: "GOLD" },
];

export function PlayerSearchClient({ initialPlayers }: PlayerSearchClientProps) {
  const [query, setQuery] = useState("");
  const [selectedRank, setSelectedRank] = useState("ALL");
  const [players, setPlayers] = useState<PlayerSearchResult[]>(initialPlayers);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const handler = setTimeout(() => {
      startTransition(async () => {
        const res = await searchPlayers(query, { rank: selectedRank });
        if (res.success) {
          setPlayers(res.data);
        }
      });
    }, 250);

    return () => clearTimeout(handler);
  }, [query, selectedRank]);

  return (
    <div className="flex flex-col gap-4">
      {/* Search Bar Input */}
      <div className="relative">
        <div className="relative flex items-center rounded-2xl border border-[#2a3c2a] bg-[#111912] px-3.5 shadow-lg transition-all focus-within:border-[#c5f94d] focus-within:shadow-[0_0_20px_rgba(197,249,77,0.2)]">
          <Search className="h-5 w-5 shrink-0 text-[#829680]" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by username, game, or squad..."
            className="h-12 w-full bg-transparent px-3 text-sm font-semibold text-white placeholder:text-[#6a7c68] outline-none"
          />
          {isPending ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[#c5f94d]" />
          ) : query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="grid h-7 w-7 place-items-center rounded-lg text-[#829680] hover:bg-[#1a291b] hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </div>

      {/* Quick Filter Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {RANK_FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setSelectedRank(f.value)}
            className={`shrink-0 rounded-xl px-3 py-1.5 text-xs font-black uppercase tracking-wider transition ${
              selectedRank === f.value
                ? "bg-[#c5f94d] text-[#080d09] shadow-[0_0_12px_rgba(197,249,77,0.35)]"
                : "border border-[#253625] bg-[#101811] text-[#869984] hover:border-[#3d573b] hover:text-white"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Results Header */}
      <div className="flex items-center justify-between px-1 text-[11px] font-black uppercase tracking-wider text-[#798d77]">
        <span>
          {query ? `Search Results (${players.length})` : `Featured Competitors (${players.length})`}
        </span>
        {isPending && <span className="text-[#c5f94d] animate-pulse">Searching...</span>}
      </div>

      {/* Players List Grid */}
      {players.length > 0 ? (
        <div className="grid gap-2.5 sm:grid-cols-2">
          {players.map((player) => (
            <Link
              key={player.id}
              href={`/players/${player.id}`}
              className="group relative flex items-center justify-between rounded-2xl border border-[#273827] bg-[#101711] p-3 shadow-md transition-all hover:border-[#4b6a48] hover:bg-[#142015] active:scale-[0.99]"
            >
              {/* Left: Avatar & Identity */}
              <div className="flex items-center gap-3 min-w-0">
                <div className="relative">
                  <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl border border-[#374e35] bg-[#172318] font-black text-white shadow-inner">
                    {player.profileImage ? (
                      <img
                        src={player.profileImage}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span>{player.displayName[0]?.toUpperCase()}</span>
                    )}
                  </div>

                  {/* Online Indicator */}
                  {player.activityStatus === "ONLINE" && (
                    <span
                      title="Online"
                      className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#101711] bg-emerald-400"
                    />
                  )}
                </div>

                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-black text-white group-hover:text-[#c5f94d]">
                      {player.displayName}
                    </span>
                    {player.isVerified && (
                      <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-[#c5f94d]" />
                    )}
                  </div>

                  {/* Sub-identity row */}
                  <div className="flex items-center gap-2 text-[11px] text-[#7e917c]">
                    {player.username && <span>@{player.username}</span>}
                    {player.teamName && (
                      <span className="flex items-center gap-1 text-[#a5ba9f] font-bold truncate">
                        <Shield className="h-3 w-3 text-[#c5f94d]" />
                        <span className="truncate">{player.teamName}</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Right: Rank & XP badge */}
              <div className="flex items-center gap-2.5 shrink-0">
                <div className="flex flex-col items-end">
                  <span className="rounded bg-[#1b2b1b] px-2 py-0.5 text-[10px] font-black uppercase text-[#c5f94d]">
                    {player.rank}
                  </span>
                  <span className="text-[10px] font-bold text-[#6d806b]">
                    Lv. {player.level} · {player.xp.toLocaleString()} XP
                  </span>
                </div>
                <ChevronRight className="h-4 w-4 text-[#516450] transition-transform group-hover:translate-x-0.5 group-hover:text-white" />
              </div>
            </Link>
          ))}
        </div>
      ) : (
        /* Empty State */
        <div className="velox-card flex flex-col items-center justify-center p-8 text-center">
          <div className="grid h-14 w-14 place-items-center rounded-2xl border border-[#2b3d2b] bg-[#121c13] text-[#728570]">
            <Search className="h-7 w-7" />
          </div>
          <h3 className="mt-4 text-base font-black text-white">No Competitors Found</h3>
          <p className="mt-1 text-xs text-[#879986] max-w-xs">
            We couldn&apos;t find any players matching &ldquo;{query}&rdquo;. Try searching with a different
            username, game, or squad name.
          </p>
        </div>
      )}
    </div>
  );
}
