import { getWalletSummary } from "@/features/wallet/services";
import { Wallet as WalletIcon, ArrowDownRight, ArrowUpRight, CheckCircle2, XCircle, Clock } from "lucide-react";

export default async function WalletPage() {
  // Mock user for now
  const mockUserId = "mock-user-id";
  const res = await getWalletSummary(mockUserId);

  if (!res.success || !res.data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-black p-4 text-center">
        <WalletIcon className="w-16 h-16 text-gray-700 mb-4" />
        <h1 className="text-xl font-bold text-white mb-2">Wallet Unavailable</h1>
        <p className="text-gray-500">We couldn't load your wallet data. Please try again later.</p>
      </div>
    );
  }

  const { wallet, transactions } = res.data;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED': return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'FAILED':
      case 'CANCELLED': return <XCircle className="w-4 h-4 text-red-500" />;
      default: return <Clock className="w-4 h-4 text-yellow-500" />;
    }
  };

  const getTransactionFormat = (type: string, amount: number) => {
    const isPositive = ['PRIZE_REWARD', 'REFUND', 'BONUS', 'ADMIN_CREDIT'].includes(type);
    return {
      color: isPositive ? 'text-green-400' : 'text-white',
      sign: isPositive ? '+' : '-',
      icon: isPositive ? <ArrowUpRight className="w-5 h-5 text-green-400" /> : <ArrowDownRight className="w-5 h-5 text-red-400" />
    };
  };

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

      {/* Transaction History */}
      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-bold text-white">Transaction History</h2>
        
        {transactions.length === 0 ? (
          <div className="bg-gray-900 border border-white/5 rounded-2xl p-8 flex flex-col items-center justify-center text-center">
            <WalletIcon className="w-12 h-12 text-gray-700 mb-3" />
            <h3 className="text-lg font-bold text-gray-300">No Transactions</h3>
            <p className="text-sm text-gray-500 mt-1">Your transaction history will appear here.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {transactions.map((tx) => {
              const fmt = getTransactionFormat(tx.type, tx.amount);
              return (
                <div key={tx.id} className="bg-gray-900 border border-white/5 rounded-xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-black flex items-center justify-center border border-white/5">
                      {fmt.icon}
                    </div>
                    <div className="flex flex-col">
                      <span className="font-bold text-white text-sm">
                        {tx.tournament?.title || tx.type.replace('_', ' ')}
                      </span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-gray-500">
                          {new Date(tx.createdAt).toLocaleDateString()}
                        </span>
                        <div className="flex items-center gap-1 text-[10px] text-gray-400 bg-black px-1.5 py-0.5 rounded border border-white/5">
                          {getStatusIcon(tx.status)} {tx.status}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex flex-col items-end">
                    <span className={`font-bold ${fmt.color}`}>
                      {fmt.sign} ⭐ {tx.amount}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
