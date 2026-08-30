"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Calendar, Search, Trophy, Users } from "lucide-react";
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
    <main className="min-h-screen bg-black p-4 pb-24 text-slate-100">
      <header className="pt-2"><h1 className="text-3xl font-black tracking-tight text-white">Tournaments</h1><p className="mt-1 text-sm text-slate-400">Discover your next competition.</p></header>
      <div className="relative mt-5"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden /><input aria-label="Search tournaments" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search tournaments or games" className="w-full rounded-xl border border-white/10 bg-slate-900 py-3 pl-10 pr-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-violet-400" /></div>
      <div className="mt-4 flex gap-2 overflow-x-auto pb-2" aria-label="Tournament categories">{categories.map((item) => <button key={item.id} onClick={() => setCategory(item.id)} className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition ${category === item.id ? "bg-violet-600 text-white" : "border border-white/10 bg-slate-900 text-slate-300 hover:bg-slate-800"}`}>{item.label}</button>)}</div>
      <div className="mt-2 grid grid-cols-3 gap-2"><FilterSelect ariaLabel="Game" value={gameId} onChange={setGameId} options={[{ value: "all", label: "All games" }, ...games.map((game) => ({ value: game.id, label: game.name }))]} /><FilterSelect ariaLabel="Format" value={format} onChange={setFormat} options={[{ value: "all", label: "All formats" }, ...formats.map((value) => ({ value, label: formatLabel(value) }))]} /><FilterSelect ariaLabel="Region" value={region} onChange={setRegion} options={[{ value: "all", label: "All regions" }, ...regions.map((value) => ({ value, label: value }))]} /></div>
      <p className="mt-5 text-xs font-medium text-slate-500">{filtered.length} {filtered.length === 1 ? "tournament" : "tournaments"} found</p>
      <section className="mt-3 flex flex-col gap-4">{filtered.length === 0 ? <div className="rounded-2xl border border-white/5 bg-slate-900/60 p-8 text-center"><Trophy className="mx-auto h-12 w-12 text-slate-700" aria-hidden /><h2 className="mt-3 text-lg font-bold text-slate-200">No tournaments found</h2><p className="mt-1 text-sm text-slate-500">Try a different search or filter. New competitions are added regularly.</p></div> : filtered.map((tournament) => <TournamentCard key={tournament.id} tournament={tournament} />)}</section>
    </main>
  );
}

function TournamentCard({ tournament }: { tournament: Tournament }) {
  return <Link href={`/tournaments/${tournament.slug}`} className="block rounded-2xl border border-white/10 bg-gradient-to-b from-slate-900 to-black shadow-xl transition hover:border-violet-400/40"><article><div className="relative flex h-28 items-center justify-center overflow-hidden bg-indigo-950"><div className="absolute inset-0 bg-gradient-to-r from-violet-900/50 to-indigo-900/50" /><Trophy className="absolute -bottom-5 -right-3 h-20 w-20 rotate-12 text-white/10" aria-hidden /><span className="relative text-2xl font-black italic tracking-widest text-white/60">{tournament.game.name.toUpperCase()}</span></div><div className="relative p-4"><span className={`absolute -top-5 right-4 rounded-xl border border-white/10 bg-black px-3 py-1.5 text-xs font-bold text-white shadow-lg`}>{tournament.status === "REGISTRATION_OPEN" ? "OPEN" : formatLabel(tournament.status)}</span><h2 className="pr-12 text-lg font-bold text-white">{tournament.title}</h2><p className="mt-1 text-xs text-slate-500">{formatLabel(tournament.format)} · {tournament.region ?? "Global"}</p><div className="mt-4 grid grid-cols-2 gap-y-3"><Metric icon={<Trophy className="h-4 w-4 text-amber-400" />} label="Prize pool" value={`⭐ ${tournament.prizePool}`} /><Metric icon={<span className="text-[10px] font-black text-slate-200">FEE</span>} label="Entry" value={tournament.isPaid ? `⭐ ${tournament.entryFee}` : "FREE"} /><Metric icon={<Users className="h-4 w-4 text-blue-300" />} label="Players" value={`${tournament.currentParticipants} / ${tournament.maxParticipants}`} /><Metric icon={<Calendar className="h-4 w-4 text-violet-300" />} label="Starts" value={new Date(tournament.startDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })} /></div></div></article></Link>;
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return <div className="flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800">{icon}</span><span><span className="block text-[10px] font-bold uppercase text-slate-500">{label}</span><span className="text-sm font-bold text-white">{value}</span></span></div>;
}

function FilterSelect({ ariaLabel, value, onChange, options }: { ariaLabel: string; value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }> }) {
  return <select aria-label={ariaLabel} value={value} onChange={(event) => onChange(event.target.value)} className="min-w-0 rounded-lg border border-white/10 bg-slate-900 px-2 py-2 text-xs text-slate-200 outline-none focus:border-violet-400">{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>;
}
