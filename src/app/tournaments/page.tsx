import { getTournaments, getGames } from "@/features/tournaments/actions";
import { Gamepad2, Users, Calendar, Trophy, ChevronRight } from "lucide-react";
import Link from "next/link";

export default async function TournamentsPage() {
  const [tournamentsRes, gamesRes] = await Promise.all([
    getTournaments(),
    getGames(),
  ]);

  const tournaments = tournamentsRes.success ? tournamentsRes.data : [];
  const games = gamesRes.success ? gamesRes.data : [];

  return (
    <div className="flex flex-col gap-6 p-4 pb-20">
      <header className="pt-2">
        <h1 className="text-3xl font-bold text-white tracking-tight">Tournaments</h1>
        <p className="text-gray-400 mt-1">Compete and earn rewards</p>
      </header>

      {/* Filters (Visual only for now) */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        <button className="px-4 py-1.5 bg-purple-600 text-white rounded-full text-sm font-medium whitespace-nowrap">
          All
        </button>
        <button className="px-4 py-1.5 bg-gray-900 border border-white/10 text-gray-300 rounded-full text-sm font-medium whitespace-nowrap hover:bg-gray-800 transition-colors">
          Live
        </button>
        <button className="px-4 py-1.5 bg-gray-900 border border-white/10 text-gray-300 rounded-full text-sm font-medium whitespace-nowrap hover:bg-gray-800 transition-colors">
          Upcoming
        </button>
        <button className="px-4 py-1.5 bg-gray-900 border border-white/10 text-gray-300 rounded-full text-sm font-medium whitespace-nowrap hover:bg-gray-800 transition-colors">
          Free to Play
        </button>
      </div>

      {/* Game Filters */}
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
        {games?.map((game) => (
          <div key={game.id} className="flex flex-col items-center gap-1 min-w-[70px]">
            <div className="w-14 h-14 bg-gray-900 border border-white/5 rounded-2xl flex items-center justify-center shadow-lg cursor-pointer hover:border-purple-500/50 transition-colors">
              <Gamepad2 className="text-purple-400 w-6 h-6" />
            </div>
            <span className="text-[10px] text-gray-400 font-medium text-center w-full truncate">{game.name}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-4">
        {tournaments?.length === 0 ? (
          <div className="bg-gray-900/50 border border-white/5 rounded-2xl p-8 flex flex-col items-center justify-center text-center">
            <Trophy className="w-12 h-12 text-gray-600 mb-3" />
            <h3 className="text-lg font-bold text-gray-300">No tournaments found</h3>
            <p className="text-sm text-gray-500 mt-1">Check back later for new competitions.</p>
          </div>
        ) : (
          tournaments?.map((t) => (
            <Link key={t.id} href={`/tournaments/${t.slug}`}>
              <div className="bg-gradient-to-b from-gray-900 to-black border border-white/10 rounded-2xl overflow-hidden shadow-xl hover:border-purple-500/30 transition-colors group">
                {/* Banner */}
                <div className="h-28 bg-indigo-950 flex items-center justify-center relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-purple-900/50 to-indigo-900/50" />
                  <Trophy className="w-12 h-12 text-white/10 absolute -right-2 -bottom-2 scale-150 rotate-12" />
                  <span className="text-2xl font-black text-white/50 italic tracking-widest z-10">{t.game.name.toUpperCase()}</span>
                </div>
                
                {/* Content */}
                <div className="p-4 relative">
                  <div className="absolute -top-5 right-4 bg-black border border-white/10 rounded-xl px-3 py-1.5 shadow-lg flex items-center gap-1.5">
                    <div className={`w-2 h-2 rounded-full ${t.status === 'REGISTRATION_OPEN' ? 'bg-green-500' : 'bg-yellow-500'}`} />
                    <span className="text-xs font-bold text-white">
                      {t.status === 'REGISTRATION_OPEN' ? 'OPEN' : t.status.replace('_', ' ')}
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-white mt-1 group-hover:text-purple-400 transition-colors">{t.title}</h3>
                  
                  <div className="grid grid-cols-2 gap-y-3 mt-4">
                    <div className="flex items-center gap-2 text-sm">
                      <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center">
                        <Trophy className="w-4 h-4 text-yellow-500" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] text-gray-500 uppercase font-bold">Prize Pool</span>
                        <span className="font-bold text-white">{t.isPaid ? `⭐ ${t.prizePool}` : 'Free Rewards'}</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 text-sm">
                      <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center">
                        <span className="text-white font-bold text-xs">FEE</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] text-gray-500 uppercase font-bold">Entry</span>
                        <span className="font-bold text-white">{t.isPaid ? `⭐ ${t.entryFee}` : 'FREE'}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-sm">
                      <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center">
                        <Users className="w-4 h-4 text-blue-400" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] text-gray-500 uppercase font-bold">Players</span>
                        <span className="font-bold text-white">{t.currentParticipants} / {t.maxParticipants}</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 text-sm">
                      <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center">
                        <Calendar className="w-4 h-4 text-purple-400" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] text-gray-500 uppercase font-bold">Starts</span>
                        <span className="font-bold text-white">
                          {new Date(t.startDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
