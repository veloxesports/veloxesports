"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, CircleAlert, Landmark, ReceiptText, Search, WalletCards } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { refundStarsPayment } from "@/features/payments/actions";
import { AdminConfirmModal } from "@/components/admin/AdminConfirmModal";

type Payment = {
  id: string;
  amount: number;
  status: string;
  createdAt: Date;
  telegramPaymentRef: string | null;
  user: { telegramId: string; username: string | null; firstName: string | null };
  tournament: { title: string } | null;
  refund: { status: string } | null;
};
type FinanceData = { payments: Payment[]; totalPayments: number; totalRefunds: number };

const controlClass = "w-full rounded-2xl border border-[#344335] bg-[#080d09] px-3.5 py-3 text-sm text-white outline-none transition placeholder:text-[#6f796f] focus:border-[#c5f94d] focus:ring-2 focus:ring-[#c5f94d]/15";

export function FinanceClient({ initialData }: { initialData: FinanceData }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [confirmPaymentId, setConfirmPaymentId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const payments = useMemo(() => initialData.payments.filter((payment) => {
    const matchesStatus = status === "all" || payment.status === status;
    const searchable = `${payment.id} ${payment.telegramPaymentRef ?? ""} ${payment.user.telegramId} ${payment.user.username ?? ""} ${payment.user.firstName ?? ""} ${payment.tournament?.title ?? ""}`.toLowerCase();
    return matchesStatus && (!query.trim() || searchable.includes(query.trim().toLowerCase()));
  }), [initialData.payments, query, status]);

  async function refund(paymentId: string) {
    setPendingId(paymentId);
    setConfirmPaymentId(null);
    const result = await refundStarsPayment(paymentId);
    setPendingId(null);
    setMessage(result.success ? "Refund completed and the ledger has been updated." : result.error ?? "Refund failed.");
    if (result.success) router.refresh();
  }

  return (
    <main className="velox-page">
      <header className="flex items-start gap-3">
        <Link href="/admin" className="velox-muted-button flex h-10 w-10 shrink-0 p-0" aria-label="Back to Command Center"><ChevronLeft className="h-5 w-5" aria-hidden /></Link>
        <div>
          <p className="velox-eyebrow">Revenue operations</p>
          <h1 className="mt-1 text-2xl font-black tracking-[-0.04em] text-white sm:text-3xl">Finance desk</h1>
          <p className="mt-1 text-sm leading-relaxed text-[#8e998f]">Verified Telegram Stars activity, refunds, and payment reconciliation.</p>
        </div>
      </header>

      <section className="mt-6 grid gap-3 sm:grid-cols-2">
        <Summary icon={<Landmark className="h-5 w-5" aria-hidden />} label="Verified Stars" amount={initialData.totalPayments} detail="Completed Telegram payments" />
        <Summary icon={<WalletCards className="h-5 w-5" aria-hidden />} label="Refunded Stars" amount={initialData.totalRefunds} detail="Completed player refunds" warning={initialData.totalRefunds > 0} />
      </section>

      <section className="velox-card mt-6 p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row">
          <label className="relative flex-1"><span className="sr-only">Search payments</span><Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#c5f94d]" aria-hidden /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search player, reference, tournament or payment ID" className={`${controlClass} pl-10`} /></label>
          <select aria-label="Filter payment status" value={status} onChange={(event) => setStatus(event.target.value)} className={`${controlClass} sm:w-44`}><option value="all">All statuses</option><option value="PENDING">Pending</option><option value="COMPLETED">Completed</option><option value="REFUNDED">Refunded</option><option value="FAILED">Failed</option></select>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-[#718071]">Payment records come from verified Telegram events. No administrator can manually mark a payment as completed.</p>
      </section>

      {message && <Notice message={message} />}

      <section className="mt-7">
        <div className="flex items-end justify-between gap-3"><div><p className="velox-eyebrow">Ledger</p><h2 className="mt-1 text-xl font-black text-white">Payment activity</h2></div><p className="text-xs font-bold uppercase tracking-[0.08em] text-[#8e998f]">{payments.length} record{payments.length === 1 ? "" : "s"}</p></div>
        <div className="mt-3 grid gap-3 2xl:grid-cols-2">
          {payments.length === 0 ? <div className="velox-card"><Empty /></div> : payments.map((payment) => {
            const player = payment.user.username ?? payment.user.firstName ?? `Telegram ${payment.user.telegramId}`;
            return (
              <article key={payment.id} className="velox-card p-5">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#1f3119] text-[#c5f94d]"><ReceiptText className="h-5 w-5" aria-hidden /></span>
                  <div className="min-w-0 flex-1"><p className="truncate text-base font-black text-white">{payment.tournament?.title ?? "Khemora transaction"}</p><p className="mt-1 truncate text-sm text-[#8e998f]">{player}</p></div>
                  <div className="shrink-0 text-right"><p className="text-lg font-black text-white">⭐ {payment.amount.toLocaleString()}</p><StatusBadge value={payment.status} /></div>
                </div>
                <div className="mt-4 grid gap-2 border-y border-[#29342a] py-3 text-xs sm:grid-cols-2">
                  <p className="truncate text-[#8e998f]"><span className="font-bold uppercase tracking-[0.08em] text-[#718071]">Reference </span><span className="font-mono text-[#b7c2b5]">{payment.telegramPaymentRef ?? payment.id}</span></p>
                  <p className="text-[#8e998f] sm:text-right"><span className="font-bold uppercase tracking-[0.08em] text-[#718071]">Received </span>{formatDate(payment.createdAt)}</p>
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap gap-2">{payment.refund && <span className="rounded-full bg-[#2a2520] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-[#f0ca8b]">Refund {labelFor(payment.refund.status)}</span>}</div>
                  {payment.status === "COMPLETED" && payment.refund?.status !== "COMPLETED" ? <button type="button" onClick={() => setConfirmPaymentId(payment.id)} disabled={pendingId === payment.id} className="rounded-2xl border border-[#75453b] bg-[#2a1918] px-3.5 py-2.5 text-xs font-black text-[#ffad9a] transition hover:border-[#b9624f] hover:bg-[#3a211e] disabled:cursor-not-allowed disabled:opacity-50">{pendingId === payment.id ? "Processing refund…" : payment.refund?.status === "FAILED" ? "Retry failed refund" : "Refund Telegram Stars"}</button> : <span className="text-xs font-medium text-[#718071]">{payment.refund?.status === "COMPLETED" ? "Refund completed" : "No action available"}</span>}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {confirmPaymentId && (
        <AdminConfirmModal
          isOpen={Boolean(confirmPaymentId)}
          title="Refund Telegram Stars"
          message="Are you sure you want to refund this Telegram Stars payment? This sends the refund through Telegram and updates the permanent platform ledger. This cannot be undone."
          confirmLabel="Issue Refund"
          variant="danger"
          pending={pendingId === confirmPaymentId}
          onConfirm={() => refund(confirmPaymentId)}
          onClose={() => setConfirmPaymentId(null)}
        />
      )}
    </main>
  );
}

function Summary({ icon, label, amount, detail, warning = false }: { icon: React.ReactNode; label: string; amount: number; detail: string; warning?: boolean }) {
  return <div className="velox-card p-5"><span className={`flex h-10 w-10 items-center justify-center rounded-xl ${warning ? "bg-[#3b2c1d] text-[#f0ca8b]" : "bg-[#1f3119] text-[#c5f94d]"}`}>{icon}</span><p className="mt-4 text-[11px] font-black uppercase tracking-[0.1em] text-[#c3ceb9]">{label}</p><p className="mt-1 text-2xl font-black tracking-[-0.04em] text-white">⭐ {amount.toLocaleString()}</p><p className="mt-1 text-xs text-[#718071]">{detail}</p></div>;
}

function StatusBadge({ value }: { value: string }) {
  const styles: Record<string, string> = { COMPLETED: "bg-[#20331b] text-[#c5f94d]", PENDING: "bg-[#392f1c] text-[#f0cf78]", REFUNDED: "bg-[#1c3134] text-[#8ee7ec]", FAILED: "bg-[#3b211e] text-[#ffad9a]" };
  return <span className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em] ${styles[value] ?? "bg-[#242b25] text-[#a4aea3]"}`}>{labelFor(value)}</span>;
}

function Notice({ message }: { message: string }) {
  const isSuccess = message.startsWith("Refund completed");
  return <p role="status" className={`mt-4 flex items-start gap-2 rounded-2xl border px-4 py-3 text-sm font-medium ${isSuccess ? "border-[#496b38] bg-[#182716] text-[#d8f5b3]" : "border-[#87493d] bg-[#2b1d19] text-[#ffb1a0]"}`}><CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />{message}</p>;
}

function Empty() {
  return <div className="px-5 py-12 text-center"><ReceiptText className="mx-auto h-9 w-9 text-[#526052]" aria-hidden /><p className="mt-3 font-black text-white">No matching payments</p><p className="mt-1 text-sm text-[#8e998f]">Try a different status or search term.</p></div>;
}

function labelFor(value: string) {
  return value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}
