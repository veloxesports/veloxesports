"use client";

import { useState, type FormEvent } from "react";
import { CheckCircle2, ChevronLeft, Clock3, Copy, Gamepad2, ShieldAlert, Upload, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  confirmMatchResult,
  createDispute,
  rejectMatchResult,
  submitMatchResultWithEvidence,
} from "@/features/matches/actions";

type MatchDetails = {
  id: string;
  tournamentTitle: string;
  round: number;
  scheduledTime: Date | null;
  status: string;
  score1: number | null;
  score2: number | null;
  player1: { id: string | null; name: string; discordUsername?: string | null };
  player2: { id: string | null; name: string; discordUsername?: string | null };
  pendingResult: { id: string; submitterId: string; score1: number; score2: number; winnerId: string; comment: string | null } | null;
  canSubmit: boolean;
  canConfirm: boolean;
  canDispute: boolean;
  hasOpenDispute: boolean;
  evidence: Array<{ id: string; fileType: string; createdAt: Date; signedUrl: string | null }>;
};

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export function MatchDetailsClient({ match }: { match: MatchDetails }) {
  const router = useRouter();
  const [score1, setScore1] = useState("");
  const [score2, setScore2] = useState("");
  const [comment, setComment] = useState("");
  const [evidence, setEvidence] = useState<File | null>(null);
  const [disputeReason, setDisputeReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refreshAfter(action: () => Promise<{ success: boolean; error?: string }>, successMessage: string) {
    setIsResolving(true);
    setError(null);
    try {
      const response = await action();
      if (!response.success) {
        setError(response.error ?? "Something went wrong. Please try again.");
        return;
      }
      setMessage(successMessage);
      router.refresh();
    } catch {
      setError("We couldn't complete that action. Check your connection and try again.");
    } finally {
      setIsResolving(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    const firstScore = Number(score1);
    const secondScore = Number(score2);
    if (!Number.isInteger(firstScore) || !Number.isInteger(secondScore) || firstScore < 0 || secondScore < 0) {
      setError("Enter non-negative whole-number scores.");
      return;
    }
    if (firstScore === secondScore) {
      setError("A match result must have a winner.");
      return;
    }
    const winnerId = firstScore > secondScore ? match.player1.id : match.player2.id;
    if (!winnerId) {
      setError("This match does not have two confirmed participants yet.");
      return;
    }
    if (evidence && (!IMAGE_TYPES.has(evidence.type) || evidence.size > 5 * 1024 * 1024)) {
      setError("Evidence must be a JPG, PNG, or WebP image smaller than 5 MB.");
      return;
    }

    const formData = new FormData();
    formData.set("matchId", match.id);
    formData.set("score1", String(firstScore));
    formData.set("score2", String(secondScore));
    formData.set("winnerId", winnerId);
    formData.set("comment", comment.trim());
    if (evidence) formData.set("evidence", evidence);

    setIsSubmitting(true);
    try {
      const response = await submitMatchResultWithEvidence(formData);
      if (!response.success) {
        setError(response.error ?? "We couldn't submit this result. Please try again.");
        return;
      }
      setMessage("Result submitted. Your opponent can now confirm or reject it.");
      router.refresh();
    } catch {
      setError("We couldn't submit this result. Check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDispute(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await refreshAfter(
      () => createDispute({ matchId: match.id, reason: disputeReason }),
      "Dispute opened. A moderator will review it.",
    );
  }

  const displayScore1 = match.pendingResult?.score1 ?? match.score1;
  const displayScore2 = match.pendingResult?.score2 ?? match.score2;

  return (
    <main className="min-h-screen bg-[#080d09] pb-24 text-slate-100">
      <header className="sticky top-0 z-10 flex items-center gap-4 border-b border-[#2a352b] bg-[#080d09]/95 p-4 backdrop-blur">
        <button onClick={() => router.back()} aria-label="Go back" className="flex h-10 w-10 items-center justify-center rounded-full border border-[#2a352b] bg-[#111811] text-white hover:border-[#c5f94d]">
          <ChevronLeft className="h-6 w-6" aria-hidden />
        </button>
        <div>
          <h1 className="font-bold leading-tight text-white">Match details</h1>
          <p className="text-xs text-slate-400">{match.tournamentTitle}</p>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 p-5 sm:p-8">
        <section className="relative overflow-hidden rounded-[26px] border border-[#2a352b] bg-[#111811] p-6 text-center shadow-xl">
          <span className="text-xs font-bold uppercase tracking-widest text-[#c5f94d]">Round {match.round}</span>
          <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            <Participant name={match.player1.name} tone="blue" score={displayScore1} />
            <span className="text-2xl font-black italic text-slate-600">VS</span>
            <Participant name={match.player2.name} tone="red" score={displayScore2} />
          </div>
          <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-[#2a352b] bg-[#090d09] px-4 py-1.5 text-xs font-bold tracking-wide text-white">
            <span className={`h-2 w-2 rounded-full ${match.status === "LIVE" ? "animate-pulse bg-red-500" : "bg-amber-400"}`} />
            {match.status.replaceAll("_", " ")}
          </div>
          {match.scheduledTime && <p className="mt-3 flex items-center justify-center gap-1 text-xs text-slate-400"><Clock3 className="h-3.5 w-3.5" aria-hidden />{new Date(match.scheduledTime).toLocaleString()}</p>}
        </section>

        {/* Discord Match Coordination Card */}
        {(match.player1.discordUsername || match.player2.discordUsername) && (
          <section className="flex flex-col gap-3 rounded-2xl border border-[#23313d] bg-[#0d151e] p-4 text-left">
            <div className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-[#5865F2]/20 text-[#5865F2]">
                <Gamepad2 className="h-4 w-4" />
              </span>
              <div>
                <p className="text-xs font-black text-white">Discord Match Lobby</p>
                <p className="text-[10px] text-[#7d8e7e]">Coordinate server region & custom room codes with your opponent</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
              {match.player1.discordUsername && (
                <div className="flex items-center justify-between rounded-xl border border-[#1b2836] bg-[#091017] p-2.5">
                  <div className="min-w-0">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-[#687b8f]">{match.player1.name}</span>
                    <p className="truncate text-xs font-black text-[#5865F2]">@{match.player1.discordUsername}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard.writeText(match.player1.discordUsername!);
                      alert(`Copied @${match.player1.discordUsername} to clipboard`);
                    }}
                    className="grid h-7 w-7 place-items-center rounded-lg border border-[#2b3c4d] bg-[#14202d] text-[#8ea5bc] hover:text-white transition"
                    title="Copy Discord tag"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}

              {match.player2.discordUsername && (
                <div className="flex items-center justify-between rounded-xl border border-[#1b2836] bg-[#091017] p-2.5">
                  <div className="min-w-0">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-[#687b8f]">{match.player2.name}</span>
                    <p className="truncate text-xs font-black text-[#5865F2]">@{match.player2.discordUsername}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard.writeText(match.player2.discordUsername!);
                      alert(`Copied @${match.player2.discordUsername} to clipboard`);
                    }}
                    className="grid h-7 w-7 place-items-center rounded-lg border border-[#2b3c4d] bg-[#14202d] text-[#8ea5bc] hover:text-white transition"
                    title="Copy Discord tag"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          </section>
        )}

        {error && <StatusNotice tone="error" message={error} />}
        {message && <StatusNotice tone="success" message={message} />}

        {match.pendingResult && (
          <section className="rounded-2xl border border-amber-400/20 bg-amber-400/5 p-4">
            <h2 className="font-bold text-white">Result awaiting confirmation</h2>
            <p className="mt-1 text-sm text-slate-300">{match.player1.name} {match.pendingResult.score1} – {match.pendingResult.score2} {match.player2.name}</p>
            {match.pendingResult.comment && <p className="mt-2 text-sm text-slate-400">“{match.pendingResult.comment}”</p>}
            {match.canConfirm && (
              <div className="mt-4 grid grid-cols-2 gap-3">
                <Button disabled={isResolving} onClick={() => refreshAfter(() => confirmMatchResult(match.id), "Result confirmed and bracket updated.")} className="bg-emerald-600 font-bold hover:bg-emerald-500">Confirm</Button>
                <Button disabled={isResolving} onClick={() => refreshAfter(() => rejectMatchResult(match.id), "Result rejected. You may open a dispute.")} variant="outline" className="border-red-400/40 text-red-200 hover:bg-red-500/10">Reject</Button>
              </div>
            )}
          </section>
        )}

        {match.canSubmit && (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-[24px] border border-[#2a352b] bg-[#111811] p-5">
            <div>
              <h2 className="text-lg font-bold text-white">Submit result</h2>
              <p className="mt-1 text-sm text-slate-400">Scores are verified by your opponent before the bracket changes.</p>
            </div>
            <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-3">
              <ScoreInput label={`${match.player1.name} score`} value={score1} onChange={setScore1} />
              <span className="pb-3 text-slate-500">–</span>
              <ScoreInput label={`${match.player2.name} score`} value={score2} onChange={setScore2} />
            </div>
            <label className="text-sm font-medium text-slate-300">Comment <span className="text-slate-500">(optional)</span><textarea value={comment} onChange={(event) => setComment(event.target.value)} maxLength={1000} rows={3} className="mt-2 w-full resize-none rounded-xl border border-[#2a352b] bg-[#090d09] px-3 py-2 text-white outline-none focus:border-[#c5f94d]" /></label>
            <label className="cursor-pointer rounded-xl border-2 border-dashed border-[#354235] bg-black/40 p-4 text-center transition hover:border-[#c5f94d]/70">
              <Upload className="mx-auto h-6 w-6 text-[#c5f94d]" aria-hidden />
              <span className="mt-2 block text-sm font-semibold text-slate-200">{evidence ? evidence.name : "Add optional screenshot evidence"}</span>
              <span className="mt-1 block text-xs text-slate-500">JPG, PNG, or WebP · up to 5 MB</span>
              <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => setEvidence(event.target.files?.[0] ?? null)} />
            </label>
            <Button type="submit" disabled={isSubmitting} className="min-h-12 bg-[#c5f94d] font-bold text-[#090d09] hover:bg-[#d5ff70]">{isSubmitting ? "Submitting…" : "Submit match result"}</Button>
          </form>
        )}

        {match.evidence.length > 0 && (
          <section className="rounded-[24px] border border-[#2a352b] bg-[#111811] p-4">
            <h2 className="font-bold text-white">Match evidence</h2>
            <div className="mt-3 grid grid-cols-2 gap-3">
              {match.evidence.map((item) => item.signedUrl ? (
                <a key={item.id} href={item.signedUrl} target="_blank" rel="noreferrer" className="overflow-hidden rounded-xl border border-white/10">
                  {/* Supabase URLs are short-lived and are only issued to authorized viewers. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.signedUrl} alt="Submitted match evidence" className="aspect-video w-full object-cover" />
                </a>
              ) : <div key={item.id} className="rounded-xl border border-white/10 bg-black p-3 text-xs text-slate-500">Evidence temporarily unavailable</div>)}
            </div>
          </section>
        )}

        {match.canDispute && !match.hasOpenDispute && (
          <form onSubmit={handleDispute} className="rounded-2xl border border-red-500/15 bg-red-950/10 p-4">
            <h2 className="flex items-center gap-2 font-bold text-red-200"><ShieldAlert className="h-4 w-4" aria-hidden />Open a dispute</h2>
            <textarea value={disputeReason} onChange={(event) => setDisputeReason(event.target.value)} minLength={10} maxLength={1000} required rows={3} placeholder="Explain what needs moderator review" className="mt-3 w-full resize-none rounded-xl border border-red-400/20 bg-black px-3 py-2 text-sm text-white outline-none focus:border-red-400" />
            <Button type="submit" disabled={isResolving} variant="outline" className="mt-3 border-red-400/40 text-red-200 hover:bg-red-500/10">Open dispute</Button>
          </form>
        )}
        {match.hasOpenDispute && <StatusNotice tone="warning" message="A dispute is open for this match. A moderator will review the evidence." />}
      </div>
    </main>
  );
}

function Participant({ name, tone, score }: { name: string; tone: "blue" | "red"; score: number | null }) {
  const colors = tone === "blue" ? "border-[#c5f94d] bg-[#1f3619]" : "border-red-500 bg-red-950";
  return <div className="min-w-0"><div className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full border-2 ${colors} text-xl font-black text-white`}>{name[0]?.toUpperCase() ?? "?"}</div><p className="mt-2 truncate text-sm font-bold text-white">{name}</p>{score !== null && <p className="mt-1 text-2xl font-black text-white">{score}</p>}</div>;
}

function ScoreInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="text-xs font-bold uppercase text-slate-400">{label}<input type="number" min="0" max="999" inputMode="numeric" value={value} onChange={(event) => onChange(event.target.value)} required className="mt-2 w-full rounded-xl border border-[#2a352b] bg-[#090d09] px-3 py-3 text-center text-xl font-bold text-white outline-none focus:border-[#c5f94d]" /></label>;
}

function StatusNotice({ tone, message }: { tone: "error" | "success" | "warning"; message: string }) {
  const styles = tone === "error" ? "border-red-500/30 bg-red-500/10 text-red-100" : tone === "success" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100" : "border-amber-500/30 bg-amber-500/10 text-amber-100";
  const Icon = tone === "error" ? XCircle : tone === "success" ? CheckCircle2 : ShieldAlert;
  return <div role="status" className={`flex items-start gap-2 rounded-xl border p-3 text-sm ${styles}`}><Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />{message}</div>;
}
