"use client";

import { useState, type FormEvent } from "react";
import { ChevronLeft, Plus, Swords } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cancelTournamentAndRefund, createGame, createTournament, setGameActive, setTournamentStatus } from "@/features/admin/actions";
import { generateSingleEliminationBracket } from "@/features/matches/actions";

type Game = { id: string; name: string; slug: string; isActive: boolean };
type Tournament = { id: string; title: string; status: string; format: string; isPaid: boolean; entryFee: number; startDate: Date; game: { name: string }; _count: { registrations: number; matches: number } };
const formats = ["SINGLE_ELIMINATION", "DOUBLE_ELIMINATION", "ROUND_ROBIN", "LEAGUE", "SWISS", "BATTLE_ROYALE", "CUSTOM"];
const statuses = ["DRAFT", "REGISTRATION_OPEN", "REGISTRATION_CLOSED", "UPCOMING", "CHECK_IN", "LIVE", "COMPLETED"];

export function AdminTournamentsClient({ games, tournaments }: { games: Game[]; tournaments: Tournament[] }) {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [showGame, setShowGame] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function execute(action: () => Promise<{ success: boolean; error?: string; warning?: string }>, successMessage: string) {
    setPending(true); setError(null);
    const result = await action();
    setPending(false);
    if (!result.success) { setError(result.error ?? "Operation failed."); return false; }
    setMessage(result.warning ? `${successMessage} ${result.warning}` : successMessage);
    router.refresh();
    return true;
  }

  async function handleGame(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const success = await execute(() => createGame({ name: form.get("name"), slug: form.get("slug") }), "Game added.");
    if (success) { event.currentTarget.reset(); setShowGame(false); }
  }

  async function handleTournament(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const isPaid = form.get("isPaid") === "on";
    const success = await execute(() => createTournament({
      title: form.get("title"), gameId: form.get("gameId"), prizePool: form.get("prizePool"), entryFee: form.get("entryFee"), isPaid,
      maxParticipants: form.get("maxParticipants"), registrationDeadline: new Date(String(form.get("registrationDeadline"))), startDate: new Date(String(form.get("startDate"))),
      format: form.get("format"), region: form.get("region"), gameMode: form.get("gameMode"), rules: form.get("rules"), status: form.get("status"),
    }), "Tournament created.");
    if (success) { event.currentTarget.reset(); setShowCreate(false); }
  }

  return <main className="min-h-screen bg-black p-4 pb-24 text-slate-100"><header className="flex items-center gap-3 pt-2"><Link href="/admin" className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-slate-900"><ChevronLeft className="h-5 w-5" aria-hidden /></Link><div><h1 className="text-2xl font-black text-white">Tournament administration</h1><p className="text-sm text-slate-400">Games, events, brackets, and safe lifecycle changes.</p></div></header><div className="mt-5 grid grid-cols-2 gap-3"><Button onClick={() => setShowCreate((value) => !value)} className="bg-violet-600 font-bold hover:bg-violet-500"><Plus className="mr-1 h-4 w-4" aria-hidden />Tournament</Button><Button onClick={() => setShowGame((value) => !value)} variant="outline" className="border-white/10 bg-slate-900 text-slate-200 hover:bg-slate-800">Add game</Button></div>{error && <Notice tone="error" message={error} />}{message && <Notice tone="success" message={message} />}{showGame && <form onSubmit={handleGame} className="mt-4 grid gap-3 rounded-2xl border border-white/10 bg-slate-900 p-4"><h2 className="font-bold text-white">Add game</h2><Input name="name" label="Game name" placeholder="Rocket League" required /><Input name="slug" label="URL slug" placeholder="rocket-league" required /><Button disabled={pending} type="submit" className="bg-violet-600 font-bold hover:bg-violet-500">Save game</Button></form>}{showCreate && <form onSubmit={handleTournament} className="mt-4 grid gap-3 rounded-2xl border border-violet-400/20 bg-slate-900 p-4"><h2 className="font-bold text-white">Create tournament</h2><Input name="title" label="Title" required /><label className="grid gap-1 text-sm font-semibold text-slate-300">Game<select name="gameId" required className="rounded-xl border border-white/10 bg-black px-3 py-3 text-white">{games.filter((game) => game.isActive).map((game) => <option key={game.id} value={game.id}>{game.name}</option>)}</select></label><div className="grid grid-cols-2 gap-3"><Input name="prizePool" label="Prize pool (XTR)" type="number" defaultValue="0" min="0" required /><Input name="entryFee" label="Entry fee (XTR)" type="number" defaultValue="0" min="0" required /></div><label className="flex items-center gap-2 text-sm text-slate-300"><input name="isPaid" type="checkbox" className="h-4 w-4 accent-violet-500" />Paid tournament</label><div className="grid grid-cols-2 gap-3"><Input name="maxParticipants" label="Max players" type="number" defaultValue="16" min="2" required /><label className="grid gap-1 text-sm font-semibold text-slate-300">Format<select name="format" defaultValue="SINGLE_ELIMINATION" className="rounded-xl border border-white/10 bg-black px-3 py-3 text-white">{formats.map((format) => <option key={format} value={format}>{format.replaceAll("_", " ")}</option>)}</select></label></div><div className="grid grid-cols-2 gap-3"><Input name="registrationDeadline" label="Registration closes" type="datetime-local" required /><Input name="startDate" label="Starts" type="datetime-local" required /></div><div className="grid grid-cols-2 gap-3"><Input name="region" label="Region" placeholder="Global" /><Input name="gameMode" label="Game mode" placeholder="1v1" /></div><label className="grid gap-1 text-sm font-semibold text-slate-300">Initial status<select name="status" defaultValue="DRAFT" className="rounded-xl border border-white/10 bg-black px-3 py-3 text-white">{statuses.map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}</select></label><label className="grid gap-1 text-sm font-semibold text-slate-300">Rules<textarea name="rules" minLength={10} maxLength={10000} rows={4} className="rounded-xl border border-white/10 bg-black px-3 py-3 text-white" placeholder="Tournament rules and check-in requirements" /></label><Button disabled={pending} type="submit" className="bg-violet-600 font-bold hover:bg-violet-500">Create tournament</Button></form>}<section className="mt-6"><h2 className="text-lg font-bold text-white">Games</h2><div className="mt-3 space-y-2">{games.map((game) => <div key={game.id} className="flex items-center justify-between rounded-xl border border-white/5 bg-slate-900 p-3"><div><p className="font-semibold text-white">{game.name}</p><p className="text-xs text-slate-500">/{game.slug}</p></div><Button onClick={() => execute(() => setGameActive({ gameId: game.id, isActive: !game.isActive }), game.isActive ? "Game hidden from discovery." : "Game restored to discovery.")} disabled={pending} variant="outline" className="border-white/10 text-xs text-slate-200">{game.isActive ? "Deactivate" : "Activate"}</Button></div>)}</div></section><section className="mt-6"><h2 className="text-lg font-bold text-white">Tournaments</h2><div className="mt-3 space-y-3">{tournaments.map((tournament) => <article key={tournament.id} className="rounded-2xl border border-white/5 bg-slate-900 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-bold text-white">{tournament.title}</p><p className="mt-1 text-xs uppercase text-slate-500">{tournament.game.name} · {tournament.format.replaceAll("_", " ")} · {tournament._count.registrations} entries · {tournament._count.matches} matches</p></div><span className="rounded-full bg-black px-2 py-1 text-[10px] font-bold text-slate-300">{tournament.status.replaceAll("_", " ")}</span></div><div className="mt-4 grid grid-cols-2 gap-2"><select aria-label={`Status for ${tournament.title}`} defaultValue={tournament.status} onChange={(event) => { if (event.target.value !== tournament.status) void execute(() => setTournamentStatus({ tournamentId: tournament.id, status: event.target.value }), "Tournament status updated."); }} className="rounded-lg border border-white/10 bg-black px-2 py-2 text-xs text-white">{statuses.map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}</select>{tournament.format === "SINGLE_ELIMINATION" && tournament.status === "REGISTRATION_CLOSED" && <Button onClick={() => execute(() => generateSingleEliminationBracket(tournament.id), "Bracket generated.")} disabled={pending} variant="outline" className="border-violet-400/30 text-violet-200 hover:bg-violet-500/10"><Swords className="mr-1 h-4 w-4" aria-hidden />Bracket</Button>}</div><Button onClick={() => execute(() => cancelTournamentAndRefund(tournament.id), "Tournament cancelled.")} disabled={pending || tournament.status === "CANCELLED"} variant="outline" className="mt-3 w-full border-red-500/30 text-red-200 hover:bg-red-500/10">Cancel tournament and refund eligible entries</Button></article>)}</div></section></main>;
}

function Input({ name, label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { name: string; label: string }) { return <label className="grid gap-1 text-sm font-semibold text-slate-300">{label}<input name={name} {...props} className="rounded-xl border border-white/10 bg-black px-3 py-3 text-white outline-none focus:border-violet-400" /></label>; }
function Notice({ tone, message }: { tone: "error" | "success"; message: string }) { return <p role="status" className={`mt-4 rounded-xl border p-3 text-sm ${tone === "error" ? "border-red-500/30 bg-red-500/10 text-red-100" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"}`}>{message}</p>; }
