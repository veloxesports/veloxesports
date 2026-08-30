import { getTournamentBySlug } from "@/features/tournaments/actions";
import { notFound } from "next/navigation";
import { ChevronLeft, Trophy, Users, Calendar, Info, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function TournamentDetailsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const res = await getTournamentBySlug(slug);

  if (!res.success || !res.data) {
    notFound();
  }

  const tournament = res.data;
  
  return (
    <div className="flex flex-col pb-24 min-h-screen bg-black">
      {/* Hero Banner */}
      <div className="h-48 bg-gradient-to-br from-purple-900 to-black relative">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10" />
        
        <div className="absolute top-4 left-4 z-10">
          <Link href="/tournaments">
            <div className="w-10 h-10 rounded-full bg-black/50 backdrop-blur border border-white/10 flex items-center justify-center text-white">
              <ChevronLeft className="w-6 h-6" />
            </div>
          </Link>
        </div>
        
        <div className="absolute bottom-4 left-4 z-10">
          <div className="flex items-center gap-2 mb-2">
            <span className="bg-purple-600 text-white text-[10px] uppercase font-bold px-2 py-0.5 rounded">
              {tournament.game.name}
            </span>
            <span className="bg-black/50 backdrop-blur border border-white/10 text-white text-[10px] uppercase font-bold px-2 py-0.5 rounded">
              {tournament.format.replace('_', ' ')}
            </span>
          </div>
          <h1 className="text-2xl font-black text-white leading-tight shadow-black drop-shadow-md">
            {tournament.title}
          </h1>
        </div>
      </div>

      <div className="p-4 flex flex-col gap-6">
        {/* Info Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gray-900 border border-white/5 rounded-xl p-3 flex flex-col">
            <span className="text-[10px] text-gray-500 font-bold uppercase mb-1">Prize Pool</span>
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-yellow-500" />
              <span className="font-bold text-white text-lg">
                {tournament.isPaid ? `⭐ ${tournament.prizePool}` : 'Free Rewards'}
              </span>
            </div>
          </div>
          <div className="bg-gray-900 border border-white/5 rounded-xl p-3 flex flex-col">
            <span className="text-[10px] text-gray-500 font-bold uppercase mb-1">Entry Fee</span>
            <div className="flex items-center gap-2">
              <span className="font-bold text-white text-lg">
                {tournament.isPaid ? `⭐ ${tournament.entryFee}` : 'FREE'}
              </span>
            </div>
          </div>
          <div className="bg-gray-900 border border-white/5 rounded-xl p-3 flex flex-col">
            <span className="text-[10px] text-gray-500 font-bold uppercase mb-1">Players</span>
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-400" />
              <span className="font-bold text-white">
                {tournament.currentParticipants} <span className="text-gray-500 text-sm">/ {tournament.maxParticipants}</span>
              </span>
            </div>
          </div>
          <div className="bg-gray-900 border border-white/5 rounded-xl p-3 flex flex-col">
            <span className="text-[10px] text-gray-500 font-bold uppercase mb-1">Start Date</span>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-purple-400" />
              <span className="font-bold text-white text-sm">
                {new Date(tournament.startDate).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>

        {/* Prize Distribution (if paid) */}
        {tournament.prizes && tournament.prizes.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Trophy className="w-5 h-5 text-yellow-500" /> Prize Distribution
            </h2>
            <div className="bg-gray-900 border border-white/5 rounded-xl divide-y divide-white/5">
              {tournament.prizes.map((prize) => (
                <div key={prize.id} className="flex justify-between items-center p-3">
                  <span className="text-gray-300 font-medium">
                    {prize.placement === 1 ? '🥇 1st Place' : prize.placement === 2 ? '🥈 2nd Place' : prize.placement === 3 ? '🥉 3rd Place' : `${prize.placement}th Place`}
                  </span>
                  <span className="font-bold text-white">⭐ {prize.amount}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Rules Summary */}
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Info className="w-5 h-5 text-blue-400" /> Information
          </h2>
          <div className="bg-gray-900 border border-white/5 rounded-xl p-4 text-sm text-gray-300 leading-relaxed">
            {tournament.rules?.content || "Standard VELOX competitive rules apply. All matches must be played fairly. Cheating will result in an immediate ban."}
          </div>
        </section>
      </div>

      {/* Floating Action Button */}
      <div className="fixed bottom-16 left-0 right-0 p-4 bg-gradient-to-t from-black via-black/90 to-transparent pb-6 z-40">
        {tournament.status === 'REGISTRATION_OPEN' ? (
          <Link href={`/tournaments/${tournament.slug}/register`}>
            <Button className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-6 text-lg shadow-[0_0_30px_rgba(147,51,234,0.4)]">
              {tournament.isPaid ? `Join with ⭐ ${tournament.entryFee}` : 'Join Tournament (Free)'}
            </Button>
          </Link>
        ) : (
          <Button disabled className="w-full bg-gray-800 text-gray-500 font-bold py-6 text-lg">
            Registration Closed
          </Button>
        )}
      </div>
    </div>
  );
}
