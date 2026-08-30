"use client";

import { useMemo, useState } from "react";
import { Calendar, ChevronRight, Gamepad2, Search, Trophy, Users } from "lucide-react";
import Link from "next/link";

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
  region: string | null;
  status: string;
  game: Game;
};

const categories = [
  { id: "all", label: "All" },
  { id: "live", label: "Live" },
  { id: "upcoming", label: "Upcoming" },
  { id: "free", label: "Free" },
  { id: "paid", label: "Paid" },
  { id: "solo", label: "Solo" },
  { id: "team", label: "Team" },
] as const;

function formatLabel(value: string) {
  return value.replaceAll("_", " ");
}

export function TournamentBrowser({ tournaments, games }: { tournaments: Tournament[]; games: Game[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<(typeof categories)[number]["id"]>("all");
  const [gameId, setGameId] = useState<string>("all");
  const [format, setFormat] = useState("all");
  const [region, setRegion] = useState("all");

  const formats = useMemo(() => [...new Set(tournaments.map((tournament) => tournament.format))], [tournaments]);
  const regions = useMemo(() => [...new Set(tournaments.map((tournament) => tournament.region).filter((value): value is string => Boolean(value)))], [tournaments]);
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return tournaments.filter((tournament) => {
      const matchesCategory = category === "all"
        || (category === "live" && tournament.status === "LIVE")
        || (category === "upcoming" && ["REGISTRATION_OPEN", "REGISTRATION_CLOSED", "UPCOMING", "CHECK_IN"].includes(tournament.status))
        || (category === "free" && !tournament.isPaid)
        || (category === "paid" && tournament.isPaid)
        || (category === "solo" && !["BATTLE_ROYALE", "LEAGUE"].includes(tournament.format))
        || (category === "team" && ["BATTLE_ROYALE", "LEAGUE"].includes(tournament.format));
      return matchesCategory
        && (gameId === "all" || tournament.game.id === gameId)
        && (format === "all" || tournament.format === format)
        && (region === "all" || tournament.region === region)
        && (!needle || `${tournament.title} ${tournament.game.name} ${tournament.region ?? ""}`.toLocaleLowerCase().includes(needle));
    });
  }, [category, format, gameId, query, region, tournaments]);

  return (
    <main className="velox-page">
      <header>
        <p className="velox-eyebrow">Compete</p>
        <h1 className="mt-2 text-4xl font-black tracking-[-0.05em] text-white sm:text-5xl">Tournaments</h1>
        <p className="mt-2 text-sm text-[#8e998f]">Find the next lobby, build your run.</p>
      </header>

      <label className="relative mt-7 block">
        <span className="sr-only">Search tournaments</span>
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#8e998f]" aria-hidden />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search tournaments" className="h-16 w-full rounded-[22px] border border-[#2a352b] bg-[#111811] py-3 pl-12 pr-4 text-base text-white outline-none placeholder:text-[#7f897f] focus:border-[#c5f94d]" />
      </label>

      <div className="mt-5 flex w-full gap-2 overflow-x-auto pb-2" aria-label="Tournament categories">
        {categories.map((item) => <button key={item.id} onClick={() => setCategory(item.id)} className={`h-12 shrink-0 rounded-xl px-5 text-sm font-black transition ${category === item.id ? "bg-[#c5f94d] text-[#090d09]" : "border border-[#2a352b] bg-[#111811] text-[#aeb8ad] hover:border-[#51644c] hover:text-white"}`}>{item.label}</button>)}
      </div>

      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
        <FilterSelect ariaLabel="Game" value={gameId} onChange={setGameId} options={[{ value: "all", label: "All games" }, ...games.map((game) => ({ value: game.id, label: game.name }))]} />
        <FilterSelect ariaLabel="Format" value={format} onChange={setFormat} options={[{ value: "all", label: "All formats" }, ...formats.map((value) => ({ value, label: formatLabel(value) }))]} />
        <FilterSelect ariaLabel="Region" value={region} onChange={setRegion} options={[{ value: "all", label: "All regions" }, ...regions.map((value) => ({ value, label: value }))]} />
      </div>

      <div className="mt-8 flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-black uppercase tracking-[0.07em] text-white">Open for registration</h2>
        <p className="text-xs font-black uppercase tracking-[0.1em] text-[#8e998f]">{filtered.length} {filtered.length === 1 ? "event" : "events"}</p>
      </div>
      <section className="mt-4 grid gap-4 sm:grid-cols-2">
        {filtered.length === 0 ? <EmptyState /> : filtered.map((tournament) => <TournamentCard key={tournament.id} tournament={tournament} />)}
      </section>
    </main>
  );
}

