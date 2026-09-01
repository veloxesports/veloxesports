"use client";

import { useState, type FormEvent, type InputHTMLAttributes } from "react";
import { CalendarDays, ChevronLeft, CircleAlert, Gamepad2, Plus, RefreshCw, Swords, Trophy, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cancelTournamentAndRefund, createGame, createTournament, setGameActive, setTournamentStatus } from "@/features/admin/actions";
import { generateSingleEliminationBracket } from "@/features/matches/actions";
import { getTournamentRulesTemplate } from "@/lib/tournaments/rule-templates";

type Game = { id: string; name: string; slug: string; isActive: boolean };
type Tournament = { id: string; title: string; status: string; format: string; isPaid: boolean; entryFee: number; startDate: Date; game: { name: string }; _count: { registrations: number; matches: number } };

const formats = ["SINGLE_ELIMINATION", "DOUBLE_ELIMINATION", "ROUND_ROBIN", "LEAGUE", "SWISS", "BATTLE_ROYALE", "CUSTOM"];
const statuses = ["DRAFT", "REGISTRATION_OPEN", "REGISTRATION_CLOSED", "UPCOMING", "CHECK_IN", "LIVE", "COMPLETED"];
const controlClass = "w-full rounded-2xl border border-[#344335] bg-[#080d09] px-3.5 py-3 text-sm text-white outline-none transition placeholder:text-[#6f796f] focus:border-[#c5f94d] focus:ring-2 focus:ring-[#c5f94d]/15 disabled:cursor-not-allowed disabled:opacity-60";

