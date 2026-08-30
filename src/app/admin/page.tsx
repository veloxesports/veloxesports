import { getAdminStats } from "@/features/admin/actions";
import { Users, ShieldAlert, Trophy, Activity, ArrowUpRight, ArrowDownRight } from "lucide-react";
import Link from "next/link";

export default async function AdminDashboard() {
  const res = await getAdminStats();
  
  if (!res.success || !res.data) {
    return <div className="p-8 text-center text-red-500">Failed to load admin dashboard.</div>;
  }

  const { totalUsers, activeTournaments, pendingDisputes, recentTransactions } = res.data;

  return (
    <div className="flex flex-col min-h-screen bg-black p-4 pb-24 text-gray-100">
      <header className="mb-6 pt-2">
        <h1 className="text-3xl font-bold text-white tracking-tight">Command Center</h1>
        <p className="text-gray-400 mt-1">VELOX Platform Administration</p>
      </header>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-gray-900 border border-white/5 rounded-2xl p-4 flex flex-col gap-2">
          <div className="flex justify-between items-start">
            <span className="text-xs text-gray-500 font-bold uppercase">Total Users</span>
            <Users className="w-4 h-4 text-blue-400" />
          </div>
          <span className="text-2xl font-black text-white">{totalUsers}</span>
        </div>

        <div className="bg-gray-900 border border-white/5 rounded-2xl p-4 flex flex-col gap-2">
          <div className="flex justify-between items-start">
            <span className="text-xs text-gray-500 font-bold uppercase">Active Tournaments</span>
            <Trophy className="w-4 h-4 text-yellow-500" />
          </div>
          <span className="text-2xl font-black text-white">{activeTournaments}</span>
        </div>

        <div className="bg-red-900/20 border border-red-500/20 rounded-2xl p-4 flex flex-col gap-2 col-span-2">
          <div className="flex justify-between items-start">
            <span className="text-xs text-red-400 font-bold uppercase">Pending Disputes</span>
            <ShieldAlert className="w-4 h-4 text-red-500" />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-2xl font-black text-red-500">{pendingDisputes}</span>
            <button className="text-xs bg-red-500 text-white font-bold px-3 py-1.5 rounded-full hover:bg-red-600 transition-colors">
              Resolve Now
            </button>
          </div>
        </div>
      </div>

      {/* Recent Financial Activity */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-green-400" /> Financial Activity
          </h2>
          <Link href="/admin/finance" className="text-xs text-purple-400 hover:text-purple-300 font-bold">
            View All
          </Link>
        </div>
        
        <div className="bg-gray-900 border border-white/5 rounded-xl divide-y divide-white/5">
          {recentTransactions.length === 0 ? (
            <div className="p-4 text-center text-sm text-gray-500">No recent transactions.</div>
          ) : (
            recentTransactions.map((tx) => (
              <div key={tx.id} className="flex justify-between items-center p-3">
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-white truncate max-w-[150px]">
                    {tx.wallet.user.firstName || 'User'}
                  </span>
                  <span className="text-[10px] text-gray-500 uppercase font-bold">{tx.type.replace('_', ' ')}</span>
                </div>
                <div className={`font-bold flex items-center gap-1 ${['PRIZE_REWARD', 'REFUND'].includes(tx.type) ? 'text-red-400' : 'text-green-400'}`}>
                  {['PRIZE_REWARD', 'REFUND'].includes(tx.type) ? <ArrowDownRight className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
                  ⭐ {tx.amount}
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
