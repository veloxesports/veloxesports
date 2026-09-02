"use client";

import { useEffect, useRef, useState, type FormEvent, type InputHTMLAttributes, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { CalendarDays, CheckCircle2, ChevronLeft, CircleAlert, Gamepad2, LoaderCircle, Pencil, Plus, RefreshCw, Swords, Trash2, Trophy, Users, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cancelTournamentAndRefund, createGame, createTournament, deleteTournament, openTournamentCheckIn, runTournamentLifecycleManually, setGameActive, setTournamentStatus } from "@/features/admin/actions";
import { generateSingleEliminationBracket } from "@/features/matches/actions";
import { getTournamentRulesTemplate } from "@/lib/tournaments/rule-templates";
import { TournamentEditor } from "./TournamentEditor";

type Game = { id: string; name: string; slug: string; isActive: boolean };
type Tournament = { id: string; title: string; status: string; format: string; participantType: "INDIVIDUAL" | "TEAM"; teamSize: number; isPaid: boolean; entryFee: number; prizePool: number; maxParticipants: number; currentParticipants: number; registrationDeadline: Date; startDate: Date; region: string | null; gameMode: string | null; game: { id: string; name: string }; rules: { content: string; checkInPeriodMins: number } | null; registrations: { id: string }[]; _count: { registrations: number; matches: number } };

const formats = ["SINGLE_ELIMINATION"];
const participantTypes = ["INDIVIDUAL", "TEAM"];
const initialStatuses = ["DRAFT", "REGISTRATION_OPEN"];
const controlClass = "w-full rounded-2xl border border-[#344335] bg-[#080d09] px-3.5 py-3 text-sm text-white outline-none transition placeholder:text-[#6f796f] focus:border-[#c5f94d] focus:ring-2 focus:ring-[#c5f94d]/15 disabled:cursor-not-allowed disabled:opacity-60";
type TournamentFieldErrors = Record<string, string>;

export function AdminTournamentsClient({ games, tournaments }: { games: Game[]; tournaments: Tournament[] }) {
  const router = useRouter();
  const createTriggerRef = useRef<HTMLButtonElement>(null);
  const createDialogRef = useRef<HTMLDivElement>(null);
  const createFormRef = useRef<HTMLFormElement>(null);
  const activeGames = games.filter((game) => game.isActive);
  const [showCreate, setShowCreate] = useState(false);
  const [showGame, setShowGame] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<TournamentFieldErrors>({});
  const [editingTournament, setEditingTournament] = useState<Tournament | null>(null);
  const [selectedGameId, setSelectedGameId] = useState(() => activeGames[0]?.id ?? "");
  const [rules, setRules] = useState(() => activeGames[0] ? getTournamentRulesTemplate(activeGames[0]) : "");
  const selectedGame = activeGames.find((game) => game.id === selectedGameId);

  useEffect(() => {
    if (!showCreate) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusTimer = window.setTimeout(() => (createFormRef.current?.elements.namedItem("title") as HTMLElement | null)?.focus(), 0);
    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;
    };
  }, [showCreate]);

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(null), 4_500);
    return () => window.clearTimeout(timer);
  }, [message]);

  function openCreateModal() {
    setError(null);
    setFieldErrors({});
    setShowCreate(true);
  }

  function closeCreateModal() {
    if (pending) return;
    setShowCreate(false);
    setError(null);
    setFieldErrors({});
    createFormRef.current?.reset();
    loadRulesForGame(activeGames[0]?.id ?? "");
    window.setTimeout(() => createTriggerRef.current?.focus(), 0);
  }

  function handleDialogKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeCreateModal();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = Array.from(createDialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])') ?? []);
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function loadRulesForGame(gameId: string) {
    const game = activeGames.find((candidate) => candidate.id === gameId);
    setSelectedGameId(gameId);
    setRules(game ? getTournamentRulesTemplate(game) : "");
  }

  async function execute(action: () => Promise<{ success: boolean; error?: string; warning?: string }>, successMessage: string) {
    setPending(true);
    setError(null);
    try {
      const result = await action();
      if (!result.success) {
        setError(result.error ?? "Operation failed.");
        return false;
      }

      setMessage(result.warning ? `${successMessage} ${result.warning}` : successMessage);
      router.refresh();
      return true;
    } catch {
      setError("The request could not be completed. Check your connection and try again.");
      return false;
    } finally {
      setPending(false);
    }
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
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const nextFieldErrors = validateTournamentForm(form, rules);
    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors);
      setError("Review the highlighted fields before creating this tournament.");
      const firstInvalidField = Object.keys(nextFieldErrors)[0];
      window.setTimeout(() => (formElement.elements.namedItem(firstInvalidField) as HTMLElement | null)?.focus(), 0);
      return;
    }
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
      participantType: form.get("participantType"),
      teamSize: form.get("teamSize"),
      region: form.get("region"),
      gameMode: form.get("gameMode"),
      rules,
      checkInPeriodMins: form.get("checkInPeriodMins"),
      status: form.get("status"),
    }), "Tournament created and added to the operating queue.");

    if (success) {
      formElement.reset();
      loadRulesForGame(activeGames[0]?.id ?? "");
      setShowCreate(false);
      setFieldErrors({});
      window.setTimeout(() => createTriggerRef.current?.focus(), 0);
    }
  }

  return (
    <main className="velox-page">
      <header className="flex items-start gap-3">
        <Link href="/admin" className="velox-muted-button flex h-10 w-10 shrink-0 p-0" aria-label="Back to Command Center"><ChevronLeft className="h-5 w-5" aria-hidden /></Link>
        <div>
          <p className="velox-eyebrow">Event operations</p>
          <h1 className="mt-1 text-2xl font-black tracking-[-0.04em] text-white sm:text-3xl">Tournament control</h1>
          <p className="mt-1 text-sm leading-relaxed text-[#8e998f]">Create events, manage the game roster, brackets, and safe manual lifecycle changes.</p>
        </div>
      </header>

      <section className="mt-6 grid gap-3 sm:grid-cols-3">
        <button ref={createTriggerRef} type="button" onClick={openCreateModal} className="velox-action min-h-12" aria-haspopup="dialog"><Plus className="mr-2 h-4 w-4" aria-hidden />Create tournament</button>
        <button type="button" onClick={() => setShowGame((value) => !value)} className="velox-muted-button min-h-12"><Gamepad2 className="mr-2 h-4 w-4 text-[#c5f94d]" aria-hidden />{showGame ? "Close game form" : "Add a game"}</button>
        <button type="button" onClick={() => { if (window.confirm("Run the tournament lifecycle now? This applies every due step, including player notifications, brackets, live matches, completed events, and eligible prize rewards.")) void execute(runTournamentLifecycleManually, "Manual lifecycle run finished."); }} disabled={pending} className="velox-muted-button min-h-12"><RefreshCw className="mr-2 h-4 w-4 text-[#c5f94d]" aria-hidden />{pending ? "Running…" : "Run lifecycle now"}</button>
      </section>
      <p className="mt-3 text-xs leading-relaxed text-[#748173]">VELOX does not run tournament automation on a schedule. Use this control whenever you are ready to advance all events that are currently due. Individual check-in controls remain available on each tournament.</p>

      {error && !showCreate && <Notice tone="error" message={error} />}
      {message && <div role="status" aria-live="polite" className="fixed right-4 top-20 z-[90] flex max-w-[calc(100vw-2rem)] items-start gap-3 rounded-2xl border border-[#55783e] bg-[#172417]/95 px-4 py-3 text-sm font-bold text-[#e8ffd0] shadow-[0_18px_55px_rgba(0,0,0,0.5)] backdrop-blur-xl sm:right-6"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#c5f94d]" aria-hidden /><span>{message}</span><button type="button" onClick={() => setMessage(null)} className="ml-1 text-[#8fa287] transition hover:text-white" aria-label="Dismiss notification"><X className="h-4 w-4" aria-hidden /></button></div>}

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
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[#020503]/80 p-2 backdrop-blur-[6px] sm:p-5" onMouseDown={(event) => { if (event.target === event.currentTarget) closeCreateModal(); }}>
          <div ref={createDialogRef} role="dialog" aria-modal="true" aria-labelledby="create-tournament-title" aria-describedby="create-tournament-description" onKeyDown={handleDialogKeyDown} className="flex max-h-[calc(100dvh-1rem)] w-full max-w-5xl flex-col overflow-hidden rounded-[26px] border border-[#40563a] bg-[#0d140e] shadow-[0_32px_100px_rgba(0,0,0,0.72)] sm:max-h-[calc(100dvh-2.5rem)]">
            <form ref={createFormRef} onSubmit={handleTournament} noValidate className="flex min-h-0 flex-1 flex-col" onInput={(event) => { const fieldName = (event.target as HTMLInputElement).name; setError(null); if (fieldName && fieldErrors[fieldName]) setFieldErrors((current) => { const next = { ...current }; delete next[fieldName]; return next; }); }}>
              <div className="flex shrink-0 items-start justify-between gap-4 border-b border-[#2a352b] bg-[radial-gradient(circle_at_90%_0%,rgba(197,249,77,0.16),transparent_35%)] px-5 py-4 sm:px-6 sm:py-5">
                <div><p className="velox-eyebrow">New competition</p><h2 id="create-tournament-title" className="mt-1 text-xl font-black tracking-[-0.03em] text-white sm:text-2xl">Create tournament</h2><p id="create-tournament-description" className="mt-1 text-xs leading-relaxed text-[#8e998f] sm:text-sm">Configure the event, schedule, entry model, and game-specific rules.</p></div>
                <button type="button" onClick={closeCreateModal} disabled={pending} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[#344335] bg-[#111a12] text-[#a9b4a6] transition hover:border-[#76965f] hover:text-white disabled:opacity-50" aria-label="Close create tournament dialog"><X className="h-5 w-5" aria-hidden /></button>
              </div>

              <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-4 py-5 sm:px-6">
                {error && <p role="alert" className="flex items-start gap-2 rounded-2xl border border-[#87493d] bg-[#2b1d19] px-4 py-3 text-sm font-medium text-[#ffb1a0]"><CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />{error}</p>}

                <FormSection eyebrow="Competition" title="Event identity" detail="Choose what players will see in discovery and brackets.">
                  <Input name="title" label="Tournament title" placeholder="Nightfall Championship" className="sm:col-span-2" error={fieldErrors.title} required />
                  <Select name="gameId" label="Game" value={selectedGameId} onChange={(event) => loadRulesForGame(event.target.value)} error={fieldErrors.gameId} required>{activeGames.length === 0 && <option value="">No active games</option>}{activeGames.map((game) => <option key={game.id} value={game.id}>{game.name}</option>)}</Select>
                  <label className="grid gap-2 text-sm font-bold text-[#dce8d7]"><span>Format</span><select name="format" defaultValue="SINGLE_ELIMINATION" className={controlClass}>{formats.map((format) => <option key={format} value={format}>{labelFor(format)}</option>)}</select><span className="text-xs font-medium leading-relaxed text-[#748173]">Single elimination enables automatic brackets, progression, and prizes.</span></label>
                  <Input name="gameMode" label="Game mode" placeholder="1v1" error={fieldErrors.gameMode} />
                  <Input name="region" label="Region" placeholder="Global" error={fieldErrors.region} />
                </FormSection>

                <FormSection eyebrow="Participation" title="Entry and rewards" detail="Set capacity, roster requirements, entry pricing, and prizes.">
                  <Select name="participantType" label="Entry type" defaultValue="INDIVIDUAL" error={fieldErrors.participantType}>{participantTypes.map((type) => <option key={type} value={type}>{type === "TEAM" ? "Team roster" : "Individual players"}</option>)}</Select>
                  <Input name="teamSize" label="Required roster size" type="number" defaultValue="1" min="1" max="20" error={fieldErrors.teamSize} required />
                  <Input name="maxParticipants" label="Maximum entries" type="number" defaultValue="16" min="2" max="10000" error={fieldErrors.maxParticipants} required />
                  <Input name="prizePool" label="Prize pool (XTR)" type="number" defaultValue="0" min="0" max="10000000" error={fieldErrors.prizePool} required />
                  <Input name="entryFee" label="Entry fee (XTR)" type="number" defaultValue="0" min="0" max="100000" error={fieldErrors.entryFee} required />
                  <label className="flex items-center gap-3 rounded-2xl border border-[#344335] bg-[#131b14] px-4 py-3 text-sm font-bold text-[#dce8d7]"><input name="isPaid" type="checkbox" className="h-4 w-4 accent-[#c5f94d]" />Paid tournament — collect the entry fee through Telegram Stars.</label>
                </FormSection>

                <FormSection eyebrow="Operations" title="Schedule and launch" detail="Registration must close before the tournament starts.">
                  <DateTimeInput name="registrationDeadline" label="Registration closes" error={fieldErrors.registrationDeadline} />
                  <DateTimeInput name="startDate" label="Tournament starts" error={fieldErrors.startDate} />
                  <Input name="checkInPeriodMins" label="Check-in window (minutes)" type="number" defaultValue="60" min="5" max="1440" error={fieldErrors.checkInPeriodMins} required />
                  <Select name="status" label="Initial status" defaultValue="DRAFT" error={fieldErrors.status}>{initialStatuses.map((status) => <option key={status} value={status}>{labelFor(status)}</option>)}</Select>
                </FormSection>

                <fieldset className="rounded-2xl border border-[#2a382b] bg-[#101711] p-4 sm:p-5">
                  <legend className="sr-only">Tournament rules</legend>
                  <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="velox-eyebrow">Governance</p><h3 className="mt-1 text-base font-black text-white">Tournament rules</h3></div><button type="button" onClick={() => loadRulesForGame(selectedGameId)} disabled={!selectedGame} className="inline-flex items-center gap-1 rounded-lg border border-[#40503f] bg-[#142014] px-2.5 py-1.5 text-[10px] font-black uppercase tracking-[0.08em] text-[#c5f94d] transition hover:border-[#c5f94d] disabled:cursor-not-allowed disabled:opacity-50"><RefreshCw className="h-3.5 w-3.5" aria-hidden />Restore template</button></div>
                  <label className="mt-4 grid gap-2 text-sm font-bold text-[#dce8d7]"><span className="sr-only">Tournament rules content</span><textarea name="rules" value={rules} onChange={(event) => setRules(event.target.value)} minLength={10} maxLength={10_000} rows={14} required className={`${controlClass} min-h-64 resize-y font-mono text-xs leading-relaxed ${fieldErrors.rules ? "border-[#c76a56] focus:border-[#ff9e87]" : ""}`} placeholder="Choose a game to load its tournament rules." aria-invalid={Boolean(fieldErrors.rules)} aria-describedby={fieldErrors.rules ? "create-rules-error" : "rules-help"} />{fieldErrors.rules && <span id="create-rules-error" className="text-xs font-bold text-[#ffad9a]">{fieldErrors.rules}</span>}<span id="rules-help" className="text-xs font-medium leading-relaxed text-[#748173]">{selectedGame ? `${selectedGame.name} rules load automatically and remain editable before publishing.` : "Select an active game to load its editable rules template."}</span></label>
                </fieldset>
              </div>

              <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-[#2a352b] bg-[#0a100b]/95 px-4 py-3 backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-4">
                <p className="hidden max-w-xl text-xs leading-relaxed text-[#7e8c7d] lg:block">All fields are validated again by the server before the event is saved.</p>
                <div className="flex w-full gap-2 sm:ml-auto sm:w-auto"><button type="button" onClick={closeCreateModal} disabled={pending} className="velox-muted-button min-h-11 flex-1 px-5 sm:flex-none">Cancel</button><button disabled={pending || activeGames.length === 0} type="submit" className="velox-action min-h-11 flex-1 px-5 sm:flex-none">{pending ? <><LoaderCircle className="mr-2 h-4 w-4 animate-spin" aria-hidden />Creating…</> : <><Plus className="mr-2 h-4 w-4" aria-hidden />Create tournament</>}</button></div>
              </div>
            </form>
          </div>
        </div>
      )}

      {editingTournament && <TournamentEditor tournament={editingTournament} games={games} onClose={() => setEditingTournament(null)} />}

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
              <div className="mt-4 grid grid-cols-2 gap-2 border-y border-[#29342a] py-3 text-center sm:grid-cols-4">
                <Stat label="Entries" value={tournament._count.registrations} icon={<Users className="h-3.5 w-3.5" aria-hidden />} />
                <Stat label="Checked in" value={tournament.registrations.length} icon={<Trophy className="h-3.5 w-3.5" aria-hidden />} />
                <Stat label="Matches" value={tournament._count.matches} icon={<Swords className="h-3.5 w-3.5" aria-hidden />} />
                <Stat label="Starts" value={formatDate(tournament.startDate)} icon={<CalendarDays className="h-3.5 w-3.5" aria-hidden />} />
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
                <select aria-label={`Status for ${tournament.title}`} defaultValue={tournament.status} disabled={pending || !manualStatusChoices(tournament.status).some((status) => status !== tournament.status)} onChange={(event) => { if (event.target.value !== tournament.status) void execute(() => setTournamentStatus({ tournamentId: tournament.id, status: event.target.value }), "Tournament status updated."); }} className={`${controlClass} py-2.5 text-xs font-bold`}>{manualStatusChoices(tournament.status).map((status) => <option key={status} value={status}>{labelFor(status)}</option>)}</select>
                <Link href={`/admin/tournaments/${tournament.id}`} className="velox-muted-button px-3 py-2.5 text-xs"><Users className="mr-1.5 h-4 w-4 text-[#c5f94d]" aria-hidden />Players</Link>
                <button type="button" onClick={() => { setEditingTournament(tournament); setShowCreate(false); }} disabled={pending || ["CANCELLED", "COMPLETED"].includes(tournament.status)} className="velox-muted-button px-3 py-2.5 text-xs"><Pencil className="mr-1.5 h-4 w-4 text-[#c5f94d]" aria-hidden />Edit</button>
                {tournament.status === "REGISTRATION_CLOSED" && <button type="button" onClick={() => void execute(() => openTournamentCheckIn(tournament.id), "Check-in is open and confirmed players were notified.")} disabled={pending} className="velox-muted-button px-3 py-2.5 text-xs"><Trophy className="mr-1.5 h-4 w-4 text-[#c5f94d]" aria-hidden />Open check-in</button>}
                {tournament.format === "SINGLE_ELIMINATION" && tournament.status === "UPCOMING" && <button type="button" onClick={() => void execute(() => generateSingleEliminationBracket(tournament.id), "Single-elimination bracket generated.")} disabled={pending} className="velox-muted-button px-3 py-2.5 text-xs"><Swords className="mr-1.5 h-4 w-4 text-[#c5f94d]" aria-hidden />Generate bracket</button>}
                {tournament.status === "DRAFT" && <button type="button" onClick={() => { if (window.confirm(`Delete the empty draft “${tournament.title}”? This cannot be undone.`)) void execute(() => deleteTournament(tournament.id), "Draft tournament deleted."); }} disabled={pending} className="rounded-2xl border border-[#75453b] bg-[#2a1918] px-3 py-2.5 text-xs font-black text-[#ffad9a] transition hover:border-[#b9624f] hover:bg-[#3a211e] disabled:cursor-not-allowed disabled:opacity-50"><Trash2 className="mr-1.5 h-4 w-4" aria-hidden />Delete draft</button>}
                <button type="button" onClick={() => { if (window.confirm("Cancel this tournament and refund eligible Telegram Stars payments? This cannot be undone.")) void execute(() => cancelTournamentAndRefund(tournament.id), "Tournament cancelled."); }} disabled={pending || tournament.status === "CANCELLED"} className="rounded-2xl border border-[#75453b] bg-[#2a1918] px-3 py-2.5 text-xs font-black text-[#ffad9a] transition hover:border-[#b9624f] hover:bg-[#3a211e] disabled:cursor-not-allowed disabled:opacity-50">Cancel & refund</button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

function FormSection({ eyebrow, title, detail, children }: { eyebrow: string; title: string; detail: string; children: React.ReactNode }) {
  return <fieldset className="rounded-2xl border border-[#2a382b] bg-[#101711] p-4 sm:p-5"><legend className="sr-only">{title}</legend><div><p className="velox-eyebrow">{eyebrow}</p><h3 className="mt-1 text-base font-black text-white">{title}</h3><p className="mt-1 text-xs leading-relaxed text-[#7f8d7d]">{detail}</p></div><div className="mt-4 grid gap-4 sm:grid-cols-2">{children}</div></fieldset>;
}

function Input({ name, label, className = "", error, ...props }: InputHTMLAttributes<HTMLInputElement> & { name: string; label: string; error?: string }) {
  const errorId = `create-${name}-error`;
  return <label className={`grid gap-2 text-sm font-bold text-[#dce8d7] ${className}`}><span>{label}</span><input name={name} {...props} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} className={`${controlClass} ${error ? "border-[#c76a56] focus:border-[#ff9e87]" : ""}`} />{error && <span id={errorId} className="text-xs font-bold text-[#ffad9a]">{error}</span>}</label>;
}

function Select({ name, label, children, error, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { name: string; label: string; children: React.ReactNode; error?: string }) {
  const errorId = `create-${name}-error`;
  return <label className="grid gap-2 text-sm font-bold text-[#dce8d7]"><span>{label}</span><select name={name} {...props} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} className={`${controlClass} ${error ? "border-[#c76a56] focus:border-[#ff9e87]" : ""}`}>{children}</select>{error && <span id={errorId} className="text-xs font-bold text-[#ffad9a]">{error}</span>}</label>;
}

function DateTimeInput({ name, label, error }: { name: string; label: string; error?: string }) {
  const errorId = `create-${name}-error`;
  return <label className="grid gap-2 text-sm font-bold text-[#dce8d7]"><span>{label}</span><span className="relative"><CalendarDays className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#c5f94d]" aria-hidden /><input name={name} type="datetime-local" required aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} className={`${controlClass} [color-scheme:dark] pl-10 ${error ? "border-[#c76a56] focus:border-[#ff9e87]" : ""}`} /></span>{error ? <span id={errorId} className="text-xs font-bold text-[#ffad9a]">{error}</span> : <span className="text-xs font-medium text-[#748173]">Choose a date and time with the calendar picker.</span>}</label>;
}

function validateTournamentForm(form: FormData, rules: string): TournamentFieldErrors {
  const errors: TournamentFieldErrors = {};
  const title = String(form.get("title") ?? "").trim();
  const gameId = String(form.get("gameId") ?? "");
  const participantType = String(form.get("participantType") ?? "");
  const region = String(form.get("region") ?? "").trim();
  const gameMode = String(form.get("gameMode") ?? "").trim();
  const prizePool = Number(form.get("prizePool"));
  const entryFee = Number(form.get("entryFee"));
  const maxParticipants = Number(form.get("maxParticipants"));
  const teamSize = Number(form.get("teamSize"));
  const checkInPeriodMins = Number(form.get("checkInPeriodMins"));
  const registrationDeadline = new Date(String(form.get("registrationDeadline") ?? ""));
  const startDate = new Date(String(form.get("startDate") ?? ""));

  if (title.length < 3) errors.title = "Enter a tournament title with at least 3 characters.";
  else if (title.length > 140) errors.title = "Tournament titles cannot exceed 140 characters.";
  if (!gameId) errors.gameId = "Select an active game.";
  if (!["INDIVIDUAL", "TEAM"].includes(participantType)) errors.participantType = "Select a valid entry type.";
  if (!Number.isInteger(prizePool) || prizePool < 0 || prizePool > 10_000_000) errors.prizePool = "Enter a whole prize amount between 0 and 10,000,000 XTR.";
  if (!Number.isInteger(entryFee) || entryFee < 0 || entryFee > 100_000) errors.entryFee = "Enter a whole entry fee between 0 and 100,000 XTR.";
  if (form.get("isPaid") === "on" && entryFee < 1) errors.entryFee = "Paid tournaments require an entry fee of at least 1 XTR.";
  if (form.get("isPaid") !== "on" && entryFee !== 0) errors.entryFee = "Free tournaments must use an entry fee of 0 XTR.";
  if (!Number.isInteger(maxParticipants) || maxParticipants < 2 || maxParticipants > 10_000) errors.maxParticipants = "Maximum entries must be a whole number between 2 and 10,000.";
  if (!Number.isInteger(teamSize) || teamSize < 1 || teamSize > 20) errors.teamSize = "Roster size must be a whole number between 1 and 20.";
  else if (participantType === "INDIVIDUAL" && teamSize !== 1) errors.teamSize = "Individual tournaments must use a roster size of 1.";
  else if (participantType === "TEAM" && teamSize < 2) errors.teamSize = "Team tournaments require at least 2 players per roster.";
  if (!Number.isInteger(checkInPeriodMins) || checkInPeriodMins < 5 || checkInPeriodMins > 1_440) errors.checkInPeriodMins = "Check-in must be between 5 minutes and 24 hours.";
  if (Number.isNaN(registrationDeadline.getTime())) errors.registrationDeadline = "Select when registration closes.";
  if (Number.isNaN(startDate.getTime())) errors.startDate = "Select when the tournament starts.";
  if (!errors.registrationDeadline && !errors.startDate && registrationDeadline >= startDate) errors.registrationDeadline = "Registration must close before the tournament starts.";
  if (region.length > 80) errors.region = "Region cannot exceed 80 characters.";
  if (gameMode.length > 100) errors.gameMode = "Game mode cannot exceed 100 characters.";
  if (rules.trim().length < 10) errors.rules = "Tournament rules must contain at least 10 characters.";
  else if (rules.length > 10_000) errors.rules = "Tournament rules cannot exceed 10,000 characters.";
  return errors;
}

function manualStatusChoices(status: string) {
  if (status === "DRAFT") return ["DRAFT", "REGISTRATION_OPEN"];
  if (status === "REGISTRATION_OPEN") return ["REGISTRATION_OPEN", "DRAFT", "REGISTRATION_CLOSED"];
  return [status];
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
