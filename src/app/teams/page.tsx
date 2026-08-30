import { Shield, Plus, Users, Trophy } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function TeamsPage() {
  // In a real app, fetch teams for the user from the database
  const myTeams = [
    { id: "1", name: "Cyber Knights", members: 4, wins: 12, losses: 3, role: "CAPTAIN" },
    { id: "2", name: "Neon Strikers", members: 5, wins: 8, losses: 7, role: "MEMBER" },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-black p-4 pb-24">
      <header className="mb-6 pt-2 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Teams</h1>
          <p className="text-gray-400 mt-1">Squad up and conquer</p>
        </div>
        <Button className="bg-purple-600 hover:bg-purple-700 text-white rounded-full w-10 h-10 p-0 flex items-center justify-center shadow-lg shadow-purple-900/50">
          <Plus className="w-5 h-5" />
        </Button>
      </header>

      <div className="flex flex-col gap-4">
        {myTeams.length === 0 ? (
          <div className="bg-gray-900 border border-white/5 rounded-2xl p-8 flex flex-col items-center text-center">
            <Shield className="w-12 h-12 text-gray-700 mb-3" />
            <h3 className="text-lg font-bold text-white">No Teams Yet</h3>
            <p className="text-sm text-gray-500 mt-1 mb-4">Create a team or ask a captain for an invite code.</p>
            <Button className="bg-white text-black hover:bg-gray-200 font-bold">Create Team</Button>
          </div>
        ) : (
          myTeams.map(team => (
            <Link key={team.id} href={`/teams/${team.id}`}>
              <div className="bg-gray-900 border border-white/5 rounded-2xl p-4 shadow-lg hover:border-purple-500/30 transition-colors">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-900 to-indigo-900 border border-white/10 flex items-center justify-center shadow-inner">
                      <Shield className="w-6 h-6 text-purple-300" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white leading-tight">{team.name}</h3>
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full mt-1 inline-block ${team.role === 'CAPTAIN' ? 'bg-yellow-500/20 text-yellow-500' : 'bg-blue-500/20 text-blue-400'}`}>
                        {team.role}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 bg-black/50 rounded-xl p-3 border border-white/5">
                  <div className="flex flex-col items-center justify-center">
                    <Users className="w-4 h-4 text-gray-400 mb-1" />
                    <span className="font-bold text-white text-sm">{team.members}</span>
                    <span className="text-[9px] text-gray-500 uppercase font-bold">Members</span>
                  </div>
                  <div className="flex flex-col items-center justify-center border-x border-white/10">
                    <Trophy className="w-4 h-4 text-green-400 mb-1" />
                    <span className="font-bold text-white text-sm">{team.wins}</span>
                    <span className="text-[9px] text-gray-500 uppercase font-bold">Wins</span>
                  </div>
                  <div className="flex flex-col items-center justify-center">
                    <Shield className="w-4 h-4 text-red-400 mb-1" />
                    <span className="font-bold text-white text-sm">{team.losses}</span>
                    <span className="text-[9px] text-gray-500 uppercase font-bold">Losses</span>
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
