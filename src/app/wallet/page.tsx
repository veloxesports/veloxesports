import {
  Gift,
  ShieldCheck,
  Trophy,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { getWalletSummary } from "@/features/wallet/services";
import { WalletHistory } from "@/features/wallet/WalletHistory";
import { TelegramAccessRequired } from "@/components/auth/TelegramAccessRequired";

export default async function WalletPage() {
  const res = await getWalletSummary();

  if (!res.success || !res.data) {
    return (
      <TelegramAccessRequired
        title="Wallet needs Telegram"
        message={res.error ?? "Open Khemora in Telegram to view your Stars activity."}
      />
    );
  }

  const { wallet, transactions } = res.data;

  return (
    <main className="velox-page">
      {/* Header */}
      <header>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[#c5f94d]">
            Economy
          </span>
          <span className="text-[10px] text-[#425443]">·</span>
          <span className="rounded-full bg-[#172318] px-2 py-0.5 text-[10px] font-black uppercase text-[#d4ff76]">
            Telegram Stars
          </span>
        </div>
        <h1 className="mt-1 text-3xl font-black tracking-[-0.04em] text-white sm:text-4xl">
          Tournament Wallet
        </h1>
        <p className="mt-1 text-xs text-[#809081]">
          Track your tournament rewards, entry payments, and verified capacity refunds.
        </p>
      </header>

      {/* Hero Gaming Balance Card */}
      <section className="relative mt-6 overflow-hidden rounded-[28px] border border-[#3e5934] bg-gradient-to-br from-[#162914] via-[#0f1b0e] to-[#09110a] p-5 sm:p-6 shadow-[0_16px_50px_rgba(0,0,0,0.4)]">
        {/* Glow backdrop */}
        <div
          className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full border border-[#5f8947]/30 bg-[#25451c]/60 blur-xl"
          aria-hidden
        />

        <div className="relative">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-[#d4ff76]">
              <ShieldCheck className="h-3.5 w-3.5 text-[#c5f94d]" /> Verified Platform Ledger
            </span>
            <span className="rounded-md bg-[#25391e] px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-[#c5f94d]">
              Active
            </span>
          </div>

          <div className="mt-4">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#90a390]">
              Total Tournament Rewards Won
            </p>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-3xl font-black tracking-[-0.05em] text-[#c5f94d] sm:text-4xl">
                ⭐ {wallet.totalRewards.toLocaleString()}
              </span>
              <span className="text-xs font-bold text-[#869a87]">Stars</span>
            </div>
          </div>

          {/* Quick Metrics Inside Hero */}
          <div className="mt-5 grid grid-cols-2 gap-3 border-t border-[#233820] pt-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#798e7a]">
                Entry Fees Spent
              </p>
              <p className="mt-0.5 text-base font-black text-white">
                ⭐ {wallet.totalSpent.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#798e7a]">
                Capacity Refunds
              </p>
              <p className="mt-0.5 text-base font-black text-cyan-300">
                + ⭐ {wallet.totalRefunds.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Quick Action Tiles */}
      <section className="mt-4 grid grid-cols-2 gap-2.5">
        <Link
          href="/tournaments"
          className="group flex items-center gap-3 rounded-2xl border border-[#233124] bg-[#0e1610] p-3.5 transition hover:border-[#3e5934] hover:bg-[#121c13]"
        >
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#172418] text-[#c5f94d] group-hover:scale-105 transition-transform">
            <Trophy className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-black text-white">Join Tournaments</p>
            <p className="text-[10px] font-medium text-[#798a7a]">Win Star prizes</p>
          </div>
        </Link>

        <Link
          href="/referrals"
          className="group flex items-center gap-3 rounded-2xl border border-[#233124] bg-[#0e1610] p-3.5 transition hover:border-[#3e5934] hover:bg-[#121c13]"
        >
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#172418] text-amber-400 group-hover:scale-105 transition-transform">
            <Gift className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-black text-white">Invite Squad</p>
            <p className="text-[10px] font-medium text-[#798a7a]">Referral bonuses</p>
          </div>
        </Link>
      </section>

      {/* Economy Features Bar */}
      <section className="mt-5 rounded-2xl border border-[#1e2c20] bg-[#0b120c] p-4 text-xs text-[#8ca08e]">
        <div className="flex items-center gap-2 font-bold text-white">
          <Zap className="h-4 w-4 text-[#c5f94d]" />
          <span>How Khemora Stars Work</span>
        </div>
        <p className="mt-1.5 text-[11px] leading-relaxed text-[#7c8e7e]">
          Entry fees are paid safely using official Telegram Stars. When a tournament concludes, prize pool rewards are credited to winners directly. If an event is cancelled, automatic capacity refunds are restored to your account ledger.
        </p>
      </section>

      {/* Transaction History Section */}
      <WalletHistory transactions={transactions} />
    </main>
  );
}

