import { getPlayerProfile } from "@/features/profile/actions";
import { User, Trophy, Gamepad2, Settings, Swords, Medal, Gift } from "lucide-react";
import Link from "next/link";

export default async function ProfilePage() {
  const res = await getPlayerProfile();
  
  if (!res.success || !res.data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-black p-4 text-center">
        <User className="w-16 h-16 text-gray-700 mb-4" />
        <h1 className="text-xl font-bold text-white mb-2">Profile Unavailable</h1>
        <p className="text-gray-500">We couldn&apos;t load your profile data.</p>
      </div>
    );
  }

  const { profile, achievements } = res.data;
  const winRate = profile.wins + profile.losses > 0 
    ? Math.round((profile.wins / (profile.wins + profile.losses)) * 100) 
    : 0;

  return (
    <div className="velox-page">
      {/* Header Banner */}
      <div className="h-40 rounded-[28px] border border-[#31442f] bg-gradient-to-br from-[#244219] to-[#0d130e] relative overflow-hidden">
        <div className="absolute top-4 right-4 z-10">
          <Link href="/settings" aria-label="Open settings" className="w-10 h-10 rounded-full bg-black/50 backdrop-blur border border-[#51604e] flex items-center justify-center text-white hover:border-[#c5f94d]">
            <Settings className="w-5 h-5" />
          </Link>
        </div>
      </div>

      <div className="px-4 relative -mt-16 mb-6">
        <div className="flex flex-col items-center">
          <div className="w-32 h-32 rounded-full bg-[#111811] border-4 border-[#c5f94d] flex items-center justify-center text-gray-500 shadow-[0_0_20px_rgba(197,249,77,0.2)] overflow-hidden">
            <span className="text-4xl font-black text-white">{profile.veloxUsername?.[0]?.toUpperCase() || 'U'}</span>
          </div>
          
          <h1 className="text-2xl font-black text-white mt-3">{profile.veloxUsername || profile.user.firstName}</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="bg-[#263c1c] text-[#d4ff76] border border-[#4f703c] text-xs px-2 py-0.5 rounded-full font-bold uppercase">
              {profile.rank}
            </span>
            <span className="text-gray-400 text-sm font-medium">Level {profile.level}</span>
          </div>
        </div>
      </div>

      <div className="px-4 flex flex-col gap-6">
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
