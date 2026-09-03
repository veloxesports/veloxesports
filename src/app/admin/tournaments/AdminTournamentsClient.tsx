"use client";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  CircleAlert,
  Gamepad2,
  Pencil,
  Plus,
  RefreshCw,
  Swords,
  Trash2,
  Trophy,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  cancelTournamentAndRefund,
  createGame,
  deleteTournament,
  openTournamentCheckIn,
  runTournamentLifecycleManually,
  setGameActive,
  setTournamentStatus,
} from "@/features/admin/actions";
import { generateSingleEliminationBracket } from "@/features/matches/actions";
import { TournamentModal, type Game, type Tournament } from "./TournamentModal";

const controlClass =
  "w-full rounded-2xl border border-[#344335] bg-[#080d09] px-3.5 py-3 text-sm text-white outline-none transition placeholder:text-[#6f796f] focus:border-[#c5f94d] focus:ring-2 focus:ring-[#c5f94d]/15 disabled:cursor-not-allowed disabled:opacity-60";

export function AdminTournamentsClient({
  games,
  tournaments,
}: {
  games: Game[];
  tournaments: Tournament[];
}) {
  const router = useRouter();
  const createTriggerRef = useRef<HTMLButtonElement>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [editingTournament, setEditingTournament] = useState<Tournament | null>(null);
  const [showGame, setShowGame] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(null), 4_500);
    return () => window.clearTimeout(timer);
  }, [message]);

  function openCreateModal() {
    setEditingTournament(null);
    setShowCreate(true);
  }

  function handleModalClose() {
    setShowCreate(false);
    setEditingTournament(null);
    window.setTimeout(() => createTriggerRef.current?.focus(), 0);
  }

  async function execute(
    action: () => Promise<{ success: boolean; error?: string; warning?: string }>,
    successMessage: string
  ) {
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
    const success = await execute(
      () => createGame({ name: form.get("name"), slug: form.get("slug") }),
      "Game added to the tournament catalog."
    );
    if (success) {
      event.currentTarget.reset();
      setShowGame(false);
    }
  }

  return (
    <main className="velox-page">
      <header className="flex items-start gap-3">
        <Link
          href="/admin"
          className="velox-muted-button flex h-10 w-10 shrink-0 p-0"
          aria-label="Back to Command Center"
        >
          <ChevronLeft className="h-5 w-5" aria-hidden />
        </Link>
        <div>
          <p className="velox-eyebrow">Event operations</p>
          <h1 className="mt-1 text-2xl font-black tracking-[-0.04em] text-white sm:text-3xl">
            Tournament control
          </h1>
          <p className="mt-1 text-sm leading-relaxed text-[#8e998f]">
            Create events, manage the game roster, brackets, and safe manual lifecycle changes.
          </p>
        </div>
      </header>

      <section className="mt-6 grid gap-3 sm:grid-cols-3">
        <button
          ref={createTriggerRef}
          type="button"
          onClick={openCreateModal}
          className="velox-action min-h-12"
          aria-haspopup="dialog"
        >
          <Plus className="mr-2 h-4 w-4" aria-hidden />
          Create tournament
        </button>
        <button
          type="button"
          onClick={() => setShowGame((value) => !value)}
          className="velox-muted-button min-h-12"
        >
          <Gamepad2 className="mr-2 h-4 w-4 text-[#c5f94d]" aria-hidden />
          {showGame ? "Close game form" : "Add a game"}
        </button>
        <button
          type="button"
          onClick={() => {
            if (
              window.confirm(
                "Run the tournament lifecycle now? This applies every due step, including player notifications, brackets, live matches, completed events, and eligible prize rewards."
              )
            ) {
              void execute(runTournamentLifecycleManually, "Manual lifecycle run finished.");
            }
          }}
          disabled={pending}
          className="velox-muted-button min-h-12"
        >
          <RefreshCw className="mr-2 h-4 w-4 text-[#c5f94d]" aria-hidden />
          {pending ? "Running…" : "Run lifecycle now"}
        </button>
      </section>
      <p className="mt-3 text-xs leading-relaxed text-[#748173]">
        VELOX does not run tournament automation on a schedule. Use this control whenever you are ready
        to advance all events that are currently due. Individual check-in controls remain available on each
        tournament.
      </p>

      {error && !showCreate && !editingTournament && <Notice tone="error" message={error} />}
      {message && (
        <div
          role="status"
          aria-live="polite"
          className="fixed right-4 top-20 z-[90] flex max-w-[calc(100vw-2rem)] items-start gap-3 rounded-2xl border border-[#55783e] bg-[#172417]/95 px-4 py-3 text-sm font-bold text-[#e8ffd0] shadow-[0_18px_55px_rgba(0,0,0,0.5)] backdrop-blur-xl sm:right-6"
        >
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#c5f94d]" aria-hidden />
          <span>{message}</span>
          <button
            type="button"
            onClick={() => setMessage(null)}
            className="ml-1 text-[#8fa287] transition hover:text-white"
            aria-label="Dismiss notification"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
      )}

      {showGame && (
        <form onSubmit={handleGame} className="velox-card mt-4 p-5">
          <p className="velox-eyebrow">Catalog</p>
          <h2 className="mt-1 text-lg font-black text-white">Add a playable game</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="grid gap-2 text-sm font-bold text-[#dce8d7]">
              <span>Game name</span>
              <input
                name="name"
                placeholder="Rocket League"
                required
                className={controlClass}
              />
            </label>
            <label className="grid gap-2 text-sm font-bold text-[#dce8d7]">
              <span>URL slug</span>
              <input
                name="slug"
                placeholder="rocket-league"
                required
                className={controlClass}
              />
            </label>
          </div>
          <button
            disabled={pending}
            type="submit"
            className="velox-action mt-4 w-full sm:w-auto"
          >
            {pending ? "Saving…" : "Save game"}
          </button>
        </form>
      )}

      {/* Unified Tournament Popup Modal for Create & Edit */}
      {showCreate && (
        <TournamentModal
          key="create"
          isOpen={showCreate}
          mode="create"
          games={games}
          onClose={handleModalClose}
          onSuccess={(msg) => {
            handleModalClose();
            setMessage(msg);
            router.refresh();
          }}
        />
      )}

      {editingTournament && (
        <TournamentModal
          key={`edit-${editingTournament.id}`}
          isOpen={Boolean(editingTournament)}
          mode="edit"
          tournament={editingTournament}
          games={games}
          onClose={handleModalClose}
          onSuccess={(msg) => {
            handleModalClose();
            setMessage(msg);
            router.refresh();
          }}
        />
      )}

      <section className="mt-7">
        <SectionHeading
          eyebrow="Catalog"
          title="Games"
          detail={`${games.length} configured`}
        />
        <div className="velox-card mt-3 divide-y divide-[#29342a] overflow-hidden">
          {games.length === 0 ? (
            <Empty
              icon={<Gamepad2 className="h-8 w-8" aria-hidden />}
              title="No games configured"
              detail="Add the first game before creating a tournament."
            />
          ) : (
            games.map((game) => (
              <div
                key={game.id}
                className="flex items-center justify-between gap-3 px-5 py-4"
              >
                <div className="min-w-0">
                  <p className="truncate font-black text-white">{game.name}</p>
                  <p className="mt-0.5 text-xs text-[#718071]">/{game.slug}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`hidden rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-[0.08em] sm:block ${
                      game.isActive
                        ? "bg-[#20331b] text-[#c5f94d]"
                        : "bg-[#262d27] text-[#a4aea3]"
                    }`}
                  >
                    {game.isActive ? "Active" : "Hidden"}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      void execute(
                        () => setGameActive({ gameId: game.id, isActive: !game.isActive }),
                        game.isActive
                          ? "Game hidden from player discovery."
                          : "Game restored to player discovery."
                      )
                    }
                    disabled={pending}
                    className="velox-muted-button px-3 py-2 text-xs"
                  >
                    {game.isActive ? "Deactivate" : "Activate"}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="mt-7">
        <SectionHeading
          eyebrow="Operating queue"
          title="Tournaments"
          detail={`${tournaments.length} total`}
        />
        <div className="mt-3 grid gap-3">
          {tournaments.length === 0 ? (
            <div className="velox-card">
              <Empty
                icon={<Trophy className="h-8 w-8" aria-hidden />}
                title="No tournaments yet"
                detail="Create your first event to populate the operating queue."
              />
            </div>
          ) : (
            tournaments.map((tournament) => (
              <article key={tournament.id} className="velox-card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/admin/tournaments/${tournament.id}`}
                      className="text-lg font-black text-white transition hover:text-[#c5f94d]"
                    >
                      {tournament.title}
                    </Link>
                    <p className="mt-1 text-xs font-bold uppercase tracking-[0.08em] text-[#8e998f]">
                      {tournament.game.name} · {labelFor(tournament.format)}
                    </p>
                  </div>
                  <StatusBadge value={tournament.status} />
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2 border-y border-[#29342a] py-3 text-center sm:grid-cols-4">
                  <Stat
                    label="Entries"
                    value={tournament._count?.registrations ?? tournament.currentParticipants ?? 0}
                    icon={<Users className="h-3.5 w-3.5" aria-hidden />}
                  />
                  <Stat
                    label="Checked in"
                    value={tournament.registrations?.length ?? 0}
                    icon={<Trophy className="h-3.5 w-3.5" aria-hidden />}
                  />
                  <Stat
                    label="Matches"
                    value={tournament._count?.matches ?? 0}
                    icon={<Swords className="h-3.5 w-3.5" aria-hidden />}
                  />
                  <Stat
                    label="Starts"
                    value={formatDate(tournament.startDate)}
                    icon={<CalendarDays className="h-3.5 w-3.5" aria-hidden />}
                  />
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
                  <select
                    aria-label={`Status for ${tournament.title}`}
                    defaultValue={tournament.status}
                    disabled={
                      pending ||
                      !manualStatusChoices(tournament.status).some(
                        (status) => status !== tournament.status
                      )
                    }
                    onChange={(event) => {
                      if (event.target.value !== tournament.status) {
                        void execute(
                          () =>
                            setTournamentStatus({
                              tournamentId: tournament.id,
                              status: event.target.value,
                            }),
                          "Tournament status updated."
                        );
                      }
                    }}
                    className={`${controlClass} py-2.5 text-xs font-bold`}
                  >
                    {manualStatusChoices(tournament.status).map((status) => (
                      <option key={status} value={status}>
                        {labelFor(status)}
                      </option>
                    ))}
                  </select>
                  <Link
                    href={`/admin/tournaments/${tournament.id}`}
                    className="velox-muted-button px-3 py-2.5 text-xs"
                  >
                    <Users className="mr-1.5 h-4 w-4 text-[#c5f94d]" aria-hidden />
                    Players
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreate(false);
                      setEditingTournament(tournament);
                    }}
                    disabled={
                      pending || ["CANCELLED", "COMPLETED"].includes(tournament.status)
                    }
                    className="velox-muted-button px-3 py-2.5 text-xs"
                  >
                    <Pencil className="mr-1.5 h-4 w-4 text-[#c5f94d]" aria-hidden />
                    Edit
                  </button>
                  {tournament.status === "REGISTRATION_CLOSED" && (
                    <button
                      type="button"
                      onClick={() =>
                        void execute(
                          () => openTournamentCheckIn(tournament.id),
                          "Check-in is open and confirmed players were notified."
                        )
                      }
                      disabled={pending}
                      className="velox-muted-button px-3 py-2.5 text-xs"
                    >
                      <Trophy className="mr-1.5 h-4 w-4 text-[#c5f94d]" aria-hidden />
                      Open check-in
                    </button>
                  )}
                  {tournament.format === "SINGLE_ELIMINATION" &&
                    tournament.status === "UPCOMING" && (
                      <button
                        type="button"
                        onClick={() =>
                          void execute(
                            () => generateSingleEliminationBracket(tournament.id),
                            "Single-elimination bracket generated."
                          )
                        }
                        disabled={pending}
                        className="velox-muted-button px-3 py-2.5 text-xs"
                      >
                        <Swords className="mr-1.5 h-4 w-4 text-[#c5f94d]" aria-hidden />
                        Generate bracket
                      </button>
                    )}
                  {tournament.status === "DRAFT" && (
                    <button
                      type="button"
                      onClick={() => {
                        if (
                          window.confirm(
                            `Delete the empty draft “${tournament.title}”? This cannot be undone.`
                          )
                        ) {
                          void execute(
                            () => deleteTournament(tournament.id),
                            "Draft tournament deleted."
                          );
                        }
                      }}
                      disabled={pending}
                      className="rounded-2xl border border-[#75453b] bg-[#2a1918] px-3 py-2.5 text-xs font-black text-[#ffad9a] transition hover:border-[#b9624f] hover:bg-[#3a211e] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Trash2 className="mr-1.5 h-4 w-4" aria-hidden />
                      Delete draft
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      if (
                        window.confirm(
                          "Cancel this tournament and refund eligible Telegram Stars payments? This cannot be undone."
                        )
                      ) {
                        void execute(
                          () => cancelTournamentAndRefund(tournament.id),
                          "Tournament cancelled."
                        );
                      }
                    }}
                    disabled={pending || tournament.status === "CANCELLED"}
                    className="rounded-2xl border border-[#75453b] bg-[#2a1918] px-3 py-2.5 text-xs font-black text-[#ffad9a] transition hover:border-[#b9624f] hover:bg-[#3a211e] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Cancel & refund
                  </button>
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </main>
  );
}

function manualStatusChoices(status: string) {
  if (status === "DRAFT") return ["DRAFT", "REGISTRATION_OPEN"];
  if (status === "REGISTRATION_OPEN") return ["REGISTRATION_OPEN", "DRAFT", "REGISTRATION_CLOSED"];
  return [status];
}

function Notice({ tone, message }: { tone: "error" | "success"; message: string }) {
  return (
    <p
      role="status"
      className={`mt-4 flex items-start gap-2 rounded-2xl border px-4 py-3 text-sm font-medium ${
        tone === "error"
          ? "border-[#87493d] bg-[#2b1d19] text-[#ffb1a0]"
          : "border-[#496b38] bg-[#182716] text-[#d8f5b3]"
      }`}
    >
      <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      {message}
    </p>
  );
}

function SectionHeading({
  eyebrow,
  title,
  detail,
}: {
  eyebrow: string;
  title: string;
  detail: string;
}) {
  return (
    <div className="flex items-end justify-between gap-3">
      <div>
        <p className="velox-eyebrow">{eyebrow}</p>
        <h2 className="mt-1 text-xl font-black text-white">{title}</h2>
      </div>
      <p className="text-xs font-bold uppercase tracking-[0.08em] text-[#8e998f]">{detail}</p>
    </div>
  );
}

function Empty({
  icon,
  title,
  detail,
}: {
  icon: React.ReactNode;
  title: string;
  detail: string;
}) {
  return (
    <div className="px-5 py-10 text-center text-[#526052]">
      <span className="inline-flex">{icon}</span>
      <p className="mt-3 font-black text-white">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-sm leading-relaxed text-[#8e998f]">{detail}</p>
    </div>
  );
}

function StatusBadge({ value }: { value: string }) {
  const isLive = value === "LIVE";
  const isReady = ["REGISTRATION_OPEN", "UPCOMING", "CHECK_IN"].includes(value);
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em] ${
        isLive
          ? "bg-[#253a1d] text-[#c5f94d]"
          : isReady
          ? "bg-[#1b2b1a] text-[#bfeb74]"
          : "bg-[#242b25] text-[#a4aea3]"
      }`}
    >
      {labelFor(value)}
    </span>
  );
}

function Stat({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
}) {
  return (
    <div>
      <span className="mx-auto flex w-fit items-center gap-1 text-[#8e998f]">
        {icon}
        <span className="text-[10px] font-black uppercase tracking-[0.08em]">{label}</span>
      </span>
      <p className="mt-1 truncate text-sm font-black text-white">{value}</p>
    </div>
  );
}

function labelFor(value: string) {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(
    new Date(value)
  );
}
