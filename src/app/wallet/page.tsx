import { getWalletSummary } from "@/features/wallet/services";
import { WalletHistory } from "@/features/wallet/WalletHistory";
import { TelegramAccessRequired } from "@/components/auth/TelegramAccessRequired";

export default async function WalletPage() {
  const res = await getWalletSummary();

  if (!res.success || !res.data) {
    return <TelegramAccessRequired title="Wallet needs Telegram" message={res.error ?? "Open VELOX in Telegram to view your Stars activity."} />;
  }

  const { wallet, transactions } = res.data;

  return (
    <div className="velox-page">
      <header className="mb-6 pt-2">
        <p className="velox-eyebrow">Tournament economy</p><h1 className="mt-2 text-4xl font-black text-white tracking-[-0.05em]">VELOX Wallet</h1>
        <p className="text-gray-400 mt-1">Manage your Telegram Stars</p>
      </header>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3 mb-8">
        <div className="velox-card p-4 flex flex-col gap-2">
          <span className="text-xs text-gray-500 font-bold uppercase tracking-wider">Total Spent</span>
          <span className="text-2xl font-black text-white flex items-center gap-1">
            <span className="text-yellow-500 text-lg">⭐</span> {wallet.totalSpent}
          </span>
        </div>
        
        <div className="rounded-2xl border border-[#45613a] bg-[#182715] p-4 shadow-lg flex flex-col gap-2">
          <span className="text-xs text-[#c5f94d] font-bold uppercase tracking-wider">Rewards</span>
          <span className="text-2xl font-black text-white flex items-center gap-1">
            <span className="text-yellow-500 text-lg">⭐</span> {wallet.totalRewards}
          </span>
        </div>

        <div className="col-span-2 velox-card p-4 flex justify-between items-center">
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