function TournamentCard({ tournament }: { tournament: Tournament }) {
  const date = new Date(tournament.startDate).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const isOpen = tournament.status === "REGISTRATION_OPEN";

  return (
    <Link href={`/tournaments/${tournament.slug}`} className="group block min-w-0 rounded-[24px] border border-[#2a352b] bg-[#111811] p-4 transition hover:-translate-y-0.5 hover:border-[#577246] hover:bg-[#151e15] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c5f94d]">
      <article className="flex h-full min-w-0 gap-4">
        <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl border border-[#3b5035] bg-[#1c3216] text-[#c5f94d]">
          <Gamepad2 className="h-7 w-7" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-[0.13em] text-[#aeb8ad]">{tournament.game.name}</span>
              <span className={`rounded-md px-2 py-1 text-[9px] font-black uppercase tracking-wide ${isOpen ? "bg-[#263c1c] text-[#d4ff76]" : "bg-[#202820] text-[#b7c0b5]"}`}>{isOpen ? "Registration open" : formatLabel(tournament.status)}</span>
            </div>
            <ChevronRight className="h-5 w-5 shrink-0 text-[#8e998f] transition group-hover:text-[#c5f94d]" aria-hidden />
          </div>
          <h3 className="mt-2 truncate text-xl font-black tracking-[-0.03em] text-white">{tournament.title}</h3>
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-bold text-[#aeb8ad]">
            <span className="text-[#c5f94d]">⭐ {tournament.prizePool} pool</span>
            <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" aria-hidden /> {tournament.currentParticipants} / {tournament.maxParticipants}</span>
            <span className="inline-flex items-center gap-1"><Calendar className="h-3.5 w-3.5" aria-hidden /> {date}</span>
          </div>
          <div className="mt-4 flex min-w-0 items-center justify-between gap-3 border-t border-[#29342a] pt-3 text-[10px] font-black uppercase tracking-[0.1em] text-[#7f897f]">
            <span className="min-w-0 truncate">{formatLabel(tournament.format)} · {tournament.region ?? "Global"}</span>
            <span className="text-[#dce3d6]">{tournament.isPaid ? `⭐ ${tournament.entryFee}` : "Free"}</span>
          </div>
        </div>
      </article>
    </Link>
  );
}

function EmptyState() {
  return <div className="velox-card col-span-full p-9 text-center"><Trophy className="mx-auto h-11 w-11 text-[#536053]" aria-hidden /><h2 className="mt-3 text-lg font-black text-white">No tournaments found</h2><p className="mx-auto mt-1 max-w-sm text-sm leading-relaxed text-[#8e998f]">Try a different search or filter. New competitions are added regularly.</p></div>;
}

function FilterSelect({ ariaLabel, value, onChange, options }: { ariaLabel: string; value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }> }) {
  return <select aria-label={ariaLabel} value={value} onChange={(event) => onChange(event.target.value)} className="h-11 min-w-0 rounded-xl border border-[#2a352b] bg-[#111811] px-3 text-sm font-semibold text-[#c8d0c5] outline-none focus:border-[#c5f94d]">{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>;
}
