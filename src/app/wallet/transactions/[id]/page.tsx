import { ChevronLeft, ReceiptText, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { getWalletTransaction } from "@/features/wallet/services";

export default async function TransactionDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await getWalletTransaction(id);

  if (!result.success || !result.data) {
    return (
      <main className="velox-page flex min-h-[70vh] flex-col items-center justify-center text-center">
        <ReceiptText className="h-14 w-14 text-[#445545]" aria-hidden />
        <h1 className="mt-4 text-2xl font-black text-white">Transaction unavailable</h1>
        <p className="mt-2 max-w-sm text-sm text-[#8e998f]">
          {result.error ?? "We couldn't load this ledger transaction."}
        </p>
        <Link href="/wallet" className="velox-action mt-6 text-xs font-black">
          Back to Wallet
        </Link>
      </main>
    );
  }

  const transaction = result.data;
  const positive = ["PRIZE_REWARD", "REFUND", "BONUS", "ADMIN_CREDIT"].includes(transaction.type);
  const formattedRef = `#TX-${transaction.id.slice(0, 8).toUpperCase()}`;

  return (
    <main className="velox-page">
      {/* Header */}
      <header className="flex items-center gap-3">
        <Link
          href="/wallet"
          className="velox-muted-button flex h-10 w-10 shrink-0 p-0"
          aria-label="Back to wallet"
        >
          <ChevronLeft className="h-5 w-5" aria-hidden />
        </Link>
        <div>
          <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[#c5f94d]">
            Ledger Receipt
          </span>
          <h1 className="text-xl font-black tracking-[-0.03em] text-white sm:text-2xl">
            Transaction Details
          </h1>
        </div>
      </header>

      {/* Hero Receipt Card */}
      <section className="velox-card relative mt-6 overflow-hidden p-6 text-center shadow-[0_16px_45px_rgba(0,0,0,0.35)]">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#182618] border border-[#2d402e] px-3 py-1 text-[10px] font-black uppercase tracking-wider text-[#c5f94d]">
          <ShieldCheck className="h-3.5 w-3.5" />
          Verified Ledger Entry
        </span>

        <p className="mt-4 text-xs font-bold uppercase tracking-wider text-[#829683]">
          {transaction.type.replaceAll("_", " ")}
        </p>

        <p
          className={`mt-2 text-4xl font-black tracking-tight ${
            positive ? "text-[#c5f94d]" : "text-white"
          }`}
        >
          {positive ? "+" : "-"} ⭐ {transaction.amount.toLocaleString()}
        </p>

        <div className="mt-3 flex items-center justify-center gap-2">
          <span className="rounded-full bg-[#172318] px-3 py-0.5 text-xs font-black uppercase text-[#96ab96]">
            {transaction.status}
          </span>
        </div>
      </section>

      {/* Breakdown Details */}
      <section className="velox-card mt-5 divide-y divide-[#202d21] overflow-hidden">
        {[
          ["Reference", formattedRef],
          ["Tournament", transaction.tournament?.title ?? "Platform Economy"],
          ["Currency", transaction.currency],
          ["Created", new Date(transaction.createdAt).toLocaleString(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })],
          ["Status", transaction.status],
        ].map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-4 p-4 text-xs">
            <span className="font-bold text-[#798d7a] uppercase tracking-wider text-[11px]">{label}</span>
            <span className="text-right font-black text-white">{value}</span>
          </div>
        ))}
      </section>

      {transaction.description && (
        <section className="velox-card mt-4 p-4 text-xs text-[#8e9f8e]">
          <p className="font-bold uppercase tracking-wider text-[#6b7d6c] text-[10px] mb-1">
            Note
          </p>
          <p>{transaction.description}</p>
        </section>
      )}

      <div className="mt-6">
        <Link href="/wallet" className="velox-muted-button w-full text-center">
          Return to Wallet
        </Link>
      </div>
    </main>
  );
}
