"use client";

import { useMemo, useState } from "react";
import { ChevronRight, MapPin, Swords } from "lucide-react";
import Link from "next/link";
import { isMatchInCenterTab, matchCenterScoreLabel, type MatchCenterTab } from "@/lib/matches/flow";

type Match = {
  id: string;
  tournamentTitle: string;
  gameName: string;
  round: number;
  scheduledTime: Date | null;
  status: string;
  score1: number | null;
  score2: number | null;
  player1: { name: string; isCurrentUser: boolean };
  player2: { name: string; isCurrentUser: boolean };
};

const tabs = ["Upcoming", "Live", "Completed"] as const;
type Tab = MatchCenterTab;

export function MatchCenter({ matches }: { matches: Match[] }) {
  const [tab, setTab] = useState<Tab>("Upcoming");
  const filtered = useMemo(() => matches.filter((match) => isMatchInCenterTab(match.status, tab)), [matches, tab]);

  return (
    <main className="velox-page">
      <header><p className="velox-eyebrow">Your competition</p><h1 className="mt-2 text-4xl font-black tracking-[-0.05em] text-white sm:text-5xl">Match Center</h1></header>
      <div className="mt-7 flex gap-7 border-b border-[#2a352b]" role="tablist" aria-label="Match status">
        {tabs.map((item) => <button key={item} role="tab" aria-selected={tab === item} onClick={() => setTab(item)} className={`relative pb-4 text-sm font-black uppercase tracking-[0.05em] transition ${tab === item ? "text-[#c5f94d]" : "text-[#7f897f] hover:text-[#c8d0c5]"}`}>{item}{tab === item && <span className="absolute inset-x-0 -bottom-px h-0.5 bg-[#c5f94d]" />}</button>)}
      </div>
      <section className="mt-5 space-y-4">
        {filtered.length ? filtered.map((match) => <MatchCard key={match.id} match={match} />) : <EmptyMatches tab={tab} />}
      </section>
    </main>
  );
}

function MatchCard({ match }: { match: Match }) {
  const isLive = match.status === "LIVE";
  const isCompleted = match.status === "COMPLETED";
  const date = match.scheduledTime ? new Date(match.scheduledTime).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "Schedule pending";
  const statusLabel = isLive ? "Live now" : isCompleted ? "Final" : match.status === "AWAITING_RESULT" ? "Result pending" : match.status === "UNDER_REVIEW" ? "Under review" : match.status === "DISPUTED" ? "Disputed" : match.status.replaceAll("_", " ");

  const needsReview = ["AWAITING_RESULT", "UNDER_REVIEW", "DISPUTED"].includes(match.status);
  const badgeClass = isLive ? "bg-red-500/15 text-red-300" : needsReview ? "bg-amber-400/15 text-amber-200" : isCompleted ? "bg-[#202920] text-[#b5c0b3]" : "bg-[#263c1c] text-[#d4ff76]";
  const dotClass = isLive ? "animate-pulse bg-red-400" : needsReview ? "bg-amber-300" : isCompleted ? "bg-[#7f897f]" : "bg-[#c5f94d]";

  return (
    <Link href={`/matches/${match.id}`} className="group block rounded-[26px] border border-[#2a352b] bg-[#111811] p-5 transition hover:-translate-y-0.5 hover:border-[#577246] hover:bg-[#151e15] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c5f94d]">
      <article>
        <div className="flex items-center justify-between gap-3">
          <span className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-[10px] font-black uppercase tracking-[0.1em] ${badgeClass}`}><span className={`h-2 w-2 rounded-full ${dotClass}`} />{statusLabel}</span>
          <span className="text-[10px] font-black uppercase tracking-[0.09em] text-[#899489]">{date}</span>
        </div>
        <p className="mt-5 text-[11px] font-black uppercase tracking-[0.12em] text-[#aeb8ad]">{match.gameName} · Round {match.round} · {match.tournamentTitle}</p>
        <div className="mt-6 grid grid-cols-[1fr_auto_1fr] items-center gap-3"><Participant participant={match.player1} score={match.score1} align="left" /><div className="text-center"><span className="text-lg font-black text-[#8e998f]">{matchCenterScoreLabel(match.status, match.score1, match.score2)}</span></div><Participant participant={match.player2} score={match.score2} align="right" /></div>
        <div className="mt-6 flex items-center justify-between border-t border-[#29342a] pt-4"><span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#8e998f]"><MapPin className="h-4 w-4" aria-hidden /> Online arena</span><ChevronRight className="h-5 w-5 text-[#c5f94d] transition group-hover:translate-x-0.5" aria-hidden /></div>
      </article>
    </Link>
  );
}

function Participant({ participant, score, align }: { participant: Match["player1"]; score: number | null; align: "left" | "right" }) {
  const initial = participant.name[0]?.toUpperCase() ?? "?";
  return <div className={`min-w-0 ${align === "right" ? "text-right" : "text-left"}`}><div className={`inline-grid h-14 w-14 place-items-center rounded-2xl text-lg font-black ${participant.isCurrentUser ? "bg-[#c5f94d] text-[#090d09]" : "bg-[#283129] text-white"}`}>{initial}</div><p className="mt-2 truncate text-sm font-black text-white">{participant.name}</p>{score !== null && <p className="mt-1 text-xs font-bold text-[#aeb8ad]">Score {score}</p>}</div>;
}

function EmptyMatches({ tab }: { tab: Tab }) {
  const copy = tab === "Upcoming" ? "Join a tournament to unlock your next match." : tab === "Live" ? "No live or result-review matches are assigned to you right now." : "Completed matches will appear here after your results are confirmed.";
  return <div className="velox-card p-9 text-center"><Swords className="mx-auto h-11 w-11 text-[#536053]" aria-hidden /><h2 className="mt-4 text-lg font-black text-white">No {tab.toLowerCase()} matches</h2><p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-[#8e998f]">{copy}</p>{tab === "Upcoming" && <Link href="/tournaments" className="velox-action mt-5">Explore tournaments</Link>}</div>;
}
