import {
  ExternalLink,
  Gamepad2,
  Gift,
  Medal,
  Send,
  Settings,
  Swords,
  Trophy,
  Users,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { getPlayerProfile } from "@/features/profile/actions";
import { ProfileHeader } from "@/components/profile/ProfileHeader";
import { TelegramAccessRequired } from "@/components/auth/TelegramAccessRequired";

export default async function ProfilePage() {
  const res = await getPlayerProfile();

  if (!res.success || !res.data) {
    return (
      <TelegramAccessRequired
        title="Profile needs Telegram"
        message={res.error ?? "Open VELOX in Telegram to view your player profile."}
      />
    );
  }

  const { profile, achievements } = res.data;
  const totalMatches = profile.wins + profile.losses;
  const winRate = totalMatches > 0 ? Math.round((profile.wins / totalMatches) * 100) : 0;

  // XP Progress calculation
  const currentTierXp = profile.xp % 500;
  const nextTierXp = 500;
  const xpPercent = Math.min(100, Math.max(10, Math.round((currentTierXp / nextTierXp) * 100)));

  return (
    <main className="velox-page">
      <ProfileHeader
        initialImageUrl={profile.user.profileImage}
        displayName={profile.veloxUsername || profile.user.firstName || "VELOX Player"}
        fallbackInitial={(profile.veloxUsername || profile.user.firstName || "P")[0].toUpperCase()}
        rank={profile.rank}
        level={profile.level}
      />

      <div className="mt-6 flex flex-col gap-6">
        {/* XP Level Progression Bar */}
        <section className="velox-card p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-[#20311c] text-[#c5f94d]">
                <Zap className="h-4 w-4" />
              </span>
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-white">
                  Level {profile.level} Progression
                </p>
                <p className="text-[10px] font-medium text-[#7d8e7e]">
                  {currentTierXp} / {nextTierXp} XP to Level {profile.level + 1}
                </p>
              </div>
            </div>
            <span className="rounded-full bg-[#182718] px-2.5 py-1 text-[10px] font-black uppercase text-[#c5f94d]">
              {profile.xp.toLocaleString()} XP
            </span>
          </div>

          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[#172318]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#87c92b] to-[#c5f94d] shadow-[0_0_8px_rgba(197,249,77,0.6)]"
              style={{ width: `${xpPercent}%` }}
            />
          </div>
        </section>

        {/* Career Statistics Grid */}
        <section>
          <div className="flex items-center justify-between px-1 pb-2">
            <h2 className="text-xs font-black uppercase tracking-[0.14em] text-[#8e9f8f]">
              Career Statistics
            </h2>
            <span className="text-[10px] font-bold text-[#6f8070]">{totalMatches} Total Battles</span>
          </div>

          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <StatCard
              title="Win Rate"
              value={`${winRate}%`}
              subtitle="Efficiency"
              icon={<Zap className="h-4 w-4 text-[#c5f94d]" />}
              highlight
            />
            <StatCard
              title="Championships"
              value={String(profile.tournamentWins)}
              subtitle="Trophies Won"
              icon={<Trophy className="h-4 w-4 text-amber-400" />}
            />
            <StatCard
              title="Matches Won"
              value={String(profile.wins)}
              subtitle="Victories"
              icon={<Swords className="h-4 w-4 text-emerald-400" />}
            />
            <StatCard
              title="Matches Lost"
              value={String(profile.losses)}
              subtitle="Defeats"
              icon={<Swords className="h-4 w-4 text-red-400" />}
            />
          </div>
        </section>

        {/* Connected Accounts & Platform Identity */}
        <section className="velox-card p-4">
          <h2 className="text-xs font-black uppercase tracking-[0.14em] text-[#8e9f8f]">
            Linked Identity
          </h2>

          <div className="mt-3 space-y-2.5">
            {/* Telegram Info */}
            <div className="flex items-center justify-between rounded-xl border border-[#212f22] bg-[#0c130e] p-3">
              <div className="flex items-center gap-3">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#182836] text-sky-400">
                  <Send className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-xs font-black text-white">
                    {profile.user.username ? `@${profile.user.username}` : "Telegram User"}
                  </p>
                  <p className="text-[10px] font-medium text-[#7d8e7e]">Verified Telegram Mini App</p>
                </div>
              </div>
              <span className="rounded-md bg-[#19271a] px-2 py-0.5 text-[9px] font-black uppercase text-[#c5f94d]">
                Active
              </span>
            </div>

            {/* Discord Connection Link */}
            <div className="flex items-center justify-between rounded-xl border border-[#212f22] bg-[#0c130e] p-3">
              <div className="flex items-center gap-3">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#201d36] text-indigo-400">
                  <Gamepad2 className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-xs font-black text-white">Discord Integration</p>
                  <p className="text-[10px] font-medium text-[#7d8e7e]">Match notifications & lobbies</p>
                </div>
              </div>
              <Link
                href="/api/discord/connect"
                className="inline-flex items-center gap-1 rounded-lg border border-[#303f4d] bg-[#141b24] px-2.5 py-1 text-[10px] font-black text-indigo-300 hover:bg-[#1b2533]"
              >
                Connect <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </section>

        {/* Quick Hub Navigation */}
        <section className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <Link
            href="/matches"
            className="flex items-center gap-2.5 rounded-2xl border border-[#233124] bg-[#0e1610] p-3 transition hover:border-[#3e5934] hover:bg-[#121c13]"
          >
            <Swords className="h-4 w-4 text-[#c5f94d]" />
            <div>
              <p className="text-xs font-black text-white">Match History</p>
              <p className="text-[9px] text-[#788a79]">View records</p>
            </div>
          </Link>

          <Link
            href="/teams"
            className="flex items-center gap-2.5 rounded-2xl border border-[#233124] bg-[#0e1610] p-3 transition hover:border-[#3e5934] hover:bg-[#121c13]"
          >
            <Users className="h-4 w-4 text-cyan-400" />
            <div>
              <p className="text-xs font-black text-white">My Squad</p>
              <p className="text-[9px] text-[#788a79]">Manage team</p>
            </div>
          </Link>

          <Link
            href="/referrals"
            className="flex items-center gap-2.5 rounded-2xl border border-[#233124] bg-[#0e1610] p-3 transition hover:border-[#3e5934] hover:bg-[#121c13]"
          >
            <Gift className="h-4 w-4 text-amber-400" />
            <div>
              <p className="text-xs font-black text-white">Squad Invites</p>
              <p className="text-[9px] text-[#788a79]">Earn Stars</p>
            </div>
          </Link>

          <Link
            href="/settings"
            className="flex items-center gap-2.5 rounded-2xl border border-[#233124] bg-[#0e1610] p-3 transition hover:border-[#3e5934] hover:bg-[#121c13]"
          >
            <Settings className="h-4 w-4 text-[#9bb09c]" />
            <div>
              <p className="text-xs font-black text-white">Settings</p>
              <p className="text-[9px] text-[#788a79]">Preferences</p>
            </div>
          </Link>
        </section>

        {/* Favorite Games */}
        {profile.favoriteGames && profile.favoriteGames.length > 0 && (
          <section>
            <h2 className="px-1 pb-2 text-xs font-black uppercase tracking-[0.14em] text-[#8e9f8f]">
              Top Disciplines
            </h2>
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {profile.favoriteGames.map((game) => (
                <div
                  key={game}
                  className="rounded-xl border border-[#233124] bg-[#0e1610] px-3.5 py-2 text-xs font-black text-white shadow-sm"
                >
                  {game}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Achievements Showcase */}
        <section>
          <div className="flex items-center justify-between px-1 pb-2">
            <h2 className="text-xs font-black uppercase tracking-[0.14em] text-[#8e9f8f]">
              Achievements Showcase
            </h2>
            <span className="text-[10px] font-bold text-[#6f8070]">
              {achievements.length} Unlocked
            </span>
          </div>

          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {achievements.length === 0 ? (
              <div className="col-span-full rounded-2xl border border-[#233124] bg-[#0e1610] p-6 text-center">
                <Medal className="mx-auto h-8 w-8 text-[#4a5a4b]" />
                <p className="mt-2 text-xs font-black text-white">No achievements unlocked yet</p>
                <p className="mt-0.5 text-[11px] text-[#7d8e7e]">
                  Participate in tournaments and win matches to earn exclusive medals.
                </p>
              </div>
            ) : (
              achievements.map((ua) => (
                <div
                  key={ua.id}
                  className="flex items-center gap-3 rounded-2xl border border-[#233124] bg-[#0e1610] p-3.5 shadow-sm"
                >
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-[#3e5634] bg-[#142215] text-2xl">
                    {ua.achievement.iconUrl || "🏆"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-black text-white">{ua.achievement.name}</p>
                    <p className="line-clamp-1 text-[10px] text-[#7f9080]">
                      {ua.achievement.description}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-md bg-[#1a2b19] px-2 py-0.5 text-[10px] font-black text-[#c5f94d]">
                    +{ua.achievement.xpReward} XP
                  </span>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function StatCard({
  title,
  value,
  subtitle,
  icon,
  highlight = false,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div className="flex flex-col justify-between rounded-2xl border border-[#233124] bg-[#0e1610] p-3.5 shadow-[0_4px_16px_rgba(0,0,0,0.3)]">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider text-[#798a7a]">
          {title}
        </span>
        {icon}
      </div>
      <div className="mt-3">
        <p
          className={`text-2xl font-black tracking-tight ${
            highlight ? "text-[#c5f94d]" : "text-white"
          }`}
        >
          {value}
        </p>
        <p className="mt-0.5 text-[9px] font-medium text-[#6e7f70]">{subtitle}</p>
      </div>
    </div>
  );
}

