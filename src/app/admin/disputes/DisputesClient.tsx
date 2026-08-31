"use client";

import { useState, type FormEvent } from "react";
import { ChevronLeft, CircleAlert, ClipboardCheck, ShieldAlert, Swords } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { resolveDispute } from "@/features/matches/actions";

type Dispute = { id: string; reason: string; createdAt: Date; match: { id: string; tournament: { title: string }; player1Id: string | null; player2Id: string | null; team1Id: string | null; team2Id: string | null } };
const controlClass = "w-full rounded-2xl border border-[#344335] bg-[#080d09] px-3.5 py-3 text-sm text-white outline-none transition placeholder:text-[#6f796f] focus:border-[#c5f94d] focus:ring-2 focus:ring-[#c5f94d]/15 disabled:cursor-not-allowed disabled:opacity-60";

export function DisputesClient({ disputes }: { disputes: Dispute[] }) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function resolve(event: FormEvent<HTMLFormElement>, dispute: Dispute) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const winnerId = String(form.get("winnerId") || "");
    setPending(dispute.id);
    const result = await resolveDispute({
      disputeId: dispute.id,
      resolutionNotes: form.get("notes"),
      winnerId: winnerId || undefined,
      score1: winnerId ? Number(form.get("score1")) : undefined,
      score2: winnerId ? Number(form.get("score2")) : undefined,
    });
    setPending(null);
    setMessage(result.success ? "Dispute resolution recorded in the permanent audit trail." : result.error ?? "Unable to resolve dispute.");
    if (result.success) router.refresh();
  }

  return (
    <main className="velox-page">
      <header className="flex items-start gap-3">
        <Link href="/admin" className="velox-muted-button flex h-10 w-10 shrink-0 p-0" aria-label="Back to Command Center"><ChevronLeft className="h-5 w-5" aria-hidden /></Link>
        <div>
          <p className="velox-eyebrow">Moderator desk</p>
          <h1 className="mt-1 text-2xl font-black tracking-[-0.04em] text-white sm:text-3xl">Dispute review</h1>
          <p className="mt-1 text-sm leading-relaxed text-[#8e998f]">Review the report, record an outcome, and preserve a complete moderator trail.</p>
        </div>
      </header>

      <section className="relative mt-6 overflow-hidden rounded-[28px] border border-[#70433a] bg-[#241817] p-5 sm:p-6">
        <div className="absolute -right-8 -top-12 h-40 w-40 rounded-full border-[28px] border-[#472a25]" aria-hidden />
        <div className="relative flex items-center gap-4"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#482520] text-[#ffad9a]"><ShieldAlert className="h-5 w-5" aria-hidden /></span><div><p className="text-2xl font-black text-white">{disputes.length}</p><p className="text-xs font-black uppercase tracking-[0.1em] text-[#ffb09e]">Open dispute{disputes.length === 1 ? "" : "s"} requiring review</p></div></div>
      </section>

      {message && <Notice message={message} />}

      <section className="mt-7">
        <div><p className="velox-eyebrow">Review queue</p><h2 className="mt-1 text-xl font-black text-white">Open cases</h2></div>
        <div className="mt-3 grid gap-4">
          {disputes.length === 0 ? <div className="velox-card"><Empty /></div> : disputes.map((dispute) => {
            const participants = [dispute.match.player1Id ?? dispute.match.team1Id, dispute.match.player2Id ?? dispute.match.team2Id].filter((id): id is string => Boolean(id));
            return (
              <article key={dispute.id} className="velox-card overflow-hidden">
                <div className="border-b border-[#29342a] bg-[radial-gradient(circle_at_95%_0%,rgba(197,249,77,0.1),transparent_32%)] px-5 py-5">
                  <div className="flex items-start justify-between gap-3"><div><p className="velox-eyebrow">{dispute.match.tournament.title}</p><h3 className="mt-1 text-lg font-black text-white">Match outcome disputed</h3></div><span className="rounded-full bg-[#3b211e] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-[#ffad9a]">Open</span></div>
                  <p className="mt-4 rounded-2xl border border-[#344335] bg-[#0c120d] p-4 text-sm leading-relaxed text-[#dce8d7]">{dispute.reason}</p>
                  <p className="mt-3 text-xs text-[#718071]">Reported {formatDate(dispute.createdAt)}</p>
                </div>
                <form onSubmit={(event) => void resolve(event, dispute)} className="grid gap-4 p-5">
                  <label className="grid gap-2 text-sm font-bold text-[#dce8d7]">Resolution notes<textarea name="notes" required minLength={10} maxLength={1000} rows={4} className={`${controlClass} resize-y`} placeholder="State the evidence reviewed and the rationale for your decision." /></label>
                  <label className="grid gap-2 text-sm font-bold text-[#dce8d7]">Winner <span className="text-xs font-medium text-[#758373]">Optional — close the report without awarding a winner.</span><select name="winnerId" className={controlClass}><option value="">Close without awarding a winner</option>{participants.map((id, index) => <option key={id} value={id}>Participant {index + 1}</option>)}</select></label>
                  <div className="grid grid-cols-2 gap-3"><NumberInput name="score1" label="Score 1" /><NumberInput name="score2" label="Score 2" /></div>
                  <div className="flex flex-col gap-3 border-t border-[#29342a] pt-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs leading-relaxed text-[#718071]">A resolution is stored as an immutable audit event.</p><button type="submit" disabled={pending === dispute.id} className="velox-action shrink-0"><ClipboardCheck className="mr-2 h-4 w-4" aria-hidden />{pending === dispute.id ? "Recording…" : "Record resolution"}</button></div>
                </form>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}

function NumberInput({ name, label }: { name: string; label: string }) {
  return <label className="grid gap-2 text-sm font-bold text-[#dce8d7]">{label}<input name={name} type="number" min="0" inputMode="numeric" placeholder="—" className={controlClass} /></label>;
}

function Notice({ message }: { message: string }) {
  const isSuccess = message.startsWith("Dispute resolution recorded");
  return <p role="status" className={`mt-4 flex items-start gap-2 rounded-2xl border px-4 py-3 text-sm font-medium ${isSuccess ? "border-[#496b38] bg-[#182716] text-[#d8f5b3]" : "border-[#87493d] bg-[#2b1d19] text-[#ffb1a0]"}`}><CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />{message}</p>;
}

function Empty() {
  return <div className="px-5 py-12 text-center"><Swords className="mx-auto h-9 w-9 text-[#526052]" aria-hidden /><p className="mt-3 font-black text-white">The moderator queue is clear</p><p className="mt-1 text-sm text-[#8e998f]">No open match disputes need a decision.</p></div>;
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}
