"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Bell,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  Gamepad2,
  Layers,
  MessageSquare,
  Plus,
  RefreshCw,
  ShieldAlert,
  Swords,
  Trophy,
  Users,
  X,
} from "lucide-react";
import type { AdminDashboardOverviewData } from "@/features/admin/actions";
import { runTournamentLifecycleManually } from "@/features/admin/actions";
import type { AdminAnalytics as AnalyticsData } from "@/features/admin/insights";
import { TournamentModal } from "./tournaments/TournamentModal";
import { AdminAnalytics } from "./AdminAnalytics";

type OverviewData = AdminDashboardOverviewData;

type GameItem = {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  imageUrl: string | null;
};

export function AdminDashboardClient({
  overview,
  analytics,
  games,
}: {
  overview: OverviewData;
  analytics: AnalyticsData | null;
  games: GameItem[];
}) {
  const router = useRouter();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [activityTab, setActivityTab] = useState<"registrations" | "matches" | "discord" | "audit">("registrations");
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const counts = overview.counts;
  const attention = overview.attentionRequired;
  const hasCriticalAttention =
    attention.pendingDisputes > 0 ||
    attention.pendingRegistrations > 0 ||
    attention.matchesNeedingAttention > 0 ||
    attention.failedNotifications > 0;

  function handleRunLifecycle() {
    startTransition(async () => {
      const result = await runTournamentLifecycleManually();
      if (result.success && result.data) {
        const detail = result.data;
        const msg = `Lifecycle executed: ${detail.checkInOpened} check-ins opened, ${detail.bracketsGenerated} brackets generated, ${detail.tournamentsStarted} started.`;
        setToastMessage(msg);
        router.refresh();
      } else {
        setToastMessage(result.error ?? "Failed to run lifecycle automation.");
      }
    });
  }

  return (
    <main className="velox-page">
      {/* Toast notification banner */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed right-4 top-20 z-[90] flex max-w-[calc(100vw-2rem)] items-start gap-3 rounded-2xl border border-[#55783e] bg-[#172417]/95 px-4 py-3 text-sm font-bold text-[#e8ffd0] shadow-[0_18px_55px_rgba(0,0,0,0.5)] backdrop-blur-xl sm:right-6"
        >
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#c5f94d]" aria-hidden />
          <span>{toastMessage}</span>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="ml-1 text-[#8fa287] transition hover:text-white"
            aria-label="Dismiss notification"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
      )}

      {/* Header */}
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="velox-eyebrow">Khemora / Command Center</p>
          <h1 className="mt-1 text-2xl font-black tracking-[-0.05em] text-white sm:text-3xl">
            Operations Command Center
          </h1>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-[#8e998f]">
            Live esports tournament operations, player match desk, community integrations, and operational readiness.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-[#c5f94d] px-3.5 py-2 text-xs font-black text-[#0a0e0a] shadow-[0_8px_20px_rgba(197,249,77,0.25)] transition hover:bg-[#d5ff70]"
          >
            <Plus className="h-4 w-4" aria-hidden />
            <span>Create tournament</span>
          </button>
          <Link
            href="/"
            className="inline-flex items-center gap-1 rounded-xl border border-[#2a352b] bg-[#121912] px-3 py-2 text-xs font-black uppercase tracking-[0.08em] text-[#c5f94d] transition hover:border-[#48613b] hover:text-[#d5ff70]"
          >
            <span>Player app</span>
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>
      </header>

      {/* Hero Operational Banner */}
      <section className="relative mt-5 overflow-hidden rounded-[26px] border border-[#3b5530] bg-[#152212] p-5 shadow-[0_20px_50px_rgba(0,0,0,0.25)] lg:p-6">
        <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full border-[36px] border-[#294220] opacity-60" aria-hidden />
        <div className="absolute bottom-0 right-10 h-px w-48 bg-[#c5f94d]/40" aria-hidden />
        <div className="relative grid gap-5 xl:grid-cols-[minmax(280px,1fr)_minmax(560px,1.4fr)] xl:items-end">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#243a18] px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.14em] text-[#c5f94d]">
                <Activity className="h-3.5 w-3.5 animate-pulse text-[#c5f94d]" aria-hidden /> Match day pulse
              </span>
              <span className="rounded-lg border border-[#3f5734] bg-[#0c130c] px-2.5 py-1 text-[10px] font-bold text-[#b0bfab]">
                {counts.activeTournaments} Active Competition{counts.activeTournaments === 1 ? "" : "s"}
              </span>
            </div>
            <p className="mt-3 text-2xl font-black uppercase tracking-[-0.04em] text-white sm:text-3xl">
              {counts.liveMatches > 0
                ? `${counts.liveMatches} Live Fixture${counts.liveMatches === 1 ? "" : "s"} in Progress`
                : "Operational & Ready for Kickoff"}
            </p>
            <p className="mt-2 max-w-lg text-sm leading-relaxed text-[#b6c5ac]">
              Monitor real-time competition, resolve open disputes, verify results, and keep brackets advancing smoothly.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <PulseStat value={counts.liveTournaments} label="Live events" highlight={counts.liveTournaments > 0} />
            <PulseStat value={counts.liveMatches} label="Live fixtures" highlight={counts.liveMatches > 0} />
            <PulseStat value={counts.matchesToday} label="Fixtures today" />
            <PulseStat value={counts.pendingDisputes} label="Open disputes" priority={counts.pendingDisputes > 0} />
            <PulseStat value={counts.pendingRegistrations} label="Pending entries" priority={counts.pendingRegistrations > 0} />
            <PulseStat value={counts.confirmedRegistrations} label="Confirmed entries" />
          </div>
        </div>
      </section>

      {/* Attention Required Hub */}
      {hasCriticalAttention && (
        <section className="mt-5 rounded-[24px] border border-[#7a3e35] bg-[#221413] p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#4d2924] pb-3.5">
            <div className="flex items-center gap-2.5">
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-[#4d241f] text-[#ffad97]">
                <AlertTriangle className="h-4 w-4" aria-hidden />
              </span>
              <div>
                <h2 className="text-base font-black text-white">Attention Required</h2>
                <p className="text-xs text-[#c99e98]">These operational items require administrative review.</p>
              </div>
            </div>
            <span className="rounded-full bg-[#401f1c] px-3 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-[#ffad97]">
              Action items
            </span>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {attention.pendingDisputes > 0 && (
              <Link
                href="/admin/disputes"
                className="group flex items-start gap-3 rounded-2xl border border-[#6b352e] bg-[#1a0f0e] p-3.5 transition hover:border-[#a85044] hover:bg-[#251513]"
              >
                <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-[#ffad97]" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-black text-white">{attention.pendingDisputes} Open Dispute{attention.pendingDisputes === 1 ? "" : "s"}</p>
                  <p className="mt-0.5 text-xs text-[#b89590]">Review player evidence and resolve match outcome.</p>
                </div>
                <ChevronRight className="h-4 w-4 text-[#ffad97] transition group-hover:translate-x-0.5" aria-hidden />
              </Link>
            )}

            {attention.pendingRegistrations > 0 && (
              <Link
                href="/admin/registrations"
                className="group flex items-start gap-3 rounded-2xl border border-[#634e2b] bg-[#1a150d] p-3.5 transition hover:border-[#96763d] hover:bg-[#261f12]"
              >
                <ClipboardList className="mt-0.5 h-5 w-5 shrink-0 text-[#f5c66b]" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-black text-white">{attention.pendingRegistrations} Pending Entr{attention.pendingRegistrations === 1 ? "y" : "ies"}</p>
                  <p className="mt-0.5 text-xs text-[#b5a281]">Approve or confirm waiting tournament registrations.</p>
                </div>
                <ChevronRight className="h-4 w-4 text-[#f5c66b] transition group-hover:translate-x-0.5" aria-hidden />
              </Link>
            )}

            {attention.matchesNeedingAttention > 0 && (
              <Link
                href="/admin/matches"
                className="group flex items-start gap-3 rounded-2xl border border-[#3b5934] bg-[#111910] p-3.5 transition hover:border-[#58804e] hover:bg-[#162115]"
              >
                <Swords className="mt-0.5 h-5 w-5 shrink-0 text-[#c5f94d]" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-black text-white">{attention.matchesNeedingAttention} Match Desk Action{attention.matchesNeedingAttention === 1 ? "" : "s"}</p>
                  <p className="mt-0.5 text-xs text-[#9eb09a]">Fixtures waiting for result submission or verification.</p>
                </div>
                <ChevronRight className="h-4 w-4 text-[#c5f94d] transition group-hover:translate-x-0.5" aria-hidden />
              </Link>
            )}

            {attention.failedNotifications > 0 && (
              <Link
                href="/admin/notifications"
                className="group flex items-start gap-3 rounded-2xl border border-[#6b352e] bg-[#1a0f0e] p-3.5 transition hover:border-[#a85044] hover:bg-[#251513]"
              >
                <Bell className="mt-0.5 h-5 w-5 shrink-0 text-[#ffad97]" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-black text-white">{attention.failedNotifications} Undelivered Alert{attention.failedNotifications === 1 ? "" : "s"}</p>
                  <p className="mt-0.5 text-xs text-[#b89590]">Failed Telegram notifications ready for retry.</p>
                </div>
                <ChevronRight className="h-4 w-4 text-[#ffad97] transition group-hover:translate-x-0.5" aria-hidden />
              </Link>
            )}
          </div>
        </section>
      )}

      {/* Quick Actions Command Toolbar */}
      <section className="mt-5 rounded-2xl border border-[#273628] bg-[#0e150f] p-4">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#8fa08d]">Operations shortcuts</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-[#1d2c1c] px-3.5 py-2.5 text-xs font-black text-[#c5f94d] transition hover:bg-[#2a3f29]"
          >
            <Plus className="h-4 w-4" aria-hidden />
            <span>Create tournament</span>
          </button>
          <Link
            href="/admin/matches"
            className="inline-flex items-center gap-2 rounded-xl border border-[#273628] bg-[#121a13] px-3.5 py-2.5 text-xs font-bold text-white transition hover:border-[#425a3d] hover:bg-[#182319]"
          >
            <Swords className="h-4 w-4 text-[#c5f94d]" aria-hidden />
            <span>Match desk</span>
          </Link>
          <Link
            href="/admin/registrations"
            className="inline-flex items-center gap-2 rounded-xl border border-[#273628] bg-[#121a13] px-3.5 py-2.5 text-xs font-bold text-white transition hover:border-[#425a3d] hover:bg-[#182319]"
          >
            <ClipboardList className="h-4 w-4 text-[#f0cf78]" aria-hidden />
            <span>Manage registrations</span>
          </Link>
          <Link
            href="/admin/notifications"
            className="inline-flex items-center gap-2 rounded-xl border border-[#273628] bg-[#121a13] px-3.5 py-2.5 text-xs font-bold text-white transition hover:border-[#425a3d] hover:bg-[#182319]"
          >
            <Bell className="h-4 w-4 text-[#84d8ff]" aria-hidden />
            <span>Broadcast announcement</span>
          </Link>
          <Link
            href="/admin/discord"
            className="inline-flex items-center gap-2 rounded-xl border border-[#273628] bg-[#121a13] px-3.5 py-2.5 text-xs font-bold text-white transition hover:border-[#425a3d] hover:bg-[#182319]"
          >
            <MessageSquare className="h-4 w-4 text-[#af93ff]" aria-hidden />
            <span>Discord integrations</span>
          </Link>
          <Link
            href="/admin/disputes"
            className="inline-flex items-center gap-2 rounded-xl border border-[#273628] bg-[#121a13] px-3.5 py-2.5 text-xs font-bold text-white transition hover:border-[#425a3d] hover:bg-[#182319]"
          >
            <ShieldAlert className="h-4 w-4 text-[#ff997d]" aria-hidden />
            <span>Review disputes</span>
          </Link>
          <button
            type="button"
            onClick={handleRunLifecycle}
            disabled={isPending}
            className="inline-flex items-center gap-2 rounded-xl border border-[#3b4e36] bg-[#142014] px-3.5 py-2.5 text-xs font-bold text-[#c5f94d] transition hover:bg-[#1d2e1d] disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isPending ? "animate-spin" : ""}`} aria-hidden />
            <span>{isPending ? "Advancing…" : "Advance lifecycle now"}</span>
          </button>
        </div>
      </section>

      {/* KPI Metrics Grid */}
      <section className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8" aria-label="Platform key metrics">
        <KpiCard
          href="/admin/tournaments"
          icon={<Trophy className="h-5 w-5" aria-hidden />}
          label="Tournaments"
          value={counts.totalTournaments}
          detail={`${counts.activeTournaments} in operating queue`}
        />
        <KpiCard
          href="/admin/matches"
          icon={<Swords className="h-5 w-5" aria-hidden />}
          label="Matches"
          value={counts.totalMatches}
          detail={`${counts.liveMatches} live now`}
          highlight={counts.liveMatches > 0}
        />
        <KpiCard
          href="/admin/players"
          icon={<Users className="h-5 w-5" aria-hidden />}
          label="Players"
          value={counts.totalUsers}
          detail={`${counts.activeUsers} active (30d)`}
        />
        <KpiCard
          href="/admin/teams"
          icon={<Layers className="h-5 w-5" aria-hidden />}
          label="Teams"
          value={counts.totalTeams}
          detail="Registered rosters"
        />
        <KpiCard
          href="/admin/discord"
          icon={<MessageSquare className="h-5 w-5" aria-hidden />}
          label="Discord linked"
          value={counts.connectedDiscordUsers}
          detail={`${counts.discordConnectionRate}% of all players`}
        />
        <KpiCard
          href="/admin/registrations"
          icon={<ClipboardList className="h-5 w-5" aria-hidden />}
          label="Confirmed entries"
          value={counts.confirmedRegistrations}
          detail="Competition ready"
        />
        <KpiCard
          href="/admin/finance"
          icon={<CircleDollarSign className="h-5 w-5" aria-hidden />}
          label="Verified Stars"
          value={counts.verifiedPaymentStars}
          detail="Telegram Stars payments"
          isStars
        />
        <KpiCard
          href="/admin/finance"
          icon={<Trophy className="h-5 w-5" aria-hidden />}
          label="Prize rewards"
          value={counts.prizeRewardStars}
          detail="Distributed to winners"
          isStars
        />
      </section>

      {/* Analytics Visualizations */}
      {analytics ? (
        <AdminAnalytics data={analytics} />
      ) : (
        <section className="velox-card mt-6 p-5">
          <p className="velox-eyebrow">Platform intelligence</p>
          <p className="mt-2 font-black text-white">Analytics temporarily unavailable</p>
          <p className="mt-1 text-sm text-[#8e998f]">Unable to load real-time analytics data.</p>
        </section>
      )}

      {/* Active Tournaments & Live Fixture Monitor Grid */}
      <section className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.85fr)]">
        {/* Active Tournaments */}
        <div className="velox-card overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-[#29342a] px-5 py-4">
            <div>
              <p className="velox-eyebrow">Competition Queue</p>
              <h2 className="mt-0.5 text-lg font-black text-white">Active tournaments</h2>
            </div>
            <Link
              href="/admin/tournaments"
              className="inline-flex items-center gap-1 text-xs font-black uppercase tracking-[0.1em] text-[#c5f94d] hover:text-[#d5ff70]"
            >
              <span>Manage all</span>
              <ChevronRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>

          {overview.activeTournaments.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <Gamepad2 className="mx-auto h-9 w-9 text-[#526052]" aria-hidden />
              <p className="mt-3 font-bold text-white">No active tournaments</p>
              <p className="mt-1 text-sm text-[#8e998f]">Start a tournament to open registrations and brackets.</p>
              <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                className="velox-action mt-5 inline-flex items-center gap-2"
              >
                <Plus className="h-4 w-4" aria-hidden />
                <span>Create tournament</span>
              </button>
            </div>
          ) : (
            <div className="divide-y divide-[#232f24]">
              {overview.activeTournaments.map((t) => {
                const fillPercent = t.maxParticipants > 0 ? Math.min(100, Math.round((t.currentParticipants / t.maxParticipants) * 100)) : 0;
                return (
                  <div key={t.id} className="group p-5 transition hover:bg-[#141d15]">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="rounded-lg bg-[#1f3119] px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.1em] text-[#c5f94d]">
                            {t.game.name}
                          </span>
                          <span className="rounded-lg bg-[#1a251b] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-[#9eb09b]">
                            {t.status.replaceAll("_", " ")}
                          </span>
                        </div>
                        <h3 className="mt-2 text-base font-black text-white group-hover:text-[#d5ff70]">
                          <Link href={`/admin/tournaments/${t.id}`}>{t.title}</Link>
                        </h3>
                        <p className="mt-1 text-xs text-[#808f7f]">
                          Starts {new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(t.startDate))}
                        </p>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        <Link
                          href={`/admin/tournaments/${t.id}`}
                          className="rounded-xl border border-[#2e3e2f] bg-[#121a13] px-3 py-1.5 text-xs font-bold text-white transition hover:border-[#4c694a] hover:bg-[#1a251a]"
                        >
                          Details
                        </Link>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="mt-4">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[#8e998f]">
                          Participants: <strong className="text-white">{t.currentParticipants}</strong> / {t.maxParticipants}
                        </span>
                        <span className="font-bold text-[#c5f94d]">{fillPercent}% full</span>
                      </div>
                      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[#1b251c]">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-[#8bb832] to-[#c5f94d]"
                          style={{ width: `${fillPercent}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Live Fixture Feed & Moderation Desk */}
        <div className="grid gap-4">
          <div className="velox-card overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b border-[#29342a] px-4 py-3.5">
              <div className="flex items-center gap-2">
                <span className="flex h-2 w-2 rounded-full bg-[#c5f94d] animate-ping" aria-hidden />
                <h2 className="text-sm font-black text-white">Live match desk</h2>
              </div>
              <Link
                href="/admin/matches"
                className="text-[10px] font-black uppercase tracking-[0.1em] text-[#c5f94d] hover:text-[#d5ff70]"
              >
                Match desk
              </Link>
            </div>

            {overview.liveMatches.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <Swords className="mx-auto h-7 w-7 text-[#465446]" aria-hidden />
                <p className="mt-2 text-sm font-bold text-white">No live matches at this moment</p>
                <p className="mt-1 text-xs text-[#8e998f]">Active tournament fixtures will display here automatically.</p>
              </div>
            ) : (
              <div className="divide-y divide-[#232f24]">
                {overview.liveMatches.map((m) => (
                  <Link
                    key={m.id}
                    href={`/admin/matches`}
                    className="block px-4 py-3.5 transition hover:bg-[#141e15]"
                  >
                    <div className="flex items-center justify-between gap-2 text-[10px]">
                      <span className="font-black uppercase tracking-[0.08em] text-[#8e998f]">
                        {m.gameName} · Round {m.round}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 font-black uppercase tracking-[0.08em] ${m.status === "DISPUTED" ? "bg-[#3e1e1b] text-[#ffad97]" : "bg-[#1c2e19] text-[#c5f94d]"}`}>
                        {m.status.replaceAll("_", " ")}
                      </span>
                    </div>
                    <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 text-sm font-black text-white">
                      <span className="truncate">{m.participant1}</span>
                      <span className="rounded-md bg-[#1d2e1b] px-2 py-0.5 text-xs text-[#c5f94d]">
                        {m.score1 ?? "–"} : {m.score2 ?? "–"}
                      </span>
                      <span className="truncate text-right">{m.participant2}</span>
                    </div>
                    <p className="mt-1.5 truncate text-[11px] text-[#758474]">{m.tournamentTitle}</p>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Disputes Quick Card */}
          <div className="rounded-[24px] border border-[#2f4530] bg-[#121b12] p-5">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#c5f94d]">Fair play & disputes</p>
              {overview.openDisputes.length > 0 && (
                <span className="rounded-full bg-[#3e1f1c] px-2 py-0.5 text-[10px] font-black text-[#ffad97]">
                  {overview.openDisputes.length} open
                </span>
              )}
            </div>
            <h3 className="mt-1 text-lg font-black text-white">
              {overview.openDisputes.length === 0 ? "Match desk is clear" : "Disputes awaiting review"}
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-[#92a191]">
              {overview.openDisputes.length === 0
                ? "No disputes have been opened by players. Fixture results will advance cleanly."
                : "Player reports require moderator ruling. Review attached evidence and decide winner."}
            </p>
            <Link
              href="/admin/disputes"
              className="mt-4 inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-[0.1em] text-[#c5f94d] hover:text-[#d5ff70]"
            >
              <span>Go to dispute cases</span>
              <ChevronRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </div>
      </section>

      {/* Recent Activity Multi-Category Feed */}
      <section className="mt-6">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <p className="velox-eyebrow">Platform Activity</p>
            <h2 className="mt-0.5 text-xl font-black text-white">Recent events feed</h2>
          </div>
          {/* Tabs */}
          <div className="flex flex-wrap gap-1 rounded-xl border border-[#263527] bg-[#101711] p-1 text-xs">
            <button
              type="button"
              onClick={() => setActivityTab("registrations")}
              className={`rounded-lg px-3 py-1.5 font-bold transition ${activityTab === "registrations" ? "bg-[#1f311c] text-[#c5f94d]" : "text-[#8e998f] hover:text-white"}`}
            >
              Registrations
            </button>
            <button
              type="button"
              onClick={() => setActivityTab("matches")}
              className={`rounded-lg px-3 py-1.5 font-bold transition ${activityTab === "matches" ? "bg-[#1f311c] text-[#c5f94d]" : "text-[#8e998f] hover:text-white"}`}
            >
              Matches completed
            </button>
            <button
              type="button"
              onClick={() => setActivityTab("discord")}
              className={`rounded-lg px-3 py-1.5 font-bold transition ${activityTab === "discord" ? "bg-[#1f311c] text-[#c5f94d]" : "text-[#8e998f] hover:text-white"}`}
            >
              Discord links
            </button>
            <button
              type="button"
              onClick={() => setActivityTab("audit")}
              className={`rounded-lg px-3 py-1.5 font-bold transition ${activityTab === "audit" ? "bg-[#1f311c] text-[#c5f94d]" : "text-[#8e998f] hover:text-white"}`}
            >
              Admin audit
            </button>
          </div>
        </div>

        <div className="velox-card mt-3 overflow-hidden">
          {activityTab === "registrations" && (
            overview.recentRegistrations.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-[#8e998f]">No registrations recorded yet.</p>
            ) : (
              <div className="divide-y divide-[#232f24]">
                {overview.recentRegistrations.map((r) => {
                  const playerName = r.user.profile?.khemoraUsername ?? r.user.username ?? r.user.firstName ?? "Player";
                  return (
                    <div key={r.id} className="flex items-center gap-3 px-5 py-3.5 transition hover:bg-[#131d14]">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#1b271c] text-xs font-black text-[#c5f94d]">
                        {playerName.slice(0, 1).toUpperCase()}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-white">{playerName}</p>
                        <p className="truncate text-xs text-[#808f7f]">
                          {r.tournament.title} · {r.tournament.game.name}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <span className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.08em] ${r.status === "CONFIRMED" ? "bg-[#1f311c] text-[#c5f94d]" : "bg-[#30281b] text-[#f5c66b]"}`}>
                          {r.status}
                        </span>
                        <p className="mt-1 text-[10px] text-[#718071]">
                          {new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(r.createdAt))}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          )}

          {activityTab === "matches" && (
            overview.recentMatches.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-[#8e998f]">No completed matches recorded yet.</p>
            ) : (
              <div className="divide-y divide-[#232f24]">
                {overview.recentMatches.map((m) => (
                  <div key={m.id} className="flex items-center gap-3 px-5 py-3.5 transition hover:bg-[#131d14]">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#1d2f1b] text-[#c5f94d]">
                      <CheckCircle2 className="h-4 w-4" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-white">
                        {m.participant1} <span className="text-[#c5f94d]">{m.score1 ?? 0} - {m.score2 ?? 0}</span> {m.participant2}
                      </p>
                      <p className="truncate text-xs text-[#808f7f]">
                        {m.tournamentTitle} · {m.gameName} · Round {m.round}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <span className="rounded-full bg-[#1f311c] px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.08em] text-[#c5f94d]">
                        Completed
                      </span>
                      <p className="mt-1 text-[10px] text-[#718071]">
                        {new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(m.updatedAt))}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}

          {activityTab === "discord" && (
            overview.recentDiscordConnections.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-[#8e998f]">No Discord accounts connected yet.</p>
            ) : (
              <div className="divide-y divide-[#232f24]">
                {overview.recentDiscordConnections.map((p) => {
                  const playerName = p.khemoraUsername ?? p.user.username ?? p.user.firstName ?? "Player";
                  return (
                    <div key={p.id} className="flex items-center gap-3 px-5 py-3.5 transition hover:bg-[#131d14]">
                      {p.discordAvatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.discordAvatarUrl} alt="" className="h-9 w-9 shrink-0 rounded-full border border-[#5865F2]" />
                      ) : (
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#202742] text-xs font-black text-[#849bf8]">
                          <MessageSquare className="h-4 w-4" aria-hidden />
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-white">{playerName}</p>
                        <p className="truncate text-xs text-[#849bf8]">
                          @{p.discordUsername ?? "unknown"} {p.discordDisplayName ? `(${p.discordDisplayName})` : ""}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <span className="rounded-full bg-[#242b4d] px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.08em] text-[#849bf8]">
                          Discord Connected
                        </span>
                        {p.discordConnectedAt && (
                          <p className="mt-1 text-[10px] text-[#718071]">
                            {new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(p.discordConnectedAt))}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          )}

          {activityTab === "audit" && (
            overview.recentAuditLogs.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-[#8e998f]">No audit logs recorded yet.</p>
            ) : (
              <div className="divide-y divide-[#232f24]">
                {overview.recentAuditLogs.map((log) => {
                  const adminName = log.admin.username ?? log.admin.firstName ?? "Admin";
                  return (
                    <div key={log.id} className="flex items-center gap-3 px-5 py-3.5 transition hover:bg-[#131d14]">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#1b261d] text-xs font-black text-[#c5f94d]">
                        {adminName.slice(0, 1).toUpperCase()}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-white">
                          {log.action.replaceAll("_", " ")}
                        </p>
                        <p className="truncate text-xs text-[#808f7f]">
                          by {adminName} on {log.entity}
                        </p>
                      </div>
                      <p className="shrink-0 text-[10px] text-[#718071]">
                        {new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(log.createdAt))}
                      </p>
                    </div>
                  );
                })}
              </div>
            )
          )}
        </div>
      </section>

      {/* Modal for Creating Tournament */}
      {showCreateModal && (
        <TournamentModal
          key="dashboard-create"
          isOpen={showCreateModal}
          mode="create"
          games={games}
          onClose={() => setShowCreateModal(false)}
          onSuccess={(msg) => {
            setShowCreateModal(false);
            setToastMessage(msg);
            router.refresh();
          }}
        />
      )}
    </main>
  );
}

function KpiCard({
  href,
  icon,
  label,
  value,
  detail,
  isStars = false,
  highlight = false,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  value: number;
  detail: string;
  isStars?: boolean;
  highlight?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`group velox-card block p-4 transition hover:-translate-y-0.5 hover:border-[#537346] hover:bg-[#152016] ${highlight ? "border-[#48633b] bg-[#142013]" : ""}`}
    >
      <div className="flex items-center justify-between">
        <span className={`grid h-8 w-8 place-items-center rounded-xl ${highlight ? "bg-[#253d1d] text-[#c5f94d]" : "bg-[#1c291b] text-[#9eb69d] group-hover:text-[#c5f94d]"}`}>
          {icon}
        </span>
        <ChevronRight className="h-3.5 w-3.5 text-[#526350] transition group-hover:translate-x-0.5 group-hover:text-[#c5f94d]" aria-hidden />
      </div>
      <p className="mt-3 text-2xl font-black tracking-[-0.04em] text-white">
        {isStars ? "⭐ " : ""}
        {value.toLocaleString()}
      </p>
      <p className="mt-0.5 text-[11px] font-black uppercase tracking-[0.11em] text-[#c2cebb]">{label}</p>
      <p className="mt-1 truncate text-xs text-[#718072]">{detail}</p>
    </Link>
  );
}

function PulseStat({
  value,
  label,
  priority = false,
  highlight = false,
}: {
  value: number;
  label: string;
  priority?: boolean;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border px-3.5 py-3 ${
        priority
          ? "border-[#964738]/70 bg-[#2b1916]"
          : highlight
          ? "border-[#4f6e3e] bg-[#182616]"
          : "border-[#3f5734] bg-[#121c12]"
      }`}
    >
      <p className={`text-xl font-black ${priority ? "text-[#ffad97]" : highlight ? "text-[#c5f94d]" : "text-white"}`}>
        {value.toLocaleString()}
      </p>
      <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.09em] text-[#9fb198]">{label}</p>
    </div>
  );
}
