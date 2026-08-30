import { Trophy, ArrowRight, Gamepad2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getTournaments } from "@/features/tournaments/actions";
import { getWalletSummary } from "@/features/wallet/services";

export default async function Home() {
  const [user, tournamentsResult, walletResult] = await Promise.all([
    getCurrentUser(),
    getTournaments({ status: "REGISTRATION_OPEN" }),
    getWalletSummary(),
  ]);
  const featuredTournament = tournamentsResult.success && tournamentsResult.data ? tournamentsResult.data[0] : undefined;
  const wallet = walletResult.success && walletResult.data ? walletResult.data.wallet : null;
  const displayName = user?.firstName || "Player";
  const profile = user?.profile;

  return (
    <div className="flex flex-col gap-6 p-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Welcome back, <span className="text-purple-400">{displayName}</span> 👋
          </h1>
          <p className="text-sm text-gray-400">Ready to dominate today?</p>
        </div>
        <div className="w-10 h-10 rounded-full bg-purple-900 flex items-center justify-center text-purple-200 border border-purple-500/30 font-bold">
          {displayName.slice(0, 1).toUpperCase()}
        </div>
      </header>

      {/* User Stats Card */}
      <section className="bg-gradient-to-br from-gray-900 to-black border border-white/5 rounded-2xl p-4 shadow-lg flex justify-between items-center relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-2xl -mr-10 -mt-10" />
        
        <div className="flex flex-col gap-1 z-10">
          <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Rank</span>
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-500" />
            <span className="text-xl font-bold text-white">{profile?.rank || "Unranked"}</span>
          </div>
        </div>
        
        <div className="flex flex-col gap-1 z-10 text-right">
          <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Level {profile?.level || 1}</span>
          <span className="text-xl font-bold text-purple-400">{profile?.xp || 0} XP</span>
        </div>
      </section>

      {/* Featured Tournament */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Featured Tournament</h2>
          <Link href="/tournaments" className="text-sm text-purple-400 font-medium flex items-center gap-1 hover:text-purple-300">
            View All <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        
        <div className="bg-gray-900 border border-purple-500/20 rounded-2xl overflow-hidden relative shadow-lg shadow-purple-900/10">
          {/* Banner Placeholder */}
          <div className="h-32 bg-gradient-to-r from-indigo-900 to-purple-900 flex items-center justify-center">
            <Gamepad2 className="w-16 h-16 text-white/20" />
          </div>
          
          <div className="p-4 flex flex-col gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="bg-blue-500/20 text-blue-400 text-xs px-2 py-0.5 rounded-full font-medium">{featuredTournament?.game.name || "Coming Soon"}</span>
                <span className="bg-red-500/20 text-red-400 text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                  Open
                </span>
              </div>
              <h3 className="text-xl font-bold text-white">{featuredTournament?.title || "New tournaments are on the way"}</h3>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <span className="text-xs text-gray-400">Prize Pool</span>
                <span className="text-sm font-bold text-yellow-500">⭐ {featuredTournament?.prizePool || 0}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-gray-400">Entry Fee</span>
                <span className="text-sm font-bold text-white">{featuredTournament ? featuredTournament.isPaid ? `⭐ ${featuredTournament.entryFee}` : "Free" : "—"}</span>
              </div>
            </div>

            {featuredTournament ? (
              <Link href={`/tournaments/${featuredTournament.slug}/register`} className="w-full">
                <Button className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-6 shadow-[0_0_20px_rgba(147,51,234,0.3)]">
                  {featuredTournament.isPaid ? `Join with ⭐ ${featuredTournament.entryFee}` : "Join Free Tournament"}
                </Button>
              </Link>
            ) : (
              <Button disabled className="w-full bg-gray-800 text-gray-500 font-bold py-6">No open tournaments</Button>
            )}
          </div>
        </div>
      </section>

      {/* Wallet Summary */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-bold text-white">VELOX Wallet</h2>
        <div className="bg-gray-900 border border-white/5 rounded-2xl p-4 flex flex-col gap-4">
          {wallet ? (
            <>
              <div className="flex justify-between items-center border-b border-white/5 pb-3">
                <span className="text-sm text-gray-400">Stars Spent</span>
                <span className="font-bold text-white">⭐ {wallet.totalSpent}</span>
              </div>
              <div className="flex justify-between items-center border-b border-white/5 pb-3">
                <span className="text-sm text-gray-400">Tournament Rewards</span>
                <span className="font-bold text-green-400">+ ⭐ {wallet.totalRewards}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-400">Refunds</span>
                <span className="font-bold text-blue-400">+ ⭐ {wallet.totalRefunds}</span>
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-400">Open VELOX in Telegram to view your verified tournament activity.</p>
          )}
        </div>
      </section>
    </div>
  );
}
