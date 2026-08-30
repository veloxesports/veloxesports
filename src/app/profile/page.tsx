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
    <div className="flex flex-col min-h-screen bg-black pb-24">
      {/* Header Banner */}
      <div className="h-40 bg-gradient-to-br from-indigo-900 to-black relative">
        <div className="absolute top-4 right-4 z-10">
          <Link href="/settings" aria-label="Open settings" className="w-10 h-10 rounded-full bg-black/50 backdrop-blur border border-white/10 flex items-center justify-center text-white hover:bg-black/70">
            <Settings className="w-5 h-5" />
          </Link>
        </div>
      </div>

      <div className="px-4 relative -mt-16 mb-6">
        <div className="flex flex-col items-center">
          <div className="w-32 h-32 rounded-full bg-gray-900 border-4 border-purple-500 flex items-center justify-center text-gray-500 shadow-[0_0_20px_rgba(168,85,247,0.4)] overflow-hidden">
            <span className="text-4xl font-black text-white">{profile.veloxUsername?.[0]?.toUpperCase() || 'U'}</span>
          </div>
          
          <h1 className="text-2xl font-black text-white mt-3">{profile.veloxUsername || profile.user.firstName}</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="bg-purple-900/50 text-purple-300 border border-purple-500/30 text-xs px-2 py-0.5 rounded-full font-bold uppercase">
              {profile.rank}
            </span>
            <span className="text-gray-400 text-sm font-medium">Level {profile.level}</span>
          </div>
        </div>
      </div>

      <div className="px-4 flex flex-col gap-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gray-900 border border-white/5 rounded-2xl p-4 flex flex-col items-center text-center shadow-lg">
            <Swords className="w-6 h-6 text-blue-400 mb-2" />
            <span className="text-2xl font-black text-white">{winRate}%</span>
            <span className="text-xs text-gray-500 font-bold uppercase mt-1">Win Rate</span>
          </div>
          
          <div className="bg-gray-900 border border-white/5 rounded-2xl p-4 flex flex-col items-center text-center shadow-lg">
            <Trophy className="w-6 h-6 text-yellow-500 mb-2" />
            <span className="text-2xl font-black text-white">{profile.tournamentWins}</span>
            <span className="text-xs text-gray-500 font-bold uppercase mt-1">Tournament Wins</span>
          </div>

          <div className="bg-gray-900 border border-white/5 rounded-2xl p-4 flex flex-col items-center text-center shadow-lg">
            <span className="text-2xl font-black text-green-400 mb-2">{profile.wins}</span>
            <span className="text-xs text-gray-500 font-bold uppercase">Matches Won</span>
          </div>

          <div className="bg-gray-900 border border-white/5 rounded-2xl p-4 flex flex-col items-center text-center shadow-lg">
            <span className="text-2xl font-black text-red-400 mb-2">{profile.losses}</span>
            <span className="text-xs text-gray-500 font-bold uppercase">Matches Lost</span>
          </div>
        </div>

        {/* Favorite Games */}
        {profile.favoriteGames && profile.favoriteGames.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Gamepad2 className="w-5 h-5 text-purple-400" /> Top Games
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
                    <span className="text-xs font-bold text-purple-400">+{ua.achievement.xpReward} XP</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <Link href="/referrals" className="flex items-center justify-between rounded-2xl border border-violet-400/20 bg-violet-500/5 p-4 transition hover:bg-violet-500/10">
          <span className="flex items-center gap-3"><Gift className="h-5 w-5 text-violet-300" aria-hidden /><span><span className="block font-bold text-white">Invite friends</span><span className="block text-sm text-slate-400">Share your referral code with your squad.</span></span></span>
          <span className="text-sm font-semibold text-violet-300">Open</span>
        </Link>
      </div>
    </div>
  );
}
