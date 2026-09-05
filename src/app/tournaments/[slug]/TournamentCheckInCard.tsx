"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, CircleAlert, Clock3, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { checkInForTournament } from "@/features/tournaments/actions";

type CheckInState = {
  status: string;
  opensAt: Date;
  closesAt: Date;
  phase: "NOT_STARTED" | "OPEN" | "CLOSED";
  canCheckIn: boolean;
  requiresTelegram: boolean;
  registration: { id: string; checkedIn: boolean; teamName: string | null } | null;
};

export function TournamentCheckInCard({ tournamentId, state }: { tournamentId: string; state: CheckInState | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCheckIn = () => {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await checkInForTournament(tournamentId);
      if (!result.success) {
        setError(result.error ?? "We couldn't complete your check-in.");
        return;
      }
      setMessage(result.data?.alreadyCheckedIn ? "You are already checked in." : result.data?.teamName ? `${result.data.teamName} is checked in and ready.` : "You are checked in and ready to compete.");
      router.refresh();
    });
  };

  if (!state) return null;

  const scope = state.registration?.teamName ? `Team ${state.registration.teamName}` : "Your entry";
  const closingLabel = formatDateTime(state.closesAt);
  const openingLabel = formatDateTime(state.opensAt);
  const isCheckedIn = Boolean(state.registration?.checkedIn);
  const unavailableMessage = state.requiresTelegram
    ? "Open Khemora inside Telegram to verify your registration and check in."
    : !state.registration
      ? "A confirmed tournament registration is required before you can check in."
      : state.phase === "NOT_STARTED"
        ? `Check-in opens ${openingLabel}.`
        : state.phase === "CLOSED"
          ? "The check-in window has closed. Contact the organizer if you need help."
          : "Check-in is currently unavailable.";

  return (
    <section className="velox-card mt-6 overflow-hidden border-[#496b38]">
      <div className="border-b border-[#354631] bg-[radial-gradient(circle_at_90%_0%,rgba(197,249,77,0.16),transparent_38%)] px-5 py-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="velox-eyebrow">Tournament check-in</p>
            <h2 className="mt-1 text-xl font-black text-white">Confirm you&apos;re ready</h2>
          </div>
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em] ${isCheckedIn ? "bg-[#20331b] text-[#c5f94d]" : state.phase === "OPEN" ? "bg-[#392f1c] text-[#f0cf78]" : "bg-[#242b25] text-[#a4aea3]"}`}>{isCheckedIn ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> : <Clock3 className="h-3.5 w-3.5" aria-hidden />}{isCheckedIn ? "Checked in" : state.phase === "OPEN" ? "Open now" : state.phase === "NOT_STARTED" ? "Opens soon" : "Closed"}</span>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-[#aeb8ad]">{isCheckedIn ? `${scope} is confirmed for this tournament.` : `Check in before ${closingLabel} to keep ${state.registration?.teamName ? "your team’s" : "your"} place.`}</p>
      </div>
      <div className="p-5">
        {error && <p role="alert" className="mb-4 flex items-start gap-2 rounded-xl border border-[#87493d] bg-[#2b1d19] px-3 py-2.5 text-sm text-[#ffb1a0]"><CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />{error}</p>}
        {message && <p role="status" className="mb-4 flex items-start gap-2 rounded-xl border border-[#496b38] bg-[#182716] px-3 py-2.5 text-sm text-[#d8f5b3]"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />{message}</p>}
        {isCheckedIn ? <p className="flex items-start gap-3 text-sm leading-relaxed text-[#c9d3c4]"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#203318] text-[#c5f94d]"><ShieldCheck className="h-5 w-5" aria-hidden /></span>Your place is locked in. Keep an eye on the Matches tab for bracket and match updates.</p> : state.canCheckIn ? <button type="button" onClick={handleCheckIn} disabled={pending} className="velox-action w-full disabled:cursor-not-allowed disabled:opacity-50">{pending ? "Checking in…" : state.registration?.teamName ? `Check in ${state.registration.teamName}` : "Check in now"}</button> : <p className="flex items-start gap-3 text-sm leading-relaxed text-[#aeb8ad]"><Clock3 className="mt-0.5 h-5 w-5 shrink-0 text-[#c5f94d]" aria-hidden />{unavailableMessage}</p>}
      </div>
    </section>
  );
}

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}