export function AdminTournamentsClient({ games, tournaments }: { games: Game[]; tournaments: Tournament[] }) {
  const router = useRouter();
  const activeGames = games.filter((game) => game.isActive);
  const [showCreate, setShowCreate] = useState(false);
  const [showGame, setShowGame] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedGameId, setSelectedGameId] = useState(() => activeGames[0]?.id ?? "");
  const [rules, setRules] = useState(() => activeGames[0] ? getTournamentRulesTemplate(activeGames[0]) : "");
  const selectedGame = activeGames.find((game) => game.id === selectedGameId);

  function loadRulesForGame(gameId: string) {
    const game = activeGames.find((candidate) => candidate.id === gameId);
    setSelectedGameId(gameId);
    setRules(game ? getTournamentRulesTemplate(game) : "");
  }

  async function execute(action: () => Promise<{ success: boolean; error?: string; warning?: string }>, successMessage: string) {
    setPending(true);
    setError(null);
    const result = await action();
    setPending(false);

    if (!result.success) {
      setError(result.error ?? "Operation failed.");
      return false;
    }

    setMessage(result.warning ? `${successMessage} ${result.warning}` : successMessage);
    router.refresh();
    return true;
  }

  async function handleGame(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const success = await execute(() => createGame({ name: form.get("name"), slug: form.get("slug") }), "Game added to the tournament catalog.");
    if (success) {
      event.currentTarget.reset();
      setShowGame(false);
    }
  }

  async function handleTournament(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const registrationDeadline = new Date(String(form.get("registrationDeadline")));
    const startDate = new Date(String(form.get("startDate")));

    if (Number.isNaN(registrationDeadline.getTime()) || Number.isNaN(startDate.getTime())) {
      setError("Select both the registration deadline and tournament start date from the calendar picker.");
      return;
    }

    const success = await execute(() => createTournament({
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
      status: form.get("status"),
    }), "Tournament created and added to the operating queue.");

    if (success) {
      event.currentTarget.reset();
      loadRulesForGame(activeGames[0]?.id ?? "");
      setShowCreate(false);
    }
  }

  return (
    <main className="velox-page">
      <header className="flex items-start gap-3">
        <Link href="/admin" className="velox-muted-button flex h-10 w-10 shrink-0 p-0" aria-label="Back to Command Center"><ChevronLeft className="h-5 w-5" aria-hidden /></Link>
        <div>
          <p className="velox-eyebrow">Event operations</p>
          <h1 className="mt-1 text-2xl font-black tracking-[-0.04em] text-white sm:text-3xl">Tournament control</h1>
          <p className="mt-1 text-sm leading-relaxed text-[#8e998f]">Create events, manage the game roster, brackets, and safe lifecycle changes.</p>
        </div>
      </header>

      <section className="mt-6 grid gap-3 sm:grid-cols-2">
        <button type="button" onClick={() => setShowCreate((value) => !value)} className="velox-action min-h-12"><Plus className="mr-2 h-4 w-4" aria-hidden />{showCreate ? "Close tournament form" : "Create tournament"}</button>
        <button type="button" onClick={() => setShowGame((value) => !value)} className="velox-muted-button min-h-12"><Gamepad2 className="mr-2 h-4 w-4 text-[#c5f94d]" aria-hidden />{showGame ? "Close game form" : "Add a game"}</button>
      </section>

      {error && <Notice tone="error" message={error} />}
      {message && <Notice tone="success" message={message} />}

      {showGame && (
        <form onSubmit={handleGame} className="velox-card mt-4 p-5">
          <p className="velox-eyebrow">Catalog</p>
          <h2 className="mt-1 text-lg font-black text-white">Add a playable game</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Input name="name" label="Game name" placeholder="Rocket League" required />
            <Input name="slug" label="URL slug" placeholder="rocket-league" required />
          </div>
          <button disabled={pending} type="submit" className="velox-action mt-4 w-full sm:w-auto">{pending ? "Saving…" : "Save game"}</button>
        </form>
      )}

      {showCreate && (
        <form onSubmit={handleTournament} className="velox-card mt-4 overflow-hidden">
          <div className="border-b border-[#2a352b] bg-[radial-gradient(circle_at_90%_0%,rgba(197,249,77,0.13),transparent_35%)] px-5 py-5 sm:px-6">
            <p className="velox-eyebrow">New event</p>
            <h2 className="mt-1 text-xl font-black text-white">Tournament setup</h2>
            <p className="mt-1 text-sm text-[#8e998f]">Set the competition details before opening it to players.</p>
          </div>
          <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
            <Input name="title" label="Tournament title" placeholder="Nightfall Championship" className="sm:col-span-2" required />
            <Select name="gameId" label="Game" value={selectedGameId} onChange={(event) => loadRulesForGame(event.target.value)} required>{activeGames.length === 0 && <option value="">No active games</option>}{activeGames.map((game) => <option key={game.id} value={game.id}>{game.name}</option>)}</Select>
            <Select name="format" label="Format" defaultValue="SINGLE_ELIMINATION">{formats.map((format) => <option key={format} value={format}>{labelFor(format)}</option>)}</Select>
            <Input name="prizePool" label="Prize pool (XTR)" type="number" defaultValue="0" min="0" required />
            <Input name="entryFee" label="Entry fee (XTR)" type="number" defaultValue="0" min="0" required />
            <label className="flex items-center gap-3 rounded-2xl border border-[#344335] bg-[#131b14] px-4 py-3 text-sm font-bold text-[#dce8d7] sm:col-span-2"><input name="isPaid" type="checkbox" className="h-4 w-4 accent-[#c5f94d]" />Paid tournament — collect the entry fee through Telegram Stars.</label>
            <Input name="maxParticipants" label="Maximum players" type="number" defaultValue="16" min="2" required />
            <Select name="status" label="Initial status" defaultValue="DRAFT">{statuses.map((status) => <option key={status} value={status}>{labelFor(status)}</option>)}</Select>
            <DateTimeInput name="registrationDeadline" label="Registration closes" />
            <DateTimeInput name="startDate" label="Tournament starts" />
            <Input name="region" label="Region" placeholder="Global" />
            <Input name="gameMode" label="Game mode" placeholder="1v1" />
            <label className="grid gap-2 text-sm font-bold text-[#dce8d7] sm:col-span-2">
              <span className="flex flex-wrap items-center justify-between gap-2">Tournament rules <button type="button" onClick={() => loadRulesForGame(selectedGameId)} disabled={!selectedGame} className="inline-flex items-center gap-1 rounded-lg border border-[#40503f] bg-[#142014] px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.08em] text-[#c5f94d] transition hover:border-[#c5f94d] disabled:cursor-not-allowed disabled:opacity-50"><RefreshCw className="h-3.5 w-3.5" aria-hidden />Restore template</button></span>
              <textarea name="rules" value={rules} onChange={(event) => setRules(event.target.value)} minLength={10} maxLength={10_000} rows={18} required className={`${controlClass} resize-y font-mono text-xs leading-relaxed`} placeholder="Choose a game to load its tournament rules." aria-describedby="rules-help" />
              <span id="rules-help" className="text-xs font-medium leading-relaxed text-[#748173]">{selectedGame ? `${selectedGame.name} rules are loaded automatically. Review and edit this template before publishing; restoring it discards your current changes.` : "Select an active game to load its editable rules template."}</span>
            </label>
          </div>
          <div className="flex flex-col gap-3 border-t border-[#2a352b] bg-[#0d130e] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <p className="text-xs leading-relaxed text-[#7e8c7d]">Registration must close before the tournament start date.</p>
            <button disabled={pending || activeGames.length === 0} type="submit" className="velox-action shrink-0">{pending ? "Creating…" : "Create tournament"}</button>
          </div>
        </form>
      )}

      <section className="mt-7">
        <SectionHeading eyebrow="Catalog" title="Games" detail={`${games.length} configured`} />
        <div className="velox-card mt-3 divide-y divide-[#29342a] overflow-hidden">
          {games.length === 0 ? <Empty icon={<Gamepad2 className="h-8 w-8" aria-hidden />} title="No games configured" detail="Add the first game before creating a tournament." /> : games.map((game) => (
            <div key={game.id} className="flex items-center justify-between gap-3 px-5 py-4">
              <div className="min-w-0"><p className="truncate font-black text-white">{game.name}</p><p className="mt-0.5 text-xs text-[#718071]">/{game.slug}</p></div>
              <div className="flex items-center gap-2"><span className={`hidden rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-[0.08em] sm:block ${game.isActive ? "bg-[#20331b] text-[#c5f94d]" : "bg-[#262d27] text-[#a4aea3]"}`}>{game.isActive ? "Active" : "Hidden"}</span><button type="button" onClick={() => void execute(() => setGameActive({ gameId: game.id, isActive: !game.isActive }), game.isActive ? "Game hidden from player discovery." : "Game restored to player discovery.")} disabled={pending} className="velox-muted-button px-3 py-2 text-xs">{game.isActive ? "Deactivate" : "Activate"}</button></div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-7">
        <SectionHeading eyebrow="Operating queue" title="Tournaments" detail={`${tournaments.length} total`} />
        <div className="mt-3 grid gap-3">
          {tournaments.length === 0 ? <div className="velox-card"><Empty icon={<Trophy className="h-8 w-8" aria-hidden />} title="No tournaments yet" detail="Create your first event to populate the operating queue." /></div> : tournaments.map((tournament) => (
            <article key={tournament.id} className="velox-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0"><Link href={`/admin/tournaments/${tournament.id}`} className="text-lg font-black text-white transition hover:text-[#c5f94d]">{tournament.title}</Link><p className="mt-1 text-xs font-bold uppercase tracking-[0.08em] text-[#8e998f]">{tournament.game.name} · {labelFor(tournament.format)}</p></div>
                <StatusBadge value={tournament.status} />
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 border-y border-[#29342a] py-3 text-center">
                <Stat label="Entries" value={tournament._count.registrations} icon={<Users className="h-3.5 w-3.5" aria-hidden />} />
                <Stat label="Matches" value={tournament._count.matches} icon={<Swords className="h-3.5 w-3.5" aria-hidden />} />
                <Stat label="Starts" value={formatDate(tournament.startDate)} icon={<CalendarDays className="h-3.5 w-3.5" aria-hidden />} />
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
                <select aria-label={`Status for ${tournament.title}`} defaultValue={tournament.status} disabled={pending} onChange={(event) => { if (event.target.value !== tournament.status) void execute(() => setTournamentStatus({ tournamentId: tournament.id, status: event.target.value }), "Tournament status updated."); }} className={`${controlClass} py-2.5 text-xs font-bold`}>{statuses.map((status) => <option key={status} value={status}>{labelFor(status)}</option>)}</select>
                <Link href={`/admin/tournaments/${tournament.id}`} className="velox-muted-button px-3 py-2.5 text-xs"><Users className="mr-1.5 h-4 w-4 text-[#c5f94d]" aria-hidden />Players</Link>
                {tournament.format === "SINGLE_ELIMINATION" && tournament.status === "REGISTRATION_CLOSED" && <button type="button" onClick={() => void execute(() => generateSingleEliminationBracket(tournament.id), "Single-elimination bracket generated.")} disabled={pending} className="velox-muted-button px-3 py-2.5 text-xs"><Swords className="mr-1.5 h-4 w-4 text-[#c5f94d]" aria-hidden />Generate bracket</button>}
                <button type="button" onClick={() => { if (window.confirm("Cancel this tournament and refund eligible Telegram Stars payments? This cannot be undone.")) void execute(() => cancelTournamentAndRefund(tournament.id), "Tournament cancelled."); }} disabled={pending || tournament.status === "CANCELLED"} className="rounded-2xl border border-[#75453b] bg-[#2a1918] px-3 py-2.5 text-xs font-black text-[#ffad9a] transition hover:border-[#b9624f] hover:bg-[#3a211e] disabled:cursor-not-allowed disabled:opacity-50">Cancel & refund</button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

function Input({ name, label, className = "", ...props }: InputHTMLAttributes<HTMLInputElement> & { name: string; label: string }) {
  return <label className={`grid gap-2 text-sm font-bold text-[#dce8d7] ${className}`}>{label}<input name={name} {...props} className={controlClass} /></label>;
}

function Select({ name, label, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { name: string; label: string; children: React.ReactNode }) {
  return <label className="grid gap-2 text-sm font-bold text-[#dce8d7]">{label}<select name={name} {...props} className={controlClass}>{children}</select></label>;
}

function DateTimeInput({ name, label }: { name: string; label: string }) {
  return <label className="grid gap-2 text-sm font-bold text-[#dce8d7]">{label}<span className="relative"><CalendarDays className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#c5f94d]" aria-hidden /><input name={name} type="datetime-local" required className={`${controlClass} [color-scheme:dark] pl-10`} /></span><span className="text-xs font-medium text-[#748173]">Choose a date and time with the calendar picker.</span></label>;
}

function Notice({ tone, message }: { tone: "error" | "success"; message: string }) {
  return <p role="status" className={`mt-4 flex items-start gap-2 rounded-2xl border px-4 py-3 text-sm font-medium ${tone === "error" ? "border-[#87493d] bg-[#2b1d19] text-[#ffb1a0]" : "border-[#496b38] bg-[#182716] text-[#d8f5b3]"}`}><CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />{message}</p>;
}

function SectionHeading({ eyebrow, title, detail }: { eyebrow: string; title: string; detail: string }) {
  return <div className="flex items-end justify-between gap-3"><div><p className="velox-eyebrow">{eyebrow}</p><h2 className="mt-1 text-xl font-black text-white">{title}</h2></div><p className="text-xs font-bold uppercase tracking-[0.08em] text-[#8e998f]">{detail}</p></div>;
}

function Empty({ icon, title, detail }: { icon: React.ReactNode; title: string; detail: string }) {
  return <div className="px-5 py-10 text-center text-[#526052]"><span className="inline-flex">{icon}</span><p className="mt-3 font-black text-white">{title}</p><p className="mx-auto mt-1 max-w-sm text-sm leading-relaxed text-[#8e998f]">{detail}</p></div>;
}

function StatusBadge({ value }: { value: string }) {
  const isLive = value === "LIVE";
  const isReady = ["REGISTRATION_OPEN", "UPCOMING", "CHECK_IN"].includes(value);
  return <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em] ${isLive ? "bg-[#253a1d] text-[#c5f94d]" : isReady ? "bg-[#1b2b1a] text-[#bfeb74]" : "bg-[#242b25] text-[#a4aea3]"}`}>{labelFor(value)}</span>;
}

function Stat({ label, value, icon }: { label: string; value: string | number; icon: React.ReactNode }) {
  return <div><span className="mx-auto flex w-fit items-center gap-1 text-[#8e998f]">{icon}<span className="text-[10px] font-black uppercase tracking-[0.08em]">{label}</span></span><p className="mt-1 truncate text-sm font-black text-white">{value}</p></div>;
}

function labelFor(value: string) {
  return value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(value));
}
