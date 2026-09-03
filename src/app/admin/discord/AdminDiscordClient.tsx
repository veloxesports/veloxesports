"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Check,
  Copy,
  MessageSquare,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import type { AdminDiscordStatsData } from "@/features/admin/actions";

type DiscordData = AdminDiscordStatsData;

export function AdminDiscordClient({ data }: { data: DiscordData }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterMode, setFilterMode] = useState<"all" | "connected" | "unconnected">("all");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filteredProfiles = data.profiles.filter((p) => {
    if (filterMode === "connected" && !p.discordConnected) return false;
    if (filterMode === "unconnected" && p.discordConnected) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const pName = p.playerName.toLowerCase();
      const dName = p.discordUsername?.toLowerCase() ?? "";
      const dDisp = p.discordDisplayName?.toLowerCase() ?? "";
      const dId = p.discordId?.toLowerCase() ?? "";
      const teleId = p.telegramId.toLowerCase();
      if (!pName.includes(q) && !dName.includes(q) && !dDisp.includes(q) && !dId.includes(q) && !teleId.includes(q)) {
        return false;
      }
    }
    return true;
  });

  function copyToClipboard(id: string) {
    void navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  return (
    <main className="velox-page">
      {/* Header */}
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="velox-eyebrow">Community & Identity</p>
          <h1 className="mt-1 text-2xl font-black tracking-[-0.05em] text-white sm:text-3xl">
            Discord Integrations Hub
          </h1>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-[#8e998f]">
            Monitor Discord account bindings, verified tags, Snowflake IDs, and community member synchronization.
          </p>
        </div>
      </header>

      {/* KPI Counters */}
      <section className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-[#2f4530] bg-[#121b12] p-4">
          <p className="text-2xl font-black text-white">{data.totalUsers}</p>
          <p className="mt-0.5 text-[10px] font-black uppercase tracking-[0.1em] text-[#8e998f]">Platform players</p>
        </div>
        <div className="rounded-2xl border border-[#404c82] bg-[#171b30] p-4">
          <p className="text-2xl font-black text-[#849bf8]">{data.totalConnected}</p>
          <p className="mt-0.5 text-[10px] font-black uppercase tracking-[0.1em] text-[#a5b6f5]">Discord connected</p>
        </div>
        <div className="rounded-2xl border border-[#2f4530] bg-[#121b12] p-4">
          <p className="text-2xl font-black text-[#c5f94d]">{data.connectionRate}%</p>
          <p className="mt-0.5 text-[10px] font-black uppercase tracking-[0.1em] text-[#8e998f]">Adoption rate</p>
        </div>
        <div className="rounded-2xl border border-[#2f4530] bg-[#121b12] p-4">
          <p className="text-2xl font-black text-[#f0cf78]">{data.recentConnected}</p>
          <p className="mt-0.5 text-[10px] font-black uppercase tracking-[0.1em] text-[#8e998f]">Linked in last 7 days</p>
        </div>
      </section>

      {/* Search & Filter */}
      <section className="mt-5 flex flex-col gap-3 rounded-2xl border border-[#273628] bg-[#0e150f] p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1 text-xs">
          <button
            type="button"
            onClick={() => setFilterMode("all")}
            className={`rounded-lg px-3 py-1.5 font-bold transition ${filterMode === "all" ? "bg-[#1f311c] text-[#c5f94d]" : "text-[#8e998f] hover:text-white"}`}
          >
            All players
          </button>
          <button
            type="button"
            onClick={() => setFilterMode("connected")}
            className={`rounded-lg px-3 py-1.5 font-bold transition ${filterMode === "connected" ? "bg-[#252f59] text-[#849bf8]" : "text-[#8e998f] hover:text-white"}`}
          >
            Connected ({data.totalConnected})
          </button>
          <button
            type="button"
            onClick={() => setFilterMode("unconnected")}
            className={`rounded-lg px-3 py-1.5 font-bold transition ${filterMode === "unconnected" ? "bg-[#1f311c] text-[#c5f94d]" : "text-[#8e998f] hover:text-white"}`}
          >
            Unlinked ({data.unconnected})
          </button>
        </div>

        <div className="flex items-center gap-2 rounded-xl border border-[#2d3e2e] bg-[#121a13] px-3 py-1.5 text-xs text-[#8e998f]">
          <Search className="h-3.5 w-3.5 text-[#6c7b6c]" />
          <input
            type="text"
            placeholder="Search Discord username, ID, player..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-56 bg-transparent text-white outline-none placeholder:text-[#5f6f5f]"
          />
          {searchQuery && (
            <button type="button" onClick={() => setSearchQuery("")} className="text-[#8e998f] hover:text-white">
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </section>

      {/* Profiles Table */}
      <section className="velox-card mt-5 overflow-hidden">
        {filteredProfiles.length === 0 ? (
          <div className="py-16 text-center">
            <MessageSquare className="mx-auto h-10 w-10 text-[#4c5b4c]" aria-hidden />
            <p className="mt-3 font-bold text-white">No Discord profiles found</p>
            <p className="mt-1 text-xs text-[#8e998f]">Try adjusting your search query or filter mode.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[#232f24] bg-[#0c130d] text-[10px] font-black uppercase tracking-[0.1em] text-[#8e998f]">
                <tr>
                  <th className="px-5 py-3">Player</th>
                  <th className="px-4 py-3">Discord Tag</th>
                  <th className="px-4 py-3">Snowflake ID</th>
                  <th className="px-4 py-3">Connected Date</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Player Desk</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e2b20]">
                {filteredProfiles.map((p) => (
                  <tr key={p.id} className="transition hover:bg-[#131d14]">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        {p.profileImage ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.profileImage} alt="" className="h-9 w-9 rounded-full object-cover" />
                        ) : (
                          <span className="grid h-9 w-9 place-items-center rounded-full bg-[#1c291c] text-xs font-black text-[#c5f94d]">
                            {p.playerName.slice(0, 1).toUpperCase()}
                          </span>
                        )}
                        <div className="min-w-0">
                          <p className="font-bold text-white">{p.playerName}</p>
                          <p className="text-xs text-[#788877]">Rank: {p.rank} · Lv. {p.level}</p>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3.5">
                      {p.discordConnected ? (
                        <div className="flex items-center gap-2.5">
                          {p.discordAvatarUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={p.discordAvatarUrl} alt="" className="h-7 w-7 rounded-full border border-[#5865F2]" />
                          ) : (
                            <span className="grid h-7 w-7 place-items-center rounded-full bg-[#202742] text-xs text-[#849bf8]">
                              <MessageSquare className="h-3.5 w-3.5" />
                            </span>
                          )}
                          <div className="text-xs">
                            <p className="font-bold text-[#849bf8]">@{p.discordUsername ?? "unknown"}</p>
                            {p.discordDisplayName && (
                              <p className="text-[10px] text-[#9aabd4]">{p.discordDisplayName}</p>
                            )}
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-[#5e6d5e]">Not connected</span>
                      )}
                    </td>

                    <td className="px-4 py-3.5">
                      {p.discordId ? (
                        <div className="flex items-center gap-1.5">
                          <code className="rounded bg-[#121820] px-2 py-0.5 font-mono text-xs text-[#9eb6f0]">
                            {p.discordId}
                          </code>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(p.discordId!)}
                            className="rounded p-1 text-[#6e7d9e] transition hover:text-white"
                            title="Copy Discord ID"
                          >
                            {copiedId === p.discordId ? (
                              <Check className="h-3 w-3 text-[#c5f94d]" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-[#5e6d5e]">—</span>
                      )}
                    </td>

                    <td className="px-4 py-3.5 text-xs text-[#8e998f]">
                      {p.discordConnectedAt
                        ? new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(p.discordConnectedAt))
                        : "—"}
                    </td>

                    <td className="px-4 py-3.5">
                      {p.discordConnected ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-[#404c82] bg-[#1e2544] px-2.5 py-0.5 text-[9px] font-black uppercase tracking-[0.08em] text-[#849bf8]">
                          <ShieldCheck className="h-3 w-3" />
                          <span>Connected</span>
                        </span>
                      ) : (
                        <span className="rounded-full border border-[#273227] bg-[#141b14] px-2.5 py-0.5 text-[9px] font-bold text-[#718071]">
                          Unlinked
                        </span>
                      )}
                    </td>

                    <td className="px-5 py-3.5 text-right">
                      <Link
                        href="/admin/players"
                        className="rounded-lg border border-[#2b3a2c] bg-[#121a13] px-2.5 py-1 text-xs font-bold text-[#b6c5b2] transition hover:border-[#527448] hover:text-white"
                      >
                        Profile
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
