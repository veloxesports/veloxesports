import {
  ArrowUpRight,
  ChevronRight,
  Clock,
  Gamepad2,
  Shield,
  Swords,
  Trophy,
  Users,
  Wallet,
  Zap,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getTournaments } from "@/features/tournaments/actions";
import { getWalletSummary } from "@/features/wallet/services";
import { getUnreadNotificationCount } from "@/features/notifications/actions";
import { getMatchCenter } from "@/features/matches/services";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { isMatchInCenterTab } from "@/lib/matches/flow";

/* eslint-disable @next/next/no-img-element -- Profile and Telegram avatar preview */

export default async function Home() {
  const [
    user,
    tournamentsResult,
    walletResult,
    unreadNotificationsResult,
    matchCenterResult,
  ] = await Promise.all([
    getCurrentUser(),
    getTournaments({ status: "REGISTRATION_OPEN" }),
    getWalletSummary(),
    getUnreadNotificationCount(),
    getMatchCenter(),
  ]);

  const featuredTournament =
    tournamentsResult.success && tournamentsResult.data ? tournamentsResult.data[0] : undefined;
  const wallet = walletResult.success && walletResult.data ? walletResult.data.wallet : null;
  const profile = user?.profile;
  const displayName = profile?.veloxUsername || user?.username || user?.firstName || "Player";
  const avatarUrl = user?.profileImage;
  const rank = profile?.rank ?? "BRONZE";
  const level = profile?.level ?? 1;
  const xp = profile?.xp ?? 0;

  // XP progress calculation (each tier is 500 XP)
  const currentTierXp = xp % 500;
  const nextTierXp = 500;
  const xpPercent = Math.min(100, Math.max(8, Math.round((currentTierXp / nextTierXp) * 100)));

  const totalMatches = (profile?.wins ?? 0) + (profile?.losses ?? 0);
  const winRate = totalMatches ? `${Math.round(((profile?.wins ?? 0) / totalMatches) * 100)}%` : "0%";

  // Find active or upcoming match
  const matches = matchCenterResult.success ? matchCenterResult.data : [];
  const activeMatch = matches.find((m) => isMatchInCenterTab(m.status, "Live"));
  const upcomingMatch = matches.find((m) => isMatchInCenterTab(m.status, "Upcoming"));
  const spotlightMatch = activeMatch || upcomingMatch;

  return (
    <main className="velox-page">
      {/* Top Bar / Player Header */}
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/profile" className="group relative block" aria-label="Open profile">
            <div className="grid h-12 w-12 place-items-center overflow-hidden rounded-2xl border-2 border-[#c5f94d] bg-[#111912] shadow-[0_0_15px_rgba(197,249,77,0.25)] transition-transform group-hover:scale-105">
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="text-base font-black text-white">
                  {displayName[0]?.toUpperCase() ?? "P"}
                </span>
              )}
            </div>
            <span
              className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-[#080d09] bg-[#c5f94d]"
              title="Online"
            />
          </Link>

          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[#c5f94d]">
                Season 04
              </span>
              <span className="text-[10px] text-[#4d604e]">·</span>
              <span className="rounded-md bg-[#19271a] px-1.5 py-0.2 text-[9px] font-black uppercase tracking-wider text-[#d4ff76]">
                {rank}
              </span>
            </div>
            <h1 className="truncate text-xl font-black tracking-[-0.03em] text-white sm:text-2xl">
              {displayName}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <NotificationBell
            initialUnreadCount={
              unreadNotificationsResult.success ? unreadNotificationsResult.data ?? 0 : 0
            }
          />
        </div>
      </header>

      {/* Level & XP Progress Card */}
      <section className="velox-card mt-5 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-[#20311c] text-xs font-black text-[#c5f94d]">
              <Zap className="h-4 w-4" aria-hidden />
            </span>
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-white">
                Level {level} Competitor
              </p>
              <p className="text-[10px] font-medium text-[#7e8e80]">
                {currentTierXp} / {nextTierXp} XP to Level {level + 1}
              </p>
            </div>
          </div>
          <span className="rounded-full bg-[#182718] px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-[#c5f94d]">
            {xp} Total XP
          </span>
        </div>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[#182319]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#9ae02e] to-[#c5f94d] shadow-[0_0_8px_rgba(197,249,77,0.7)] transition-all duration-500"
            style={{ width: `${xpPercent}%` }}
          />
        </div>
      </section>

      {/* Stats Quick-Glance */}
      <section className="velox-card mt-3 grid grid-cols-3 divide-x divide-[#233124] p-3 text-center">
        <Stat label="Current rank" value={rank} icon={<Trophy className="h-3.5 w-3.5" />} />
        <Stat label="Win rate" value={winRate} icon={<ArrowUpRight className="h-3.5 w-3.5" />} highlight />
        <Stat
          label="Matches"
          value={String(totalMatches)}
          icon={<Swords className="h-3.5 w-3.5" />}
        />
      </section>

      {/* Quick Actions Bar */}
      <section className="mt-6">
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <QuickAction
            href="/tournaments"
            icon={<Trophy className="h-5 w-5 text-[#c5f94d]" />}
            title="Tournaments"
            subtitle="Browse events"
          />
          <QuickAction
            href="/matches"
            icon={<Swords className="h-5 w-5 text-amber-400" />}
            title="Match Center"
            subtitle={matches.length ? `${matches.length} matches` : "View fixtures"}
          />
          <QuickAction
            href="/teams"
            icon={<Users className="h-5 w-5 text-cyan-400" />}
            title="My Squad"
            subtitle="Roster & invites"
          />
          <QuickAction
            href="/wallet"
            icon={<Wallet className="h-5 w-5 text-emerald-400" />}
            title="Stars Wallet"
            subtitle={wallet ? `⭐ ${wallet.totalRewards} won` : "Manage balance"}
          />
        </div>
      </section>

      {/* Active / Next Match Widget */}
      {spotlightMatch && (
        <section className="mt-7">
          <SectionHeader
            title={activeMatch ? "Live match in progress" : "Your next match"}
            href="/matches"
            label="All matches"
          />
          <Link
            href={`/matches/${spotlightMatch.id}`}
            className="group relative mt-3 block overflow-hidden rounded-2xl border border-[#3e5635] bg-[#111c13] p-4 transition hover:border-[#c5f94d]/60 shadow-[0_8px_24px_rgba(0,0,0,0.35)]"
          >
            <div className="flex items-center justify-between gap-2">
              <span
                className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                  activeMatch
                    ? "bg-red-500/20 text-red-300"
                    : "bg-[#25391d] text-[#c5f94d]"
                }`}
              >
                <span
                  className={`h-2 w-2 rounded-full ${
                    activeMatch ? "animate-pulse bg-red-400" : "bg-[#c5f94d]"
                  }`}
                />
                {activeMatch ? "Live Arena" : "Upcoming"}
              </span>
              <span className="flex items-center gap-1 text-[11px] font-bold text-[#829283]">
                <Clock className="h-3.5 w-3.5" aria-hidden />
                {spotlightMatch.scheduledTime
                  ? new Date(spotlightMatch.scheduledTime).toLocaleTimeString([], {
                      hour: "numeric",
                      minute: "2-digit",
                    })
                  : "Time TBA"}
              </span>
            </div>

            <p className="mt-2 text-xs font-semibold text-[#9ab09b]">
              {spotlightMatch.gameName} · Round {spotlightMatch.round} · {spotlightMatch.tournamentTitle}
            </p>

            <div className="mt-3 flex items-center justify-between gap-3 border-t border-[#1f2d21] pt-3">
              <div className="flex items-center gap-2">
                <span
                  className={`grid h-8 w-8 place-items-center rounded-lg text-xs font-black ${
                    spotlightMatch.player1.isCurrentUser
                      ? "bg-[#c5f94d] text-[#090d09]"
                      : "bg-[#202b21] text-white"
                  }`}
                >
                  {spotlightMatch.player1.name[0]?.toUpperCase() ?? "P"}
                </span>
                <span className="text-xs font-black text-white">
                  {spotlightMatch.player1.name}
                  {spotlightMatch.player1.isCurrentUser && (
                    <span className="ml-1 text-[9px] text-[#c5f94d]">(You)</span>
                  )}
                </span>
              </div>

              <span className="rounded-md bg-[#19241b] px-2 py-1 text-xs font-black text-[#c5f94d]">
                VS
              </span>

              <div className="flex items-center gap-2 text-right">
                <span className="text-xs font-black text-white">
                  {spotlightMatch.player2.name}
                  {spotlightMatch.player2.isCurrentUser && (
                    <span className="ml-1 text-[9px] text-[#c5f94d]">(You)</span>
                  )}
                </span>
                <span
                  className={`grid h-8 w-8 place-items-center rounded-lg text-xs font-black ${
                    spotlightMatch.player2.isCurrentUser
                      ? "bg-[#c5f94d] text-[#090d09]"
                      : "bg-[#202b21] text-white"
                  }`}
                >
                  {spotlightMatch.player2.name[0]?.toUpperCase() ?? "P"}
                </span>
              </div>
            </div>
          </Link>
        </section>
      )}

      {/* Featured Tournament Banner */}
      <section className="mt-7">
        <SectionHeader title="Featured event" href="/tournaments" label="All events" />
        {featuredTournament ? (
          <article className="relative mt-3 overflow-hidden rounded-[28px] border border-[#3e5933] bg-[#162714] p-5 shadow-[0_18px_45px_rgba(0,0,0,0.3)] sm:p-6">
            <div
              className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full border border-[#5f8947]/30 bg-[#25451c]"
              aria-hidden
            />
            <div className="relative">
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#273d1e] px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-[#d4ff76]">
                  <Gamepad2 className="h-3.5 w-3.5" aria-hidden /> {featuredTournament.game.name}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#0e160e]/80 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-[#d4ff76]">
                  <span className="h-2 w-2 rounded-full bg-[#c5f94d]" /> Open
                </span>
              </div>

              <h2 className="mt-4 max-w-[16ch] text-2xl font-black uppercase leading-[0.95] tracking-[-0.04em] text-white sm:text-3xl">
                {featuredTournament.title}
              </h2>
              <p className="mt-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[#a9b9a6]">
                Compete for verified Telegram Stars
              </p>

              <div className="mt-6 flex flex-wrap items-end justify-between gap-4 border-t border-[#293d25] pt-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.15em] text-[#93a691]">
                    Prize pool
                  </p>
                  <p className="mt-0.5 text-3xl font-black tracking-[-0.05em] text-[#c5f94d]">
                    ⭐ {featuredTournament.prizePool.toLocaleString()}
                  </p>
                </div>
                <Link
                  href={`/tournaments/${featuredTournament.slug}/register`}
                  className="velox-action gap-1.5 text-xs font-black shadow-[0_0_20px_rgba(197,249,77,0.3)]"
                >
                  {featuredTournament.isPaid
                    ? `Join · ⭐ ${featuredTournament.entryFee}`
                    : "Join Free"}
                  <ArrowUpRight className="h-4 w-4" aria-hidden />
                </Link>
              </div>
            </div>
          </article>
        ) : (
          <div className="velox-card mt-3 p-6 text-center">
            <Gamepad2 className="mx-auto h-8 w-8 text-[#586859]" aria-hidden />
            <h2 className="mt-3 text-sm font-black text-white">New tournaments loading</h2>
            <p className="mt-1 text-xs text-[#8e998f]">Check back soon for upcoming brackets.</p>
          </div>
        )}
      </section>

      {/* Wallet Summary Widget */}
      <section className="mt-7">
        <SectionHeader title="Your verified economy" href="/wallet" label="Open wallet" />
        <div className="velox-card mt-3 overflow-hidden">
          {wallet ? (
            <div className="divide-y divide-[#202c21]">
              <ActivityRow
                icon={<Trophy className="h-4 w-4 text-[#c5f94d]" />}
                label="Tournament rewards"
                value={`+ ⭐ ${wallet.totalRewards}`}
                highlight
              />
              <ActivityRow
                icon={<Wallet className="h-4 w-4 text-slate-400" />}
                label="Entry fees spent"
                value={`⭐ ${wallet.totalSpent}`}
              />
              <ActivityRow
                icon={<Shield className="h-4 w-4 text-cyan-400" />}
                label="Capacity refunds"
                value={`+ ⭐ ${wallet.totalRefunds}`}
                highlight
              />
            </div>
          ) : (
            <p className="p-4 text-xs text-[#8e998f]">
              Open VELOX in Telegram to track verified Star earnings.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}

function Stat({
  label,
  value,
  icon,
  highlight = false,
}: {
  label: string;
  value: string;
  icon: ReactNode;
  highlight?: boolean;
}) {
  return (
    <div className="min-w-0 px-2 py-1">
      <p className="truncate text-[9px] font-black uppercase tracking-[0.14em] text-[#788879]">
        {label}
      </p>
      <p
        className={`mt-1 flex items-center justify-center gap-1 truncate text-sm font-black sm:text-base ${
          highlight ? "text-[#c5f94d]" : "text-white"
        }`}
      >
        <span>{value}</span>
        <span className="text-[#c5f94d]">{icon}</span>
      </p>
    </div>
  );
}

function SectionHeader({ title, href, label }: { title: string; href: string; label: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-xs font-black uppercase tracking-[0.12em] text-[#8e9f8f]">{title}</h2>
      <Link
        href={href}
        className="inline-flex shrink-0 items-center gap-1 text-[11px] font-black uppercase tracking-[0.08em] text-[#c5f94d] transition hover:text-[#d5ff70]"
      >
        {label}
        <ChevronRight className="h-3.5 w-3.5" aria-hidden />
      </Link>
    </div>
  );
}

function QuickAction({
  href,
  icon,
  title,
  subtitle,
}: {
  href: string;
  icon: ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col justify-between rounded-2xl border border-[#233124] bg-[#0e1610] p-3 transition active:scale-95 hover:border-[#425a37] hover:bg-[#131d14] shadow-[0_4px_16px_rgba(0,0,0,0.3)]"
    >
      <div className="grid h-9 w-9 place-items-center rounded-xl bg-[#172318] transition-transform group-hover:scale-105">
        {icon}
      </div>
      <div className="mt-3">
        <p className="text-xs font-black text-white">{title}</p>
        <p className="truncate text-[10px] font-medium text-[#798a7a]">{subtitle}</p>
      </div>
    </Link>
  );
}

function ActivityRow({
  icon,
  label,
  value,
  highlight = false,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <div className="flex items-center gap-2.5">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-[#141e15]">{icon}</span>
        <span className="text-xs font-semibold text-[#a6b8a6]">{label}</span>
      </div>
      <span className={`text-xs font-black ${highlight ? "text-[#c5f94d]" : "text-white"}`}>
        {value}
      </span>
    </div>
  );
}

