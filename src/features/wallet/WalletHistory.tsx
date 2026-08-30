"use client";

import { useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, CheckCircle2, Clock, XCircle } from "lucide-react";
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
  { id: "all", label: "All" },
  { id: "payment", label: "Payments" },
  { id: "entry", label: "Entry fees" },
  { id: "reward", label: "Rewards" },
  { id: "refund", label: "Refunds" },
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
  const visible = useMemo(() => transactions.filter((transaction) => filterMatches(transaction.type, filter)), [filter, transactions]);

  return <section className="mt-8"><div className="flex items-center justify-between gap-3"><h2 className="text-lg font-bold text-white">Transaction history</h2><span className="text-xs text-slate-500">{visible.length} records</span></div><div className="mt-3 flex gap-2 overflow-x-auto pb-2">{filters.map((item) => <button key={item.id} onClick={() => setFilter(item.id)} className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-bold ${filter === item.id ? "bg-violet-600 text-white" : "border border-white/10 bg-slate-900 text-slate-300 hover:bg-slate-800"}`}>{item.label}</button>)}</div>{visible.length === 0 ? <div className="mt-3 rounded-2xl border border-white/5 bg-slate-900 p-8 text-center"><p className="font-bold text-slate-300">No matching transactions</p><p className="mt-1 text-sm text-slate-500">Your verified tournament activity will appear here.</p></div> : <div className="mt-3 flex flex-col gap-3">{visible.map((transaction) => { const positive = positiveTypes.has(transaction.type); return <Link key={transaction.id} href={`/wallet/transactions/${transaction.id}`} className="flex items-center justify-between rounded-xl border border-white/5 bg-slate-900 p-4 transition hover:border-violet-400/40"><div className="flex min-w-0 items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/5 bg-black">{positive ? <ArrowUpRight className="h-5 w-5 text-emerald-300" aria-hidden /> : <ArrowDownRight className="h-5 w-5 text-red-300" aria-hidden />}</span><span className="min-w-0"><span className="block truncate text-sm font-bold text-white">{transaction.tournament?.title ?? transaction.type.replaceAll("_", " ")}</span><span className="mt-0.5 flex items-center gap-1 text-xs text-slate-500"><StatusIcon status={transaction.status} />{new Date(transaction.createdAt).toLocaleDateString()} · {transaction.status}</span></span></div><span className={`shrink-0 font-bold ${positive ? "text-emerald-300" : "text-white"}`}>{positive ? "+" : "-"} ⭐ {transaction.amount}</span></Link>; })}</div>}</section>;
}

function StatusIcon({ status }: { status: string }) { if (status === "COMPLETED") return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" aria-hidden />; if (["FAILED", "CANCELLED", "REVERSED"].includes(status)) return <XCircle className="h-3.5 w-3.5 text-red-400" aria-hidden />; return <Clock className="h-3.5 w-3.5 text-amber-300" aria-hidden />; }
