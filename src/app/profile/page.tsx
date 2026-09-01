import { getPlayerProfile } from "@/features/profile/actions";
import { Trophy, Gamepad2, Swords, Medal, Gift } from "lucide-react";
import { ProfileHeader } from "@/components/profile/ProfileHeader";
import { TelegramAccessRequired } from "@/components/auth/TelegramAccessRequired";
import Link from "next/link";

export default async function ProfilePage() {
  const res = await getPlayerProfile();
  
  if (!res.success || !res.data) {
    return <TelegramAccessRequired title="Profile needs Telegram" message={res.error ?? "Open VELOX in Telegram to view your player profile."} />;
  }

  const { profile, achievements } = res.data;
  const winRate = profile.wins + profile.losses > 0 
    ? Math.round((profile.wins / (profile.wins + profile.losses)) * 100) 
    : 0;

  return (
    <div className="velox-page">
      <ProfileHeader
        initialImageUrl={profile.user.profileImage}
        displayName={profile.veloxUsername || profile.user.firstName || "VELOX Player"}
        fallbackInitial={(profile.veloxUsername || profile.user.firstName || "U")[0].toUpperCase()}
        rank={profile.rank}
        level={profile.level}
      />

      <div className="mt-6 px-4 flex flex-col gap-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="velox-card p-4 flex flex-col items-center text-center">
            <Swords className="w-6 h-6 text-blue-400 mb-2" />
            <span className="text-2xl font-black text-white">{winRate}%</span>
            <span className="text-xs text-gray-500 font-bold uppercase mt-1">Win Rate</span>
          </div>
          
          <div className="velox-card p-4 flex flex-col items-center text-center">
            <Trophy className="w-6 h-6 text-yellow-500 mb-2" />
            <span className="text-2xl font-black text-white">{profile.tournamentWins}</span>
            <span className="text-xs text-gray-500 font-bold uppercase mt-1">Tournament Wins</span>
          </div>

          <div className="velox-card p-4 flex flex-col items-center text-center">
            <span className="text-2xl font-black text-[#c5f94d] mb-2">{profile.wins}</span>
            <span className="text-xs text-gray-500 font-bold uppercase">Matches Won</span>
          </div>

          <div className="velox-card p-4 flex flex-col items-center text-center">
            <span className="text-2xl font-black text-red-400 mb-2">{profile.losses}</span>
            <span className="text-xs text-gray-500 font-bold uppercase">Matches Lost</span>
          </div>
        </div>

        {/* Favorite Games */}
        {profile.favoriteGames && profile.favoriteGames.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Gamepad2 className="w-5 h-5 text-[#c5f94d]" /> Top Games
            </h2>
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {profile.favoriteGames.map((game) => (
                <div key={game} className="px-4 py-2 bg-gray-900 border border-white/10 rounded-xl whitespace-nowrap text-sm font-medium text-gray-300">
                  {game}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Achievements */}
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Medal className="w-5 h-5 text-yellow-500" /> Achievements
          </h2>
          <div className="grid grid-cols-1 gap-3">
            {achievements.length === 0 ? (
              <div className="text-sm text-gray-500 bg-gray-900/50 p-4 rounded-xl border border-white/5 text-center">
                No achievements yet. Keep playing to earn rewards!
              </div>
            ) : (
              achievements.map((ua) => (
                <div key={ua.id} className="bg-gray-900 border border-white/10 rounded-xl p-3 flex items-center gap-3">
                  <div className="w-12 h-12 bg-black rounded-full flex items-center justify-center border border-yellow-500/30 text-2xl">
                    {ua.achievement.iconUrl || '🏆'}
                  </div>
                  <div className="flex flex-col">
                    <span className="font-bold text-white text-sm">{ua.achievement.name}</span>
                    <span className="text-xs text-gray-400">{ua.achievement.description}</span>
                  </div>
                  <div className="ml-auto flex flex-col items-end">
                    <span className="text-xs font-bold text-[#c5f94d]">+{ua.achievement.xpReward} XP</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <Link href="/referrals" className="flex items-center justify-between rounded-2xl border border-[#45613a] bg-[#162313] p-4 transition hover:bg-[#1c2d17]">
          <span className="flex items-center gap-3"><Gift className="h-5 w-5 text-[#c5f94d]" aria-hidden /><span><span className="block font-bold text-white">Invite friends</span><span className="block text-sm text-slate-400">Share your referral code with your squad.</span></span></span>
          <span className="text-sm font-semibold text-[#c5f94d]">Open</span>
        </Link>
      </div>
    </div>
  );
}
