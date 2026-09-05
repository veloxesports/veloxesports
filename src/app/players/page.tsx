import type { Metadata } from "next";
import { searchPlayers } from "@/features/players/actions";
import { PlayerSearchClient } from "@/components/players/PlayerSearchClient";
import { Users } from "lucide-react";

export const metadata: Metadata = {
  title: "Player Search & Discovery | Khemora",
  description: "Search and explore players, squads, and competitive rankings on Khemora.",
};

export default async function PlayersPage() {
  const result = await searchPlayers("");
  const initialPlayers = result.success ? result.data : [];

  return (
    <main className="velox-page">
      {/* Header */}
      <header className="mb-6">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[#c5f94d]">
            Community
          </span>
          <span className="text-[10px] text-[#425443]">·</span>
          <span className="rounded-full bg-[#172318] px-2 py-0.5 text-[10px] font-black uppercase text-[#d4ff76]">
            Player Discovery
          </span>
        </div>
        <h1 className="mt-1 text-3xl font-black tracking-[-0.04em] text-white sm:text-4xl flex items-center gap-2.5">
          <Users className="h-7 w-7 text-[#c5f94d]" />
          <span>Find Players</span>
        </h1>
        <p className="mt-1 text-xs text-[#809081]">
          Search competitive players, view verified profiles, scout rivals, and compare records.
        </p>
      </header>

      {/* Search Client */}
      <PlayerSearchClient initialPlayers={initialPlayers} />
    </main>
  );
}
