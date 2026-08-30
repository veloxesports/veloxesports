import { getWalletSummary } from "@/features/wallet/services";
import { Wallet as WalletIcon } from "lucide-react";
import { WalletHistory } from "@/features/wallet/WalletHistory";

export default async function WalletPage() {
  const res = await getWalletSummary();

  if (!res.success || !res.data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-black p-4 text-center">
        <WalletIcon className="w-16 h-16 text-gray-700 mb-4" />
        <h1 className="text-xl font-bold text-white mb-2">Wallet Unavailable</h1>
        <p className="text-gray-500">We couldn&apos;t load your wallet data. Please try again later.</p>
      </div>
    );
  }

  const { wallet, transactions } = res.data;

  return (
    <div className="flex flex-col min-h-screen bg-black p-4 pb-24">
      <header className="mb-6 pt-2">
        <h1 className="text-3xl font-bold text-white tracking-tight">VELOX Wallet</h1>
        <p className="text-gray-400 mt-1">Manage your Telegram Stars</p>
      </header>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3 mb-8">
        <div className="bg-gradient-to-br from-gray-900 to-black border border-white/10 rounded-2xl p-4 shadow-lg flex flex-col gap-2">
          <span className="text-xs text-gray-500 font-bold uppercase tracking-wider">Total Spent</span>
          <span className="text-2xl font-black text-white flex items-center gap-1">
            <span className="text-yellow-500 text-lg">⭐</span> {wallet.totalSpent}
          </span>
        </div>
        
        <div className="bg-gradient-to-br from-purple-900/20 to-black border border-purple-500/20 rounded-2xl p-4 shadow-lg flex flex-col gap-2">
          <span className="text-xs text-purple-400 font-bold uppercase tracking-wider">Rewards</span>
          <span className="text-2xl font-black text-white flex items-center gap-1">
            <span className="text-yellow-500 text-lg">⭐</span> {wallet.totalRewards}
          </span>
        </div>

        <div className="col-span-2 bg-gray-900/50 border border-white/5 rounded-2xl p-4 flex justify-between items-center">
          <span className="text-sm text-gray-400 font-medium">Total Refunds</span>
          <span className="font-bold text-blue-400 flex items-center gap-1">
            ⭐ {wallet.totalRefunds}
          </span>
        </div>
      </div>

      <WalletHistory transactions={transactions} />
    </div>
  );
}
