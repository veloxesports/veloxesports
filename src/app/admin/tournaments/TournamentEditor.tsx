"use client";

import { useState, type FormEvent } from "react";
import { CalendarDays, CircleAlert, Save, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { updateTournament } from "@/features/admin/actions";

type Game = { id: string; name: string; slug: string; isActive: boolean };
type Tournament = {
  id: string;
  title: string;
  status: string;
  format: string;
  isPaid: boolean;
  entryFee: number;
  prizePool: number;
  maxParticipants: number;
  registrationDeadline: Date;
  startDate: Date;
  region: string | null;
  gameMode: string | null;
  game: { id: string; name: string };
  rules: { content: string; checkInPeriodMins: number } | null;
};

const formats = ["SINGLE_ELIMINATION", "DOUBLE_ELIMINATION", "ROUND_ROBIN", "LEAGUE", "SWISS", "BATTLE_ROYALE", "CUSTOM"];
const controlClass = "w-full rounded-2xl border border-[#344335] bg-[#080d09] px-3.5 py-3 text-sm text-white outline-none transition placeholder:text-[#6f796f] focus:border-[#c5f94d] focus:ring-2 focus:ring-[#c5f94d]/15 disabled:cursor-not-allowed disabled:opacity-60";

export function TournamentEditor({ tournament, games, onClose }: { tournament: Tournament; games: Game[]; onClose: () => void }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rules, setRules] = useState(tournament.rules?.content ?? "Standard VELOX competitive rules apply.");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const registrationDeadline = new Date(String(form.get("registrationDeadline")));
    const startDate = new Date(String(form.get("startDate")));
    if (Number.isNaN(registrationDeadline.getTime()) || Number.isNaN(startDate.getTime())) {
      setError("Select both the registration deadline and tournament start date from the calendar picker.");
      return;
    }

    setPending(true);
    setError(null);
    const result = await updateTournament({
      tournamentId: tournament.id,
      title: form.get("title"),
      gameId: form.get("gameId"),
      prizePool: form.get("prizePool"),
      entryFee: form.get("entryFee"),
      isPaid: form.get("isPaid") === "on",
      maxParticipants: form.get("maxParticipants"),
      registrationDeadline,
      startDate,
      format: form.get("format"),
      region: form.get("region"),
      gameMode: form.get("gameMode"),
      rules,
      checkInPeriodMins: form.get("checkInPeriodMins"),
    });
    setPending(false);

    if (!result.success) {
      setError(result.error ?? "We couldn't update this tournament.");
      return;
    }

    router.refresh();
    onClose();
  }

  return (
    <form onSubmit={handleSubmit} className="velox-card mt-4 overflow-hidden border-[#496b38]">
      <div className="flex items-start justify-between gap-4 border-b border-[#2a352b] bg-[radial-gradient(circle_at_90%_0%,rgba(197,249,77,0.13),transparent_35%)] px-5 py-5 sm:px-6">
        <div><p className="velox-eyebrow">Tournament editor</p><h2 className="mt-1 text-xl font-black text-white">Update {tournament.title}</h2><p className="mt-1 text-sm text-[#8e998f]">Player registrations protect game, format, and payment settings. Bracketed tournaments also lock schedule and capacity.</p></div>
        <button type="button" onClick={onClose} className="velox-muted-button flex h-10 w-10 shrink-0 p-0" aria-label="Close tournament editor"><X className="h-5 w-5" aria-hidden /></button>
      </div>
      <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
        <Input name="title" label="Tournament title" defaultValue={tournament.title} className="sm:col-span-2" required />
        <Select name="gameId" label="Game" defaultValue={tournament.game.id} required>{games.map((game) => <option key={game.id} value={game.id} disabled={!game.isActive && game.id !== tournament.game.id}>{game.name}{!game.isActive ? " (inactive)" : ""}</option>)}</Select>
        <Select name="format" label="Format" defaultValue={tournament.format}>{formats.map((format) => <option key={format} value={format}>{labelFor(format)}</option>)}</Select>
        <Input name="prizePool" label="Prize pool (XTR)" type="number" defaultValue={tournament.prizePool} min="0" required />
        <Input name="entryFee" label="Entry fee (XTR)" type="number" defaultValue={tournament.entryFee} min="0" required />
        <label className="flex items-center gap-3 rounded-2xl border border-[#344335] bg-[#131b14] px-4 py-3 text-sm font-bold text-[#dce8d7] sm:col-span-2"><input name="isPaid" type="checkbox" defaultChecked={tournament.isPaid} className="h-4 w-4 accent-[#c5f94d]" />Paid tournament — collect the entry fee through Telegram Stars.</label>
        <Input name="maxParticipants" label="Maximum players" type="number" defaultValue={tournament.maxParticipants} min="2" required />
        <Input name="checkInPeriodMins" label="Check-in window (minutes)" type="number" defaultValue={tournament.rules?.checkInPeriodMins ?? 60} min="5" max="1440" required />
        <DateTimeInput name="registrationDeadline" label="Registration closes" defaultValue={tournament.registrationDeadline} />
        <DateTimeInput name="startDate" label="Tournament starts" defaultValue={tournament.startDate} />
        <Input name="region" label="Region" defaultValue={tournament.region ?? ""} placeholder="Global" />
        <Input name="gameMode" label="Game mode" defaultValue={tournament.gameMode ?? ""} placeholder="1v1" />
        <label className="grid gap-2 text-sm font-bold text-[#dce8d7] sm:col-span-2"><span>Tournament rules</span><textarea name="rules" value={rules} onChange={(event) => setRules(event.target.value)} minLength={10} maxLength={10_000} rows={15} required className={`${controlClass} resize-y font-mono text-xs leading-relaxed`} /></label>
      </div>
      {error && <p role="alert" className="mx-5 mb-4 flex items-start gap-2 rounded-2xl border border-[#87493d] bg-[#2b1d19] px-4 py-3 text-sm font-medium text-[#ffb1a0] sm:mx-6"><CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />{error}</p>}
      <div className="flex flex-col gap-3 border-t border-[#2a352b] bg-[#0d130e] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"><p className="text-xs leading-relaxed text-[#7e8c7d]">Changes are recorded in the audit log and reflected immediately across VELOX.</p><button disabled={pending} type="submit" className="velox-action shrink-0"><Save className="mr-2 h-4 w-4" aria-hidden />{pending ? "Saving…" : "Save changes"}</button></div>
    </form>
  );
}

function Input({ name, label, className = "", ...props }: React.InputHTMLAttributes<HTMLInputElement> & { name: string; label: string }) {
  return <label className={`grid gap-2 text-sm font-bold text-[#dce8d7] ${className}`}>{label}<input name={name} {...props} className={controlClass} /></label>;
}

function Select({ name, label, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { name: string; label: string; children: React.ReactNode }) {
  return <label className="grid gap-2 text-sm font-bold text-[#dce8d7]">{label}<select name={name} {...props} className={controlClass}>{children}</select></label>;
}

function DateTimeInput({ name, label, defaultValue }: { name: string; label: string; defaultValue: Date }) {
  return <label className="grid gap-2 text-sm font-bold text-[#dce8d7]">{label}<span className="relative"><CalendarDays className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#c5f94d]" aria-hidden /><input name={name} type="datetime-local" required defaultValue={dateTimeLocal(defaultValue)} className={`${controlClass} [color-scheme:dark] pl-10`} /></span></label>;
}

function dateTimeLocal(value: Date) {
  const date = new Date(value);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

function labelFor(value: string) {
  return value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}
