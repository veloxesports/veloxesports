"use client";

/* eslint-disable @next/next/no-img-element -- Telegram and Supabase avatars */

import { useState } from "react";
import Link from "next/link";
import {
  Check,
  ChevronRight,
  Crown,
  EyeOff,
  Flame,
  Gamepad2,
  Globe,
  Share2,
  Shield,
  ShieldCheck,
  Swords,
  Trophy,
  Zap,
} from "lucide-react";
import type { HeadToHeadRecord, PublicPlayerProfile } from "@/features/players/types";
import { HeadToHeadView } from "./HeadToHeadView";

type PublicProfileViewProps = {
  profile: PublicPlayerProfile;
  headToHead: HeadToHeadRecord | null;
  isViewerProfile: boolean;
};

type ProfileTab = "overview" | "matches" | "tournaments" | "achievements" | "team" | "h2h";

export function PublicProfileView({ profile, headToHead, isViewerProfile }: PublicProfileViewProps) {
  const [activeTab, setActiveTab] = useState<ProfileTab>("overview");
  const [shared, setShared] = useState(false);

  const stats = profile.stats;
  const currentTierXp = profile.xp % 500;
  const nextTierXp = 500;
  const xpPercent = Math.min(100, Math.max(10, Math.round((currentTierXp / nextTierXp) * 100)));

  const handleShare = () => {
    try {
      const shareUrl = typeof window !== "undefined" ? window.location.href : "";
      if (navigator.share) {
        void navigator.share({
          title: `${profile.displayName} | VELOX Player Profile`,
          text: `Check out ${profile.displayName}'s esports profile and tournament stats on VELOX!`,
          url: shareUrl,
        });
      } else {
        void navigator.clipboard.writeText(shareUrl);
        setShared(true);
        setTimeout(() => setShared(false), 2000);
      }
    } catch {
      // Ignore
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Stadium Hero Header */}
      <section className="relative">
        <div className="relative h-44 overflow-hidden rounded-[28px] border border-[#2e422f] bg-gradient-to-r from-[#121c13] via-[#1a2c1b] to-[#0c140d] shadow-xl sm:h-52">
          <img
            src="/profile-esports-banner.svg"
            alt=""
            className="h-full w-full object-cover opacity-80"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#080d09] via-[#080d09]/40 to-transparent" />

          {/* Top Actions: Share & View Settings if viewer */}
          <div className="absolute top-4 right-4 flex items-center gap-2">
            <button
              type="button"
              onClick={handleShare}
              className="flex items-center gap-1.5 rounded-xl border border-white/15 bg-black/40 px-3 py-1.5 text-xs font-black text-white backdrop-blur transition hover:bg-black/60 active:scale-95"
            >
              {shared ? (
                <>
                  <Check className="h-3.5 w-3.5 text-[#c5f94d]" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Share2 className="h-3.5 w-3.5" />
                  <span>Share</span>
                </>
              )}
            </button>
            {isViewerProfile && (
              <Link
                href="/settings"
                className="rounded-xl border border-white/15 bg-black/40 px-3 py-1.5 text-xs font-black text-[#c5f94d] backdrop-blur hover:bg-black/60"
              >
                Settings
              </Link>
            )}
          </div>
        </div>

        {/* Identity Bar */}
        <div className="relative -mt-16 px-4 sm:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            {/* Avatar + Main Details */}
            <div className="flex items-end gap-3.5">
              <div className="relative">
                <div className="grid h-20 w-20 place-items-center overflow-hidden rounded-[22px] border-2 border-[#c5f94d] bg-[#111912] shadow-[0_0_25px_rgba(197,249,77,0.3)] sm:h-24 sm:w-24">
                  {profile.profileImage ? (
                    <img
                      src={profile.profileImage}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-2xl font-black text-white">
                      {profile.displayName[0]?.toUpperCase()}
                    </span>
                  )}
                </div>

                <div className="absolute -bottom-2 -right-1 rounded-full bg-[#1b2b1b] border border-[#3b5438] px-2 py-0.5 text-[9px] font-black uppercase text-[#c5f94d] shadow">
                  {profile.rank}
                </div>
              </div>

              <div className="pb-1">
                <div className="flex items-center gap-1.5">
                  <h1 className="text-xl font-black text-white sm:text-2xl">
                    {profile.displayName}
                  </h1>
                  {profile.isVerified && (
                    <span title="Verified Competitor">
                      <ShieldCheck className="h-4 w-4 text-[#c5f94d] shrink-0" />
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs text-[#839780] mt-0.5">
                  {profile.telegramUsername && <span>@{profile.telegramUsername}</span>}
                  {profile.country && (
                    <span className="flex items-center gap-1">
                      <Globe className="h-3 w-3" />
                      <span>{profile.country}</span>
                    </span>
                  )}
                  <span>· Joined {new Date(profile.joinedDate).toLocaleDateString(undefined, { month: "short", year: "numeric" })}</span>
                </div>
              </div>
            </div>

            {/* Quick Action: Head-to-Head Comparison Button */}
            {!isViewerProfile && (
              <button
                type="button"
                onClick={() => setActiveTab("h2h")}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#c5f94d] px-4 text-xs font-black text-[#080d09] shadow-[0_0_15px_rgba(197,249,77,0.25)] transition hover:bg-[#d5ff70] active:scale-95"
              >
                <Swords className="h-4 w-4" />
                <span>Head-to-Head Compare</span>
              </button>
            )}
          </div>

          {/* Badges Bar: Discord, Team */}
          <div className="mt-3.5 flex flex-wrap items-center gap-2">
            {/* Discord Badge */}
            {profile.discordConnected && (
              <div className="inline-flex items-center gap-1.5 rounded-xl border border-[#3b4382] bg-[#161a3b] px-2.5 py-1 text-[11px] font-black text-[#96a6ff]">
                <Gamepad2 className="h-3 w-3" />
                <span>{profile.discordUsername ? `@${profile.discordUsername}` : "Discord Connected"}</span>
              </div>
            )}

            {/* Current Team Badge */}
            {profile.team && (
              <button
                type="button"
                onClick={() => setActiveTab("team")}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#294029] bg-[#142315] px-2.5 py-1 text-[11px] font-black text-[#c5f94d] hover:bg-[#1a2e1c]"
              >
                <Shield className="h-3 w-3" />
                <span>{profile.team.name} ({profile.team.userRole})</span>
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Tabs Bar */}
      <section className="flex items-center gap-1.5 overflow-x-auto border-b border-[#213021] pb-2 scrollbar-none">
        <button
          type="button"
          onClick={() => setActiveTab("overview")}
          className={`shrink-0 rounded-xl px-3 py-1.5 text-xs font-black uppercase tracking-wider transition ${
            activeTab === "overview"
              ? "bg-[#c5f94d] text-[#080d09] shadow-[0_0_12px_rgba(197,249,77,0.3)]"
              : "text-[#839780] hover:text-white"
          }`}
        >
          Overview
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("matches")}
          className={`shrink-0 rounded-xl px-3 py-1.5 text-xs font-black uppercase tracking-wider transition ${
            activeTab === "matches"
              ? "bg-[#c5f94d] text-[#080d09] shadow-[0_0_12px_rgba(197,249,77,0.3)]"
              : "text-[#839780] hover:text-white"
          }`}
        >
          Matches ({profile.matchHistory.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("tournaments")}
          className={`shrink-0 rounded-xl px-3 py-1.5 text-xs font-black uppercase tracking-wider transition ${
            activeTab === "tournaments"
              ? "bg-[#c5f94d] text-[#080d09] shadow-[0_0_12px_rgba(197,249,77,0.3)]"
              : "text-[#839780] hover:text-white"
          }`}
        >
          Tournaments ({profile.tournamentHistory.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("achievements")}
          className={`shrink-0 rounded-xl px-3 py-1.5 text-xs font-black uppercase tracking-wider transition ${
            activeTab === "achievements"
              ? "bg-[#c5f94d] text-[#080d09] shadow-[0_0_12px_rgba(197,249,77,0.3)]"
              : "text-[#839780] hover:text-white"
          }`}
        >
          Trophies ({profile.achievements.filter((a) => a.isUnlocked).length})
        </button>
        {profile.team && (
          <button
            type="button"
            onClick={() => setActiveTab("team")}
            className={`shrink-0 rounded-xl px-3 py-1.5 text-xs font-black uppercase tracking-wider transition ${
              activeTab === "team"
                ? "bg-[#c5f94d] text-[#080d09] shadow-[0_0_12px_rgba(197,249,77,0.3)]"
                : "text-[#839780] hover:text-white"
            }`}
          >
            Squad
          </button>
        )}
        {!isViewerProfile && (
          <button
            type="button"
            onClick={() => setActiveTab("h2h")}
            className={`shrink-0 rounded-xl px-3 py-1.5 text-xs font-black uppercase tracking-wider transition ${
              activeTab === "h2h"
                ? "bg-[#c5f94d] text-[#080d09] shadow-[0_0_12px_rgba(197,249,77,0.3)]"
                : "text-[#839780] hover:text-white"
            }`}
          >
            Head-to-Head
          </button>
        )}
      </section>

      {/* Tab 1: Overview */}
      {activeTab === "overview" && (
        <div className="flex flex-col gap-5">
          {/* Level & XP Progression */}
          <div className="velox-card p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-xl bg-[#20311c] text-[#c5f94d]">
                  <Zap className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-white">
                    Level {profile.level} Competitor
                  </p>
                  <p className="text-[10px] font-medium text-[#7d8e7e]">
                    {currentTierXp} / {nextTierXp} XP to Level {profile.level + 1}
                  </p>
                </div>
              </div>
              <span className="rounded-full bg-[#182718] px-2.5 py-1 text-[10px] font-black uppercase text-[#c5f94d]">
                {profile.xp.toLocaleString()} Total XP
              </span>
            </div>

            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[#172318]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#87c92b] to-[#c5f94d] shadow-[0_0_8px_rgba(197,249,77,0.6)]"
                style={{ width: `${xpPercent}%` }}
              />
            </div>
          </div>

          {/* Career Stats Grid (or Privacy Mask) */}
          {stats ? (
            <section className="flex flex-col gap-2">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-xs font-black uppercase tracking-wider text-[#81947f]">
                  Career Record
                </h3>
                <span className="text-[10px] font-bold text-[#627660]">
                  Global Rank #{stats.globalRank}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                <div className="rounded-2xl border border-[#273827] bg-[#111912] p-3 text-left">
                  <div className="flex items-center justify-between text-[#8ba088]">
                    <span className="text-[10px] font-black uppercase tracking-wider">Win Rate</span>
                    <Zap className="h-3.5 w-3.5 text-[#c5f94d]" />
                  </div>
                  <p className="mt-1 text-2xl font-black text-white">{stats.winRate}%</p>
                  <span className="text-[10px] font-semibold text-[#6f826d]">
                    {stats.wins}W - {stats.losses}L
                  </span>
                </div>

                <div className="rounded-2xl border border-[#273827] bg-[#111912] p-3 text-left">
                  <div className="flex items-center justify-between text-[#8ba088]">
                    <span className="text-[10px] font-black uppercase tracking-wider">Trophies</span>
                    <Trophy className="h-3.5 w-3.5 text-amber-400" />
                  </div>
                  <p className="mt-1 text-2xl font-black text-white">{stats.tournamentWins}</p>
                  <span className="text-[10px] font-semibold text-[#6f826d]">Championships</span>
                </div>

                <div className="rounded-2xl border border-[#273827] bg-[#111912] p-3 text-left">
                  <div className="flex items-center justify-between text-[#8ba088]">
                    <span className="text-[10px] font-black uppercase tracking-wider">Matches</span>
                    <Swords className="h-3.5 w-3.5 text-blue-400" />
                  </div>
                  <p className="mt-1 text-2xl font-black text-white">{stats.matchesPlayed}</p>
                  <span className="text-[10px] font-semibold text-[#6f826d]">Total Fixtures</span>
                </div>

                <div className="rounded-2xl border border-[#273827] bg-[#111912] p-3 text-left">
                  <div className="flex items-center justify-between text-[#8ba088]">
                    <span className="text-[10px] font-black uppercase tracking-wider">Win Streak</span>
                    <Flame className="h-3.5 w-3.5 text-orange-400" />
                  </div>
                  <p className="mt-1 text-2xl font-black text-white">{stats.currentStreak} 🔥</p>
                  <span className="text-[10px] font-semibold text-[#6f826d]">Current Streak</span>
                </div>
              </div>

              {/* Game Specific Stats */}
              {stats.gameStats.length > 0 && (
                <div className="mt-2 flex flex-col gap-2">
                  <h4 className="text-[11px] font-black uppercase tracking-wider text-[#81947f] px-1">
                    Game Performance
                  </h4>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {stats.gameStats.map((g) => (
                      <div
                        key={g.gameSlug}
                        className="flex items-center justify-between rounded-xl border border-[#233323] bg-[#0e160f] p-3"
                      >
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs font-black text-white truncate">{g.gameName}</span>
                          {g.inGameId && (
                            <span className="text-[10px] text-[#7d907b] truncate">
                              IGN: <strong className="text-[#a4bca2]">{g.inGameId}</strong>
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 shrink-0 text-right">
                          <div>
                            <span className="block text-xs font-black text-[#c5f94d]">
                              {g.winRate}% WR
                            </span>
                            <span className="block text-[9px] text-[#6d806b]">
                              {g.wins}W - {g.losses}L
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          ) : (
            <div className="rounded-2xl border border-[#263725] bg-[#0e150f] p-4 text-center">
              <EyeOff className="mx-auto h-5 w-5 text-[#6c7f6a]" />
              <p className="mt-2 text-xs font-bold text-[#869984]">
                Career statistics are hidden by this player&apos;s privacy settings.
              </p>
            </div>
          )}

          {/* Primary Games Badges */}
          {profile.favoriteGames.length > 0 && (
            <div className="flex flex-col gap-2">
              <h4 className="text-[11px] font-black uppercase tracking-wider text-[#81947f] px-1">
                Primary Games
              </h4>
              <div className="flex flex-wrap gap-2">
                {profile.favoriteGames.map((game) => (
                  <span
                    key={game}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-[#2a3c2a] bg-[#121c13] px-3 py-1.5 text-xs font-bold text-white"
                  >
                    <Gamepad2 className="h-3.5 w-3.5 text-[#c5f94d]" />
                    <span>{game}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Matches */}
      {activeTab === "matches" && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between px-1 text-[11px] font-black uppercase tracking-wider text-[#798d77]">
            <span>Recent Tournament Matches</span>
            <span>{profile.matchHistory.length} Matches</span>
          </div>

          {profile.matchHistory.length > 0 ? (
            <div className="flex flex-col gap-2">
              {profile.matchHistory.map((m) => (
                <Link
                  key={m.id}
                  href={`/matches/${m.id}`}
                  className="flex items-center justify-between rounded-2xl border border-[#263725] bg-[#101711] p-3 shadow transition hover:border-[#4b6a48] hover:bg-[#142015]"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="grid h-10 w-10 place-items-center overflow-hidden rounded-xl border border-[#354c33] bg-[#162317] font-black text-white shrink-0">
                      {m.opponentAvatar ? (
                        <img src={m.opponentAvatar} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <span>{m.opponentName[0]?.toUpperCase()}</span>
                      )}
                    </div>

                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-black text-white truncate">
                          vs {m.opponentName}
                        </span>
                        <span className="text-[10px] text-[#71856f]">({m.roundName})</span>
                      </div>
                      <span className="text-[10px] text-[#8ba088] truncate">
                        {m.tournamentTitle} · {m.gameName}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-mono text-xs font-black text-white">
                      {m.playerScore} - {m.opponentScore}
                    </span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[9px] font-black uppercase ${
                        m.isWinner
                          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                          : "bg-red-500/20 text-red-400 border border-red-500/30"
                      }`}
                    >
                      {m.isWinner ? "Victory" : "Defeat"}
                    </span>
                    <ChevronRight className="h-4 w-4 text-[#516450]" />
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-[#263725] bg-[#0e150f] p-6 text-center">
              <EyeOff className="mx-auto h-5 w-5 text-[#6c7f6a]" />
              <p className="mt-2 text-xs font-bold text-[#869984]">
                {profile.privacy.showHistory
                  ? "No tournament match records available yet."
                  : "Match history is hidden by this player's privacy settings."}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Tournaments */}
      {activeTab === "tournaments" && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between px-1 text-[11px] font-black uppercase tracking-wider text-[#798d77]">
            <span>Tournament Registrations</span>
            <span>{profile.tournamentHistory.length} Registered</span>
          </div>

          {profile.tournamentHistory.length > 0 ? (
            <div className="grid gap-2.5 sm:grid-cols-2">
              {profile.tournamentHistory.map((t) => (
                <Link
                  key={t.id}
                  href={`/tournaments/${t.slug}`}
                  className="flex flex-col justify-between rounded-2xl border border-[#263725] bg-[#101711] p-3.5 shadow transition hover:border-[#4b6a48] hover:bg-[#142015]"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="rounded bg-[#1a2b1a] px-2 py-0.5 text-[9px] font-black uppercase text-[#c5f94d]">
                        {t.gameName}
                      </span>
                      <span className="text-[10px] font-bold text-[#71856f]">
                        {t.format}
                      </span>
                    </div>

                    <h4 className="mt-2 text-sm font-black text-white line-clamp-1">
                      {t.title}
                    </h4>
                  </div>

                  <div className="mt-3 flex items-center justify-between border-t border-[#1f2d1f] pt-2 text-[10px] text-[#81967f]">
                    <span>{new Date(t.startDate).toLocaleDateString()}</span>
                    <span className="font-bold text-[#c5f94d]">
                      {t.placement ? `Rank #${t.placement}` : t.status}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-[#263725] bg-[#0e150f] p-6 text-center">
              <EyeOff className="mx-auto h-5 w-5 text-[#6c7f6a]" />
              <p className="mt-2 text-xs font-bold text-[#869984]">
                {profile.privacy.showHistory
                  ? "No tournament entries recorded yet."
                  : "Tournament history is hidden by this player's privacy settings."}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Achievements / Trophy Room */}
      {activeTab === "achievements" && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between px-1 text-[11px] font-black uppercase tracking-wider text-[#798d77]">
            <span>Trophy Room</span>
            <span>
              {profile.achievements.filter((a) => a.isUnlocked).length} / {profile.achievements.length} Unlocked
            </span>
          </div>

          <div className="grid gap-2.5 sm:grid-cols-2">
            {profile.achievements.map((ach) => (
              <div
                key={ach.id}
                className={`flex items-start gap-3 rounded-2xl border p-3 transition ${
                  ach.isUnlocked
                    ? "border-[#385236] bg-gradient-to-br from-[#142215] to-[#0d140e] shadow-md"
                    : "border-[#202c20] bg-[#0a100b] opacity-60"
                }`}
              >
                <div
                  className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border ${
                    ach.isUnlocked
                      ? "border-[#c5f94d]/40 bg-[#1e311b] text-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.3)]"
                      : "border-[#293829] bg-[#121912] text-[#637562]"
                  }`}
                >
                  <Trophy className="h-5 w-5" />
                </div>

                <div className="flex flex-col min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <h4 className="text-xs font-black text-white truncate">{ach.name}</h4>
                    <span className="text-[10px] font-black text-[#c5f94d]">
                      +{ach.xpReward} XP
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-[#869984] line-clamp-2">
                    {ach.description}
                  </p>
                  {ach.earnedAt && (
                    <span className="mt-1 text-[9px] font-semibold text-emerald-400">
                      Unlocked on {new Date(ach.earnedAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 5: Team & Squad */}
      {activeTab === "team" && profile.team && (
        <div className="flex flex-col gap-4">
          <div className="velox-card p-4">
            <div className="flex items-center justify-between border-b border-[#213021] pb-3">
              <div className="flex items-center gap-3">
                <div className="grid h-12 w-12 place-items-center rounded-xl bg-[#20311c] text-[#c5f94d]">
                  <Shield className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">{profile.team.name}</h3>
                  <p className="text-xs text-[#7f947d]">
                    {profile.team.totalMembers} Roster Members · Role: <strong className="text-[#c5f94d]">{profile.team.userRole}</strong>
                  </p>
                </div>
              </div>

              <div className="text-right">
                <span className="rounded bg-[#1f311c] px-2 py-0.5 text-[10px] font-black uppercase text-[#c5f94d]">
                  {profile.team.teamWins}W - {profile.team.teamLosses}L
                </span>
              </div>
            </div>

            {/* Teammates List */}
            <div className="mt-3">
              <h4 className="text-[11px] font-black uppercase tracking-wider text-[#829680] mb-2">
                Active Squad Lineup (Tap to View Profile)
              </h4>
              <div className="grid gap-2 sm:grid-cols-2">
                {profile.team.roster.map((member) => (
                  <Link
                    key={member.userId}
                    href={`/players/${member.userId}`}
                    className="flex items-center justify-between rounded-xl border border-[#233323] bg-[#101711] p-2.5 transition hover:border-[#476344] hover:bg-[#142014]"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-lg bg-[#182619] font-black text-xs text-white">
                        {member.profileImage ? (
                          <img src={member.profileImage} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <span>{member.name[0]?.toUpperCase()}</span>
                        )}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-1">
                          <span className="text-xs font-black text-white truncate">{member.name}</span>
                          {member.role === "CAPTAIN" && (
                            <Crown className="h-3 w-3 text-amber-400 shrink-0" />
                          )}
                        </div>
                        <span className="text-[10px] text-[#7d907b]">
                          Lv. {member.level} · {member.rank}
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-[#516450]" />
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 6: Head-to-Head */}
      {activeTab === "h2h" && !isViewerProfile && (
        <HeadToHeadView record={headToHead} targetPlayerName={profile.displayName} />
      )}
    </div>
  );
}
