"use client";

import { useMemo, useState } from "react";
import {
  ChevronRight,
  Clock,
  MapPin,
  Swords,
} from "lucide-react";
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

  const tabCounts = useMemo(
    () => ({
      Upcoming: matches.filter((m) => isMatchInCenterTab(m.status, "Upcoming")).length,
      Live: matches.filter((m) => isMatchInCenterTab(m.status, "Live")).length,
      Completed: matches.filter((m) => isMatchInCenterTab(m.status, "Completed")).length,
    }),
    [matches]
  );

  const filtered = useMemo(
    () => matches.filter((match) => isMatchInCenterTab(match.status, tab)),
    [matches, tab]
  );

  return (
    <main className="velox-page">
      {/* Header */}
      <header>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[#c5f94d]">
            Match Arena
          </span>
          <span className="text-[10px] text-[#425443]">·</span>
          <span className="rounded-full bg-[#172318] px-2 py-0.5 text-[10px] font-black uppercase text-[#d4ff76]">
            {matches.length} Total Fixtures
          </span>
        </div>
        <h1 className="mt-1 text-3xl font-black tracking-[-0.04em] text-white sm:text-4xl">
          Match Center
        </h1>
        <p className="mt-1 text-xs text-[#809081]">
          View your scheduled fixtures, submit verified scores, and track match evidence.
        </p>
      </header>

      {/* Segmented Tab Controls */}
      <div
        className="mt-5 grid grid-cols-3 rounded-2xl border border-[#233124] bg-[#0c130e] p-1.5 shadow-[0_4px_16px_rgba(0,0,0,0.3)]"
        role="tablist"
        aria-label="Match status"
      >
        {tabs.map((item) => {
          const isActive = tab === item;
          const count = tabCounts[item];
          return (
            <button
              key={item}
              role="tab"
              aria-selected={isActive}
              onClick={() => setTab(item)}
              className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-black transition ${
                isActive
                  ? "bg-[#c5f94d] text-[#090d09] shadow-[0_0_12px_rgba(197,249,77,0.35)]"
                  : "text-[#7f8f80] hover:text-white"
              }`}
            >
              <span>{item}</span>
              <span
                className={`rounded-full px-1.5 py-0.2 text-[9px] font-black ${
                  isActive ? "bg-[#090d09]/20 text-[#090d09]" : "bg-[#182319] text-[#a4b5a4]"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Match Cards List */}
      <section className="mt-5 space-y-3">
        {filtered.length ? (
          filtered.map((match) => <MatchCard key={match.id} match={match} />)
        ) : (
          <EmptyMatches tab={tab} />
        )}
      </section>
    </main>
  );
}

function MatchCard({ match }: { match: Match }) {
  const isLive = match.status === "LIVE";
  const isCompleted = match.status === "COMPLETED";
  const isDisputed = match.status === "DISPUTED";
  const needsReview = ["AWAITING_RESULT", "UNDER_REVIEW", "DISPUTED"].includes(match.status);

  const date = match.scheduledTime
    ? new Date(match.scheduledTime).toLocaleString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "Time pending";

  const statusLabel = isLive
    ? "Live Battle"
    : isCompleted
    ? "Final Score"
    : isDisputed
    ? "Under Dispute"
    : match.status === "AWAITING_RESULT"
    ? "Result Pending"
    : match.status === "UNDER_REVIEW"
    ? "Under Review"
    : match.status.replaceAll("_", " ");

  const badgeClass = isLive
    ? "bg-red-500/15 text-red-300 border-red-500/30"
    : isDisputed
    ? "bg-rose-500/20 text-rose-300 border-rose-500/30"
    : needsReview
    ? "bg-amber-400/15 text-amber-200 border-amber-400/30"
    : isCompleted
    ? "bg-[#1b251c] text-[#93a694] border-[#29362a]"
    : "bg-[#253d1d] text-[#c5f94d] border-[#38592c]";

  const dotClass = isLive
    ? "animate-pulse bg-red-400"
    : isDisputed
    ? "bg-rose-400"
    : needsReview
    ? "bg-amber-400"
    : isCompleted
    ? "bg-[#6d7e6f]"
    : "bg-[#c5f94d]";

  return (
    <Link
      href={`/matches/${match.id}`}
      className="group block rounded-2xl border border-[#233124] bg-[#0e1610] p-4 transition duration-150 hover:-translate-y-0.5 hover:border-[#3e5934] hover:bg-[#121c13] shadow-[0_6px_24px_rgba(0,0,0,0.35)] focus-visible:outline-2 focus-visible:outline-[#c5f94d]"
    >
      <article>
        {/* Top Status & Date */}
        <div className="flex items-center justify-between gap-3">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider ${badgeClass}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} />
            {statusLabel}
          </span>
          <span className="flex items-center gap-1 text-[10px] font-bold text-[#7d8e7e]">
            <Clock className="h-3 w-3" />
            {date}
          </span>
        </div>

        {/* Tournament & Game Context */}
        <p className="mt-2.5 text-xs font-semibold text-[#8ca18d]">
          {match.gameName} · Round {match.round} ·{" "}
          <span className="text-white font-bold">{match.tournamentTitle}</span>
        </p>

        {/* Versus Arena Display */}
        <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-xl border border-[#1d2b1f] bg-[#0b120c] p-3.5">
          <Participant participant={match.player1} score={match.score1} align="left" />

          <div className="flex flex-col items-center justify-center px-2">
            <span className="rounded-lg bg-[#182519] px-2.5 py-1 text-[11px] font-black tracking-wider text-[#c5f94d]">
              {matchCenterScoreLabel(match.status, match.score1, match.score2)}
            </span>
          </div>

          <Participant participant={match.player2} score={match.score2} align="right" />
        </div>

        {/* Card Footer Actions */}
        <div className="mt-3.5 flex items-center justify-between border-t border-[#1e2a20] pt-2.5 text-[10px] font-bold text-[#7f9180]">
          <span className="flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5 text-[#5e7060]" aria-hidden />
            Khemora Server Arena
          </span>
          <span className="inline-flex items-center gap-1 text-[11px] font-black text-[#c5f94d] group-hover:translate-x-0.5 transition-transform">
            {needsReview ? "Submit Result" : isLive ? "Enter Lobby" : "Match Room"}
            <ChevronRight className="h-3.5 w-3.5" />
          </span>
        </div>
      </article>
    </Link>
  );
}

function Participant({
  participant,
  score,
  align,
}: {
  participant: Match["player1"];
  score: number | null;
  align: "left" | "right";
}) {
  const initial = participant.name[0]?.toUpperCase() ?? "?";

  return (
    <div className={`min-w-0 flex items-center gap-2.5 ${align === "right" ? "flex-row-reverse text-right" : "text-left"}`}>
      <div
        className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl text-sm font-black shadow-md ${
          participant.isCurrentUser
            ? "border-2 border-[#c5f94d] bg-[#c5f94d] text-[#090d09]"
            : "border border-[#283929] bg-[#162117] text-white"
        }`}
      >
        {initial}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1 truncate">
          <p className="truncate text-xs font-black text-white">{participant.name}</p>
          {participant.isCurrentUser && (
            <span className="rounded bg-[#1a281a] px-1 py-0.2 text-[8px] font-black text-[#c5f94d]">
              YOU
            </span>
          )}
        </div>
        {score !== null && (
          <p className="mt-0.5 text-[10px] font-bold text-[#8fa390]">Score: {score}</p>
        )}
      </div>
    </div>
  );
}

function EmptyMatches({ tab }: { tab: Tab }) {
  const copy =
    tab === "Upcoming"
      ? "Join an open tournament to unlock your next scheduled fixture."
      : tab === "Live"
      ? "No live battles are assigned to your roster right now."
      : "Completed match records will appear here after results are finalized.";

  return (
    <div className="velox-card p-8 text-center">
      <Swords className="mx-auto h-10 w-10 text-[#4c5c4d]" aria-hidden />
      <h2 className="mt-3 text-base font-black text-white">No {tab.toLowerCase()} matches</h2>
      <p className="mx-auto mt-1 max-w-xs text-xs text-[#7e8e7f] leading-relaxed">{copy}</p>
      {tab === "Upcoming" && (
        <Link href="/tournaments" className="velox-action mt-4 text-xs font-black">
          Browse tournaments
        </Link>
      )}
    </div>
  );
}

