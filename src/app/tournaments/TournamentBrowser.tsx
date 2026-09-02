"use client";

import { useMemo, useState } from "react";
import {
  Calendar,
  ChevronRight,
  Gamepad2,
  RotateCcw,
  Search,
  Trophy,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { TournamentFilterSelector } from "@/components/tournaments/TournamentFilterSelector";

type Game = { id: string; name: string };
type Tournament = {
  id: string;
  title: string;
  slug: string;
  prizePool: number;
  entryFee: number;
  isPaid: boolean;
  maxParticipants: number;
  currentParticipants: number;
  registrationDeadline: Date;
  startDate: Date;
  format: string;
  participantType: "INDIVIDUAL" | "TEAM";
  region: string | null;
  status: string;
  game: Game;
};

const categories = [
  { id: "all", label: "All Events" },
  { id: "live", label: "🔴 Live Now" },
  { id: "upcoming", label: "Upcoming" },
  { id: "free", label: "Free Entry" },
  { id: "paid", label: "High Stakes ⭐" },
  { id: "solo", label: "Solo (1v1)" },
  { id: "team", label: "Squads" },
] as const;

function formatLabel(value: string) {
  return value.replaceAll("_", " ");
}

export function TournamentBrowser({
  tournaments,
  games,
}: {
  tournaments: Tournament[];
  games: Game[];
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<(typeof categories)[number]["id"]>("all");
  const [gameId, setGameId] = useState<string>("all");
  const [format, setFormat] = useState("all");
  const [region, setRegion] = useState("all");

  const formats = useMemo(
    () => [...new Set(tournaments.map((tournament) => tournament.format))],
    [tournaments]
  );
  const regions = useMemo(
    () => [
      ...new Set(
        tournaments
          .map((tournament) => tournament.region)
          .filter((value): value is string => Boolean(value))
      ),
    ],
    [tournaments]
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return tournaments.filter((tournament) => {
      const matchesCategory =
        category === "all" ||
        (category === "live" && tournament.status === "LIVE") ||
        (category === "upcoming" &&
          ["REGISTRATION_OPEN", "REGISTRATION_CLOSED", "UPCOMING", "CHECK_IN"].includes(
            tournament.status
          )) ||
        (category === "free" && !tournament.isPaid) ||
        (category === "paid" && tournament.isPaid) ||
        (category === "solo" && tournament.participantType === "INDIVIDUAL") ||
        (category === "team" && tournament.participantType === "TEAM");

      return (
        matchesCategory &&
        (gameId === "all" || tournament.game.id === gameId) &&
        (format === "all" || tournament.format === format) &&
        (region === "all" || tournament.region === region) &&
        (!needle ||
          `${tournament.title} ${tournament.game.name} ${tournament.region ?? ""}`
            .toLocaleLowerCase()
            .includes(needle))
      );
    });
  }, [category, format, gameId, query, region, tournaments]);

  const resetFilters = () => {
    setQuery("");
    setCategory("all");
    setGameId("all");
    setFormat("all");
    setRegion("all");
  };

  return (
    <main className="velox-page">
      {/* Header */}
      <header>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[#c5f94d]">
            Battle Arena
          </span>
          <span className="text-[10px] text-[#425443]">·</span>
          <span className="rounded-full bg-[#172318] px-2 py-0.5 text-[10px] font-black uppercase text-[#d4ff76]">
            {tournaments.length} Active Events
          </span>
        </div>
        <h1 className="mt-1 text-3xl font-black tracking-[-0.04em] text-white sm:text-4xl">
          Tournaments
        </h1>
        <p className="mt-1 text-xs text-[#809081]">
          Discover daily cups, register solo or with squad, and climb the brackets.
        </p>
      </header>

      {/* Search Input */}
      <div className="relative mt-5">
        <Search
          className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#768777]"
          aria-hidden
        />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by game, tournament title, or region…"
          className="h-13 w-full rounded-2xl border border-[#233124] bg-[#0d140e] py-3 pl-11 pr-10 text-sm text-white outline-none placeholder:text-[#6a7a6b] transition focus:border-[#c5f94d] focus:ring-2 focus:ring-[#c5f94d]/15 shadow-[0_4px_16px_rgba(0,0,0,0.3)]"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="absolute right-3 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full bg-[#1e2a1f] text-[#a9b9a9] hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Category Pills */}
      <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide" aria-label="Categories">
        {categories.map((item) => {
          const isActive = category === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setCategory(item.id)}
              className={`h-10 shrink-0 rounded-xl px-3.5 text-xs font-black transition ${
                isActive
                  ? "bg-[#c5f94d] text-[#090d09] shadow-[0_0_12px_rgba(197,249,77,0.35)]"
                  : "border border-[#223023] bg-[#0e1610] text-[#869687] hover:border-[#384c39] hover:text-white"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {/* Custom Esports Filter Selectors */}
      <div className="mt-2.5 grid grid-cols-3 gap-2">
        <TournamentFilterSelector
          label="Game"
          title="Select Game"
          value={gameId}
          onChange={setGameId}
          options={[
            { value: "all", label: "All Games" },
            ...games.map((game) => ({ value: game.id, label: game.name })),
          ]}
        />
        <TournamentFilterSelector
          label="Format"
          title="Select Format"
          value={format}
          onChange={setFormat}
          options={[
            { value: "all", label: "All Formats" },
            ...formats.map((value) => ({ value, label: formatLabel(value) })),
          ]}
        />
        <TournamentFilterSelector
          label="Region"
          title="Select Region"
          value={region}
          onChange={setRegion}
          options={[
            { value: "all", label: "All Regions" },
            ...regions.map((value) => ({ value, label: value })),
          ]}
        />
      </div>

      {/* Section Counter & Results */}
      <div className="mt-6 flex items-baseline justify-between gap-3">
        <h2 className="text-xs font-black uppercase tracking-[0.14em] text-[#8e9f8f]">
          {filtered.length} {filtered.length === 1 ? "Tournament" : "Tournaments"} Available
        </h2>
        {(category !== "all" || gameId !== "all" || format !== "all" || region !== "all" || query) && (
          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex items-center gap-1 text-[11px] font-bold text-[#c5f94d] hover:text-[#d5ff70]"
          >
            <RotateCcw className="h-3 w-3" /> Reset
          </button>
        )}
      </div>

      {/* Grid of Cards */}
      <section className="mt-3 grid gap-3 sm:grid-cols-2">
        {filtered.length === 0 ? (
          <EmptyState onReset={resetFilters} />
        ) : (
          filtered.map((tournament) => (
            <TournamentCard key={tournament.id} tournament={tournament} />
          ))
        )}
      </section>
    </main>
  );
}

function TournamentCard({ tournament }: { tournament: Tournament }) {
  const date = new Date(tournament.startDate).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  const isOpen = tournament.status === "REGISTRATION_OPEN";
  const isLive = tournament.status === "LIVE";
  const isCheckIn = tournament.status === "CHECK_IN";

  // Participant progress
  const participantPercent = Math.min(
    100,
    Math.round((tournament.currentParticipants / tournament.maxParticipants) * 100)
  );

  const badgeStyles = isLive
    ? "bg-red-500/15 text-red-300 border-red-500/25"
    : isCheckIn
    ? "bg-amber-400/15 text-amber-300 border-amber-400/25"
    : isOpen
    ? "bg-[#253d1d] text-[#c5f94d] border-[#38592c]"
    : "bg-[#182219] text-[#7d8d7e] border-[#253326]";

  const dotStyles = isLive
    ? "bg-red-400 animate-pulse"
    : isCheckIn
    ? "bg-amber-400"
    : isOpen
    ? "bg-[#c5f94d]"
    : "bg-[#7d8d7e]";

  return (
    <Link
      href={`/tournaments/${tournament.slug}`}
      className="group flex flex-col justify-between rounded-2xl border border-[#233124] bg-[#0e1610] p-4 transition duration-150 hover:-translate-y-0.5 hover:border-[#3e5934] hover:bg-[#121c13] shadow-[0_6px_24px_rgba(0,0,0,0.35)] focus-visible:outline-2 focus-visible:outline-[#c5f94d]"
    >
      <div>
        {/* Top Badges */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-lg bg-[#18251a] px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-[#d4ff76]">
              <Gamepad2 className="h-3 w-3" aria-hidden />
              {tournament.game.name}
            </span>
            <span className="rounded-lg bg-[#141d15] px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-[#829283]">
              {tournament.participantType === "INDIVIDUAL" ? "1v1" : "Squad"}
            </span>
          </div>

          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${badgeStyles}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${dotStyles}`} />
            {isLive
              ? "Live"
              : isCheckIn
              ? "Check-In"
              : isOpen
              ? "Open"
              : formatLabel(tournament.status)}
          </span>
        </div>

        {/* Title */}
        <h3 className="mt-3 truncate text-base font-black tracking-tight text-white group-hover:text-[#c5f94d] transition-colors">
          {tournament.title}
        </h3>

        {/* Prize Pool Spotlight */}
        <div className="mt-2.5 flex items-baseline justify-between">
          <div>
            <p className="text-[9px] font-black uppercase tracking-wider text-[#798a7a]">Prize Pool</p>
            <p className="text-xl font-black text-[#c5f94d]">
              ⭐ {tournament.prizePool.toLocaleString()}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[9px] font-black uppercase tracking-wider text-[#798a7a]">Entry Fee</p>
            <p className="text-xs font-black text-white">
              {tournament.isPaid ? `⭐ ${tournament.entryFee.toLocaleString()}` : "Free"}
            </p>
          </div>
        </div>

        {/* Participant Progress Bar */}
        <div className="mt-3">
          <div className="flex items-center justify-between text-[10px] font-bold text-[#809081]">
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {tournament.currentParticipants} / {tournament.maxParticipants} registered
            </span>
            <span>{participantPercent}% full</span>
          </div>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[#182319]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#7bb92a] to-[#c5f94d]"
              style={{ width: `${participantPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="mt-4 flex items-center justify-between border-t border-[#1e2a20] pt-2.5 text-[10px] font-bold text-[#7d8d7e]">
        <span className="flex items-center gap-1 truncate">
          <Calendar className="h-3 w-3" />
          {date}
        </span>
        <span className="inline-flex items-center gap-1 text-[11px] font-black text-[#c5f94d] group-hover:translate-x-0.5 transition-transform">
          View <ChevronRight className="h-3.5 w-3.5" />
        </span>
      </div>
    </Link>
  );
}

function EmptyState({ onReset }: { onReset: () => void }) {
  return (
    <div className="velox-card col-span-full p-8 text-center">
      <Trophy className="mx-auto h-10 w-10 text-[#4c5c4d]" aria-hidden />
      <h2 className="mt-3 text-base font-black text-white">No tournaments found</h2>
      <p className="mx-auto mt-1 max-w-xs text-xs text-[#7e8e7f]">
        No events match your current search or filter criteria.
      </p>
      <button
        type="button"
        onClick={onReset}
        className="velox-action mt-4 text-xs font-black"
      >
        Reset all filters
      </button>
    </div>
  );
}

