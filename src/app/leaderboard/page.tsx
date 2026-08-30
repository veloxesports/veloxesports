import { getGlobalLeaderboard } from "@/features/leaderboard/actions";
import { Crown } from "lucide-react";

export default async function LeaderboardPage() {
  const res = await getGlobalLeaderboard();
  const players = res.success ? res.data : [];

  return (
    <div className="flex flex-col min-h-screen bg-black p-4 pb-24">
      <header className="mb-6 pt-2 text-center">
        <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-yellow-600 tracking-tight">Global Rankings</h1>
        <p className="text-gray-400 mt-1">The best of the best in VELOX</p>
      </header>

      {/* Top 3 Podium */}
      {players && players.length >= 3 && (
        <div className="flex justify-center items-end gap-2 mb-8 mt-4 h-48">
          {/* Rank 2 */}
          <div className="flex flex-col items-center gap-2 w-1/3">
            <div className="w-14 h-14 rounded-full bg-gray-300 border-4 border-gray-400 flex items-center justify-center text-gray-800 font-bold shadow-[0_0_15px_rgba(156,163,175,0.5)]">
              {players[1].user.username?.[0]?.toUpperCase() || 'P'}
            </div>
            <div className="bg-gray-800/80 rounded-t-xl w-full h-24 flex flex-col items-center justify-center border-t-2 border-gray-400">
              <span className="text-gray-300 font-bold truncate w-full text-center px-1">{players[1].veloxUsername || players[1].user.firstName}</span>
              <span className="text-xs text-purple-400 font-bold">{players[1].xp} XP</span>
            </div>
          </div>

          {/* Rank 1 */}
          <div className="flex flex-col items-center gap-2 w-1/3 z-10">
            <Crown className="w-8 h-8 text-yellow-400 -mb-4 z-20 drop-shadow-[0_0_10px_rgba(250,204,21,0.8)]" />
            <div className="w-20 h-20 rounded-full bg-yellow-400 border-4 border-yellow-200 flex items-center justify-center text-yellow-900 font-black text-2xl shadow-[0_0_25px_rgba(250,204,21,0.6)]">
              {players[0].user.username?.[0]?.toUpperCase() || 'P'}
            </div>
            <div className="bg-yellow-900/40 rounded-t-xl w-full h-32 flex flex-col items-center justify-center border-t-2 border-yellow-400 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-t from-yellow-500/10 to-transparent" />
              <span className="text-yellow-400 font-black truncate w-full text-center px-1 text-lg drop-shadow-md">{players[0].veloxUsername || players[0].user.firstName}</span>
              <span className="text-sm text-white font-bold">{players[0].xp} XP</span>
            </div>
          </div>

          {/* Rank 3 */}
          <div className="flex flex-col items-center gap-2 w-1/3">
            <div className="w-12 h-12 rounded-full bg-amber-700 border-4 border-amber-600 flex items-center justify-center text-amber-200 font-bold shadow-[0_0_15px_rgba(180,83,9,0.5)]">
              {players[2].user.username?.[0]?.toUpperCase() || 'P'}
            </div>
            <div className="bg-gray-800/80 rounded-t-xl w-full h-20 flex flex-col items-center justify-center border-t-2 border-amber-700">
              <span className="text-amber-500 font-bold truncate w-full text-center px-1">{players[2].veloxUsername || players[2].user.firstName}</span>
              <span className="text-xs text-purple-400 font-bold">{players[2].xp} XP</span>
            </div>
          </div>
        </div>
      )}

      {/* Rest of Leaderboard */}
      <div className="flex flex-col gap-2">
        {players?.slice(3).map((player, index) => (
          <div key={player.id} className="bg-gray-900 border border-white/5 rounded-xl p-3 flex items-center justify-between shadow-lg">
            <div className="flex items-center gap-4">
              <span className="text-gray-500 font-bold w-6 text-right">#{index + 4}</span>
              <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center text-gray-400 border border-white/10 font-bold">
                {player.user.username?.[0]?.toUpperCase() || 'P'}
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-white">{player.veloxUsername || player.user.firstName || "Player"}</span>
                <span className="text-[10px] text-gray-500 font-bold">{player.rank} Rank</span>
              </div>
            </div>
            <div className="text-right">
              <span className="font-bold text-purple-400">{player.xp} <span className="text-xs text-gray-500">XP</span></span>
            </div>
          </div>
        ))}

        {(!players || players.length === 0) && (
          <div className="text-center text-gray-500 p-8">No players found.</div>
        )}
      </div>
    </div>
  );
}
