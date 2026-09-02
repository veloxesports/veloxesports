import { Search, Trophy, Users } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { getAdminSearchResults } from "@/features/admin/insights";

/* eslint-disable @next/next/no-img-element -- Player avatars originate from Telegram or Supabase. */

export default async function AdminSearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const query = q.trim();
  const result = await getAdminSearchResults(query);
  const data = result.success ? result.data : null;
  const players = data?.players ?? [];
  const tournaments = data?.tournaments ?? [];
  const hasResults = players.length > 0 || tournaments.length > 0;

  return <main className="velox-page"><header><p className="velox-eyebrow">Global platform search</p><h1 className="mt-1 text-2xl font-black tracking-[-0.05em] text-white sm:text-3xl">Search results</h1><p className="mt-1 text-sm text-[#8e998f]">{query.length >= 2 ? <>Results for <span className="font-bold text-white">“{query}”</span></> : "Enter at least two characters in the command bar to search VELOX records."}</p></header>{!result.success ? <section className="velox-card mt-5 p-5 text-sm text-[#ffad9a]">{result.error}</section> : !hasResults ? <section className="velox-card mt-5 px-5 py-14 text-center"><Search className="mx-auto h-9 w-9 text-[#526052]" aria-hidden /><p className="mt-3 font-black text-white">No matching records</p><p className="mt-1 text-sm text-[#8e998f]">Try a player name, handle, tournament title, or game name.</p></section> : <section className="mt-5 grid gap-4 xl:grid-cols-2"><ResultGroup icon={<Users className="h-5 w-5" aria-hidden />} title="Players" empty="No players matched this search.">{players.map((player) => <Link key={player.id} href="/admin/insights/players" className="flex items-center gap-3 px-5 py-3.5 transition hover:bg-[#172117]"><Avatar imageUrl={player.imageUrl} label={player.name} /><span className="min-w-0"><span className="block truncate text-sm font-black text-white">{player.name}</span><span className="mt-0.5 block truncate text-xs text-[#8e998f]">{player.detail}</span></span></Link>)}</ResultGroup><ResultGroup icon={<Trophy className="h-5 w-5" aria-hidden />} title="Tournaments" empty="No tournaments matched this search.">{tournaments.map((tournament) => <Link key={tournament.id} href={`/admin/tournaments/${tournament.id}`} className="flex items-center gap-3 px-5 py-3.5 transition hover:bg-[#172117]"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#1f3119] text-[#c5f94d]"><Trophy className="h-4 w-4" aria-hidden /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-black text-white">{tournament.title}</span><span className="mt-0.5 block truncate text-xs text-[#8e998f]">{tournament.detail}</span></span><span className="shrink-0 rounded-full bg-[#20331b] px-2 py-1 text-[9px] font-black uppercase tracking-[0.08em] text-[#c5f94d]">{tournament.status.replaceAll("_", " ")}</span></Link>)}</ResultGroup></section>}</main>;
}

function ResultGroup({ icon, title, empty, children }: { icon: ReactNode; title: string; empty: string; children: ReactNode }) {
  const populated = Array.isArray(children) && children.length > 0;
  return <section className="velox-card overflow-hidden"><div className="flex items-center gap-2 border-b border-[#29342a] px-5 py-4 text-[#c5f94d]">{icon}<h2 className="text-base font-black text-white">{title}</h2></div>{populated ? <div className="divide-y divide-[#29342a]">{children}</div> : <p className="px-5 py-10 text-center text-sm text-[#8e998f]">{empty}</p>}</section>;
}

function Avatar({ imageUrl, label }: { imageUrl: string | null; label: string }) {
  return imageUrl ? <img src={imageUrl} alt="" className="h-9 w-9 shrink-0 rounded-xl border border-[#40503e] object-cover" /> : <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#1f3119] text-xs font-black text-[#c5f94d]">{label.slice(0, 1).toUpperCase()}</span>;
}
