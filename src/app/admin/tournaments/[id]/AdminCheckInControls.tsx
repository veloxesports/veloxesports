"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, CircleAlert, Clock3, LockKeyhole, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { finalizeTournamentCheckIn, openTournamentCheckIn } from "@/features/admin/actions";

export function AdminCheckInControls({
  tournamentId,
  status,
  startDate,
  checkInPeriodMins,
  checkedInCount,
  confirmedCount,
}: {
  tournamentId: string;
  status: string;
  startDate: Date;
  checkInPeriodMins: number;
  checkedInCount: number;
  confirmedCount: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const now = new Date();
  const opensAt = new Date(new Date(startDate).getTime() - checkInPeriodMins * 60_000);
  const closesAt = new Date(startDate);
  const canLockNoShows = now >= closesAt;

  const perform = (action: "open" | "lock") => {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      if (action === "open") {
        const result = await openTournamentCheckIn(tournamentId);
        if (!result.success) {
          setError(result.error ?? "Tournament check-in could not be updated.");
          return;
        }
        setMessage("Check-in is open and confirmed players have been notified.");
      } else {
        const result = await finalizeTournamentCheckIn(tournamentId);
        if (!result.success || !("data" in result) || !result.data) {
          setError(result.error ?? "Tournament check-in could not be updated.");
          return;
        }
        setMessage(`${result.data.checkedInCount} checked in; ${result.data.noShowCount} no-shows locked.${result.data.bracketGenerated ? " Bracket generated." : ""}`);
      }
      router.refresh();
    });
  };

  if (status !== "REGISTRATION_CLOSED" && status !== "CHECK_IN") return null;

  return (
    <section className="velox-card mt-6 overflow-hidden border-[#496b38]">
      <div className="border-b border-[#354631] bg-[radial-gradient(circle_at_90%_0%,rgba(197,249,77,0.14),transparent_38%)] px-5 py-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="velox-eyebrow">Attendance control</p>
            <h2 className="mt-1 text-xl font-black text-white">Tournament check-in</h2>
          </div>
          <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em] ${status === "CHECK_IN" ? "bg-[#392f1c] text-[#f0cf78]" : "bg-[#242b25] text-[#a4aea3]"}`}>{status === "CHECK_IN" ? "Open" : "Ready to open"}</span>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-[#aeb8ad]">{status === "CHECK_IN" ? `Players can check in until ${formatDateTime(closesAt)}.` : `The ${checkInPeriodMins}-minute window opens ${formatDateTime(opensAt)}.`}</p>
      </div>
      <div className="p-5">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-[#334233] bg-[#101710] p-3"><span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.08em] text-[#8e998f]"><CheckCircle2 className="h-3.5 w-3.5 text-[#c5f94d]" aria-hidden />Checked in</span><p className="mt-2 text-2xl font-black text-white">{checkedInCount}</p></div>
          <div className="rounded-2xl border border-[#334233] bg-[#101710] p-3"><span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.08em] text-[#8e998f]"><Users className="h-3.5 w-3.5 text-[#c5f94d]" aria-hidden />Awaiting</span><p className="mt-2 text-2xl font-black text-white">{Math.max(0, confirmedCount - checkedInCount)}</p></div>
        </div>
        {error && <p role="alert" className="mt-4 flex items-start gap-2 rounded-xl border border-[#87493d] bg-[#2b1d19] px-3 py-2.5 text-sm text-[#ffb1a0]"><CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />{error}</p>}
        {message && <p role="status" className="mt-4 flex items-start gap-2 rounded-xl border border-[#496b38] bg-[#182716] px-3 py-2.5 text-sm text-[#d8f5b3]"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />{message}</p>}
        {status === "REGISTRATION_CLOSED" ? <button type="button" onClick={() => perform("open")} disabled={pending} className="velox-action mt-4 w-full disabled:cursor-not-allowed disabled:opacity-50"><Clock3 className="mr-2 h-4 w-4" aria-hidden />{pending ? "Opening check-in…" : "Open check-in"}</button> : <button type="button" onClick={() => perform("lock")} disabled={pending || !canLockNoShows} className="velox-action mt-4 w-full disabled:cursor-not-allowed disabled:opacity-45"><LockKeyhole className="mr-2 h-4 w-4" aria-hidden />{pending ? "Locking attendance…" : "Lock no-shows"}</button>}
        {status === "CHECK_IN" && !canLockNoShows && <p className="mt-3 text-center text-xs leading-relaxed text-[#8e998f]">No-shows can be locked after check-in closes at {formatDateTime(closesAt)}.</p>}
      </div>
    </section>
  );
}

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(value);
}
