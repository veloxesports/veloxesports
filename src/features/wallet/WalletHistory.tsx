"use client";

import { useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, CheckCircle2, ChevronRight, Clock, XCircle } from "lucide-react";
import Link from "next/link";

type Transaction = {
  id: string;
  amount: number;
  type: string;
  status: string;
  createdAt: Date;
  tournament: { title: string } | null;
};

const filters = [
  { id: "all", label: "All Records" },
  { id: "reward", label: "Rewards ⭐" },
  { id: "entry", label: "Entry Fees" },
  { id: "refund", label: "Refunds" },
  { id: "payment", label: "Payments" },
  { id: "bonus", label: "Bonuses" },
] as const;

const positiveTypes = new Set(["PRIZE_REWARD", "REFUND", "BONUS", "ADMIN_CREDIT"]);

function filterMatches(type: string, filter: (typeof filters)[number]["id"]) {
  if (filter === "all") return true;
  if (filter === "payment") return type === "STAR_PAYMENT";
  if (filter === "entry") return type === "TOURNAMENT_ENTRY";
  if (filter === "reward") return type === "PRIZE_REWARD";
  if (filter === "refund") return type === "REFUND";
  return type === "BONUS";
}

export function WalletHistory({ transactions }: { transactions: Transaction[] }) {
  const [filter, setFilter] = useState<(typeof filters)[number]["id"]>("all");
  const visible = useMemo(
    () => transactions.filter((transaction) => filterMatches(transaction.type, filter)),
    [filter, transactions]
  );

  return (
    <section className="mt-7">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xs font-black uppercase tracking-[0.14em] text-[#8e9f8f]">
          Transaction Activity
        </h2>
        <span className="text-[11px] font-bold text-[#718272]">{visible.length} records</span>
      </div>

      {/* Filter Chips */}
      <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
        {filters.map((item) => {
          const isActive = filter === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setFilter(item.id)}
              className={`whitespace-nowrap rounded-xl px-3 py-1.5 text-xs font-black transition ${
                isActive
                  ? "bg-[#c5f94d] text-[#090d09] shadow-[0_0_10px_rgba(197,249,77,0.3)]"
                  : "border border-[#223023] bg-[#0e1610] text-[#849485] hover:text-white"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {/* Transaction List */}
      {visible.length === 0 ? (
        <div className="mt-3 rounded-2xl border border-[#233124] bg-[#0c130e] p-8 text-center">
          <p className="text-sm font-black text-white">No transactions found</p>
          <p className="mt-1 text-xs text-[#7e8e7f]">
            Activity matching this filter will show up here.
          </p>
        </div>
      ) : (
        <div className="mt-3 flex flex-col gap-2.5">
          {visible.map((transaction) => {
            const positive = positiveTypes.has(transaction.type);
            const title =
              transaction.tournament?.title ??
              (transaction.type === "PRIZE_REWARD"
                ? "Tournament Prize Reward"
                : transaction.type === "TOURNAMENT_ENTRY"
                ? "Tournament Entry Fee"
                : transaction.type === "REFUND"
                ? "Capacity Entry Refund"
                : transaction.type.replaceAll("_", " "));

            return (
              <Link
                key={transaction.id}
                href={`/wallet/transactions/${transaction.id}`}
                className="group flex items-center justify-between gap-3 rounded-2xl border border-[#233124] bg-[#0e1610] p-3.5 transition duration-150 hover:border-[#3e5934] hover:bg-[#121c13] shadow-[0_4px_16px_rgba(0,0,0,0.3)]"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border ${
                      positive
                        ? "border-[#2b4429] bg-[#162717] text-[#c5f94d]"
                        : "border-[#28362a] bg-[#141b15] text-[#8ea090]"
                    }`}
                  >
                    {positive ? (
                      <ArrowUpRight className="h-5 w-5" aria-hidden />
                    ) : (
                      <ArrowDownRight className="h-5 w-5" aria-hidden />
                    )}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-black text-white group-hover:text-[#c5f94d] transition-colors">
                      {title}
                    </p>
                    <div className="mt-0.5 flex items-center gap-1.5 text-[10px] font-semibold text-[#7c8e7e]">
                      <StatusIcon status={transaction.status} />
                      <span>{new Date(transaction.createdAt).toLocaleDateString()}</span>
                      <span>·</span>
                      <span className="uppercase">{transaction.status}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-right">
                  <span
                    className={`shrink-0 text-sm font-black ${
                      positive ? "text-[#c5f94d]" : "text-white"
                    }`}
                  >
                    {positive ? "+" : "-"} ⭐ {transaction.amount.toLocaleString()}
                  </span>
                  <ChevronRight className="h-4 w-4 text-[#556756] group-hover:text-[#c5f94d] group-hover:translate-x-0.5 transition-all" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}

function StatusIcon({ status }: { status: string }) {
  if (status === "COMPLETED")
    return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" aria-hidden />;
  if (["FAILED", "CANCELLED", "REVERSED"].includes(status))
    return <XCircle className="h-3.5 w-3.5 text-red-400" aria-hidden />;
  return <Clock className="h-3.5 w-3.5 text-amber-300" aria-hidden />;
}

