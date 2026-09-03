"use client";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type InputHTMLAttributes,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import {
  CalendarDays,
  CircleAlert,
  LoaderCircle,
  Plus,
  RefreshCw,
  Save,
  X,
} from "lucide-react";
import { createTournament, updateTournament } from "@/features/admin/actions";
import { getTournamentRulesTemplate } from "@/lib/tournaments/rule-templates";

export type Game = { id: string; name: string; slug: string; isActive: boolean };

export type Tournament = {
  id: string;
  title: string;
  status: string;
  format: string;
  participantType: "INDIVIDUAL" | "TEAM";
  teamSize: number;
  isPaid: boolean;
  entryFee: number;
  prizePool: number;
  maxParticipants: number;
  currentParticipants?: number;
  registrationDeadline: Date;
  startDate: Date;
  region: string | null;
  gameMode: string | null;
  game: { id: string; name: string };
  rules: { content: string; checkInPeriodMins: number } | null;
  registrations?: { id: string }[];
  _count?: { registrations: number; matches: number };
};

export type TournamentModalProps = {
  isOpen: boolean;
  mode: "create" | "edit";
  tournament?: Tournament | null;
  games: Game[];
  onClose: () => void;
  onSuccess: (message: string) => void;
};

const formats = ["SINGLE_ELIMINATION"];
const participantTypes = ["INDIVIDUAL", "TEAM"];
const initialStatuses = ["DRAFT", "REGISTRATION_OPEN"];
const controlClass =
  "w-full rounded-2xl border border-[#344335] bg-[#080d09] px-3.5 py-3 text-sm text-white outline-none transition placeholder:text-[#6f796f] focus:border-[#c5f94d] focus:ring-2 focus:ring-[#c5f94d]/15 disabled:cursor-not-allowed disabled:opacity-60";

type TournamentFieldErrors = Record<string, string>;

export function TournamentModal({
  isOpen,
  mode,
  tournament,
  games,
  onClose,
  onSuccess,
}: TournamentModalProps) {
  const isEdit = mode === "edit" && Boolean(tournament);
  const activeGames = games.filter((game) => game.isActive);

  const dialogRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<TournamentFieldErrors>({});

  const initialGameId = isEdit
    ? tournament!.game.id
    : activeGames[0]?.id ?? games[0]?.id ?? "";
  const [selectedGameId, setSelectedGameId] = useState(initialGameId);

  const defaultRules = isEdit
    ? tournament!.rules?.content ?? "Standard VELOX competitive rules apply."
    : (() => {
        const found = activeGames.find((g) => g.id === initialGameId) ?? games[0];
        return found ? getTournamentRulesTemplate(found) : "";
      })();
  const [rules, setRules] = useState(defaultRules);

  const selectedGame = games.find((g) => g.id === selectedGameId);

  // Trap body scrolling and autofocus first input when modal opens
  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusTimer = window.setTimeout(() => {
      (formRef.current?.elements.namedItem("title") as HTMLElement | null)?.focus();
    }, 50);

    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  function handleDialogKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      if (!pending) onClose();
      return;
    }
    if (event.key !== "Tab") return;

    const focusable = Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
      ) ?? []
    );
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
    const game = games.find((candidate) => candidate.id === gameId);
    setSelectedGameId(gameId);
    if (game) {
      setRules(getTournamentRulesTemplate(game));
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);

    const nextFieldErrors = validateTournamentForm(form, rules);
    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors);
      setError("Review the highlighted fields before submitting.");
      const firstInvalidField = Object.keys(nextFieldErrors)[0];
      window.setTimeout(
        () => (formElement.elements.namedItem(firstInvalidField) as HTMLElement | null)?.focus(),
        0
      );
      return;
    }

    const registrationDeadline = new Date(String(form.get("registrationDeadline")));
    const startDate = new Date(String(form.get("startDate")));

    if (Number.isNaN(registrationDeadline.getTime()) || Number.isNaN(startDate.getTime())) {
      setError("Select both the registration deadline and tournament start date from the calendar picker.");
      return;
    }

    setPending(true);
    setError(null);

    try {
      if (isEdit && tournament) {
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
          participantType: form.get("participantType"),
          teamSize: form.get("teamSize"),
          region: form.get("region"),
          gameMode: form.get("gameMode"),
          rules,
          checkInPeriodMins: form.get("checkInPeriodMins"),
        });

        if (!result.success) {
          setError(result.error ?? "We couldn't update this tournament.");
          setPending(false);
          return;
        }

        onSuccess(`Tournament “${String(form.get("title"))}” updated successfully.`);
      } else {
        const result = await createTournament({
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
        });

        if (!result.success) {
          setError(result.error ?? "We couldn't create this tournament.");
          setPending(false);
          return;
        }

        onSuccess(`Tournament “${String(form.get("title"))}” created and added to the operating queue.`);
      }
    } catch {
      setError("The request could not be completed. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  const modalTitle = isEdit
    ? `Update ${tournament!.title}`
    : "Create tournament";
  const modalEyebrow = isEdit ? "Tournament editor" : "New competition";
  const modalDescription = isEdit
    ? "Player registrations protect game, format, and payment settings. Bracketed tournaments also lock schedule and capacity."
    : "Configure the event, schedule, entry model, and game-specific rules.";

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-[#020503]/80 p-2 backdrop-blur-[6px] sm:p-5"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !pending) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tournament-modal-title"
        aria-describedby="tournament-modal-description"
        onKeyDown={handleDialogKeyDown}
        className="flex max-h-[calc(100dvh-1rem)] w-full max-w-5xl flex-col overflow-hidden rounded-[26px] border border-[#40563a] bg-[#0d140e] shadow-[0_32px_100px_rgba(0,0,0,0.72)] sm:max-h-[calc(100dvh-2.5rem)]"
      >
        <form
          ref={formRef}
          onSubmit={handleSubmit}
          noValidate
          className="flex min-h-0 flex-1 flex-col"
          onInput={(event) => {
            const fieldName = (event.target as HTMLInputElement).name;
            setError(null);
            if (fieldName && fieldErrors[fieldName]) {
              setFieldErrors((current) => {
                const next = { ...current };
                delete next[fieldName];
                return next;
              });
            }
          }}
        >
          {/* Header */}
          <div className="flex shrink-0 items-start justify-between gap-4 border-b border-[#2a352b] bg-[radial-gradient(circle_at_90%_0%,rgba(197,249,77,0.16),transparent_35%)] px-5 py-4 sm:px-6 sm:py-5">
            <div>
              <p className="velox-eyebrow">{modalEyebrow}</p>
              <h2
                id="tournament-modal-title"
                className="mt-1 text-xl font-black tracking-[-0.03em] text-white sm:text-2xl"
              >
                {modalTitle}
              </h2>
              <p
                id="tournament-modal-description"
                className="mt-1 text-xs leading-relaxed text-[#8e998f] sm:text-sm"
              >
                {modalDescription}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={pending}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[#344335] bg-[#111a12] text-[#a9b4a6] transition hover:border-[#76965f] hover:text-white disabled:opacity-50"
              aria-label="Close modal"
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
          </div>

          {/* Body (Scrollable) */}
          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-4 py-5 sm:px-6">
            {error && (
              <p
                role="alert"
                className="flex items-start gap-2 rounded-2xl border border-[#87493d] bg-[#2b1d19] px-4 py-3 text-sm font-medium text-[#ffb1a0]"
              >
                <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                {error}
              </p>
            )}

            {/* Section 1: Event Identity */}
            <FormSection
              eyebrow="Competition"
              title="Event identity"
              detail="Choose what players will see in discovery and brackets."
            >
              <Input
                name="title"
                label="Tournament title"
                placeholder="Nightfall Championship"
                defaultValue={isEdit ? tournament!.title : ""}
                className="sm:col-span-2"
                error={fieldErrors.title}
                required
              />
              <Select
                name="gameId"
                label="Game"
                value={selectedGameId}
                onChange={(event) => loadRulesForGame(event.target.value)}
                error={fieldErrors.gameId}
                required
              >
                {games.length === 0 && <option value="">No games configured</option>}
                {games.map((game) => (
                  <option
                    key={game.id}
                    value={game.id}
                    disabled={!game.isActive && (!isEdit || game.id !== tournament!.game.id)}
                  >
                    {game.name}
                    {!game.isActive ? " (inactive)" : ""}
                  </option>
                ))}
              </Select>
              <label className="grid gap-2 text-sm font-bold text-[#dce8d7]">
                <span>Format</span>
                <select
                  name="format"
                  defaultValue={isEdit ? tournament!.format : "SINGLE_ELIMINATION"}
                  className={controlClass}
                >
                  {formats.map((format) => (
                    <option key={format} value={format}>
                      {labelFor(format)}
                    </option>
                  ))}
                  {isEdit && tournament!.format !== "SINGLE_ELIMINATION" && (
                    <option value={tournament!.format}>
                      {labelFor(tournament!.format)} (legacy)
                    </option>
                  )}
                </select>
                <span className="text-xs font-medium leading-relaxed text-[#748173]">
                  Single elimination enables automatic brackets, progression, and prizes.
                </span>
              </label>
              <Input
                name="gameMode"
                label="Game mode"
                placeholder="1v1"
                defaultValue={isEdit ? tournament!.gameMode ?? "" : ""}
                error={fieldErrors.gameMode}
              />
              <Input
                name="region"
                label="Region"
                placeholder="Global"
                defaultValue={isEdit ? tournament!.region ?? "" : ""}
                error={fieldErrors.region}
              />
            </FormSection>

            {/* Section 2: Entry and Rewards */}
            <FormSection
              eyebrow="Participation"
              title="Entry and rewards"
              detail="Set capacity, roster requirements, entry pricing, and prizes."
            >
              <Select
                name="participantType"
                label="Entry type"
                defaultValue={isEdit ? tournament!.participantType : "INDIVIDUAL"}
                error={fieldErrors.participantType}
              >
                {participantTypes.map((type) => (
                  <option key={type} value={type}>
                    {type === "TEAM" ? "Team roster" : "Individual players"}
                  </option>
                ))}
              </Select>
              <Input
                name="teamSize"
                label="Required roster size"
                type="number"
                defaultValue={isEdit ? tournament!.teamSize : 1}
                min="1"
                max="20"
                error={fieldErrors.teamSize}
                required
              />
              <Input
                name="maxParticipants"
                label="Maximum entries"
                type="number"
                defaultValue={isEdit ? tournament!.maxParticipants : 16}
                min="2"
                max="10000"
                error={fieldErrors.maxParticipants}
                required
              />
              <Input
                name="prizePool"
                label="Prize pool (XTR)"
                type="number"
                defaultValue={isEdit ? tournament!.prizePool : 0}
                min="0"
                max="10000000"
                error={fieldErrors.prizePool}
                required
              />
              <Input
                name="entryFee"
                label="Entry fee (XTR)"
                type="number"
                defaultValue={isEdit ? tournament!.entryFee : 0}
                min="0"
                max="100000"
                error={fieldErrors.entryFee}
                required
              />
              <label className="flex items-center gap-3 rounded-2xl border border-[#344335] bg-[#131b14] px-4 py-3 text-sm font-bold text-[#dce8d7]">
                <input
                  name="isPaid"
                  type="checkbox"
                  defaultChecked={isEdit ? tournament!.isPaid : false}
                  className="h-4 w-4 accent-[#c5f94d]"
                />
                Paid tournament — collect the entry fee through Telegram Stars.
              </label>
            </FormSection>

            {/* Section 3: Schedule and Launch */}
            <FormSection
              eyebrow="Operations"
              title="Schedule and launch"
              detail="Registration must close before the tournament starts."
            >
              <DateTimeInput
                name="registrationDeadline"
                label="Registration closes"
                defaultValue={isEdit ? tournament!.registrationDeadline : undefined}
                error={fieldErrors.registrationDeadline}
              />
              <DateTimeInput
                name="startDate"
                label="Tournament starts"
                defaultValue={isEdit ? tournament!.startDate : undefined}
                error={fieldErrors.startDate}
              />
              <Input
                name="checkInPeriodMins"
                label="Check-in window (minutes)"
                type="number"
                defaultValue={isEdit ? tournament!.rules?.checkInPeriodMins ?? 60 : 60}
                min="5"
                max="1440"
                error={fieldErrors.checkInPeriodMins}
                required
              />
              {isEdit ? (
                <div className="grid gap-2 text-sm font-bold text-[#dce8d7]">
                  <span>Current status</span>
                  <div className="flex items-center gap-2.5 rounded-2xl border border-[#344335] bg-[#111812] px-3.5 py-3">
                    <span className="rounded-full bg-[#20331b] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-[#c5f94d]">
                      {labelFor(tournament!.status)}
                    </span>
                    <span className="text-xs text-[#8e998f]">
                      Status updates occur automatically or via action buttons.
                    </span>
                  </div>
                </div>
              ) : (
                <Select
                  name="status"
                  label="Initial status"
                  defaultValue="DRAFT"
                  error={fieldErrors.status}
                >
                  {initialStatuses.map((status) => (
                    <option key={status} value={status}>
                      {labelFor(status)}
                    </option>
                  ))}
                </Select>
              )}
            </FormSection>

            {/* Section 4: Governance / Rules */}
            <fieldset className="rounded-2xl border border-[#2a382b] bg-[#101711] p-4 sm:p-5">
              <legend className="sr-only">Tournament rules</legend>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="velox-eyebrow">Governance</p>
                  <h3 className="mt-1 text-base font-black text-white">Tournament rules</h3>
                </div>
                <button
                  type="button"
                  onClick={() => loadRulesForGame(selectedGameId)}
                  disabled={!selectedGame}
                  className="inline-flex items-center gap-1 rounded-lg border border-[#40503f] bg-[#142014] px-2.5 py-1.5 text-[10px] font-black uppercase tracking-[0.08em] text-[#c5f94d] transition hover:border-[#c5f94d] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                  Restore template
                </button>
              </div>
              <label className="mt-4 grid gap-2 text-sm font-bold text-[#dce8d7]">
                <span className="sr-only">Tournament rules content</span>
                <textarea
                  name="rules"
                  value={rules}
                  onChange={(event) => setRules(event.target.value)}
                  minLength={10}
                  maxLength={10_000}
                  rows={14}
                  required
                  className={`${controlClass} min-h-64 resize-y font-mono text-xs leading-relaxed ${
                    fieldErrors.rules ? "border-[#c76a56] focus:border-[#ff9e87]" : ""
                  }`}
                  placeholder="Choose a game to load its tournament rules."
                  aria-invalid={Boolean(fieldErrors.rules)}
                  aria-describedby={fieldErrors.rules ? "modal-rules-error" : "rules-help"}
                />
                {fieldErrors.rules && (
                  <span id="modal-rules-error" className="text-xs font-bold text-[#ffad9a]">
                    {fieldErrors.rules}
                  </span>
                )}
                <span
                  id="rules-help"
                  className="text-xs font-medium leading-relaxed text-[#748173]"
                >
                  {selectedGame
                    ? `${selectedGame.name} rules load automatically and remain editable before publishing.`
                    : "Select an active game to load its editable rules template."}
                </span>
              </label>
            </fieldset>
          </div>

          {/* Footer */}
          <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-[#2a352b] bg-[#0a100b]/95 px-4 py-3 backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-4">
            <p className="hidden max-w-xl text-xs leading-relaxed text-[#7e8c7d] lg:block">
              All fields are validated again by the server before changes are saved.
            </p>
            <div className="flex w-full gap-2 sm:ml-auto sm:w-auto">
              <button
                type="button"
                onClick={onClose}
                disabled={pending}
                className="velox-muted-button min-h-11 flex-1 px-5 sm:flex-none"
              >
                Cancel
              </button>
              <button
                disabled={pending || (!isEdit && activeGames.length === 0)}
                type="submit"
                className="velox-action min-h-11 flex-1 px-5 sm:flex-none"
              >
                {pending ? (
                  <>
                    <LoaderCircle className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                    {isEdit ? "Saving…" : "Creating…"}
                  </>
                ) : isEdit ? (
                  <>
                    <Save className="mr-2 h-4 w-4" aria-hidden />
                    Save changes
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4" aria-hidden />
                    Create tournament
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function FormSection({
  eyebrow,
  title,
  detail,
  children,
}: {
  eyebrow: string;
  title: string;
  detail: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="rounded-2xl border border-[#2a382b] bg-[#101711] p-4 sm:p-5">
      <legend className="sr-only">{title}</legend>
      <div>
        <p className="velox-eyebrow">{eyebrow}</p>
        <h3 className="mt-1 text-base font-black text-white">{title}</h3>
        <p className="mt-1 text-xs leading-relaxed text-[#7f8d7d]">{detail}</p>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

function Input({
  name,
  label,
  className = "",
  error,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  name: string;
  label: string;
  error?: string;
}) {
  const errorId = `modal-${name}-error`;
  return (
    <label className={`grid gap-2 text-sm font-bold text-[#dce8d7] ${className}`}>
      <span>{label}</span>
      <input
        name={name}
        {...props}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        className={`${controlClass} ${error ? "border-[#c76a56] focus:border-[#ff9e87]" : ""}`}
      />
      {error && (
        <span id={errorId} className="text-xs font-bold text-[#ffad9a]">
          {error}
        </span>
      )}
    </label>
  );
}

function Select({
  name,
  label,
  children,
  error,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & {
  name: string;
  label: string;
  children: React.ReactNode;
  error?: string;
}) {
  const errorId = `modal-${name}-error`;
  return (
    <label className="grid gap-2 text-sm font-bold text-[#dce8d7]">
      <span>{label}</span>
      <select
        name={name}
        {...props}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        className={`${controlClass} ${error ? "border-[#c76a56] focus:border-[#ff9e87]" : ""}`}
      >
        {children}
      </select>
      {error && (
        <span id={errorId} className="text-xs font-bold text-[#ffad9a]">
          {error}
        </span>
      )}
    </label>
  );
}

function DateTimeInput({
  name,
  label,
  defaultValue,
  error,
}: {
  name: string;
  label: string;
  defaultValue?: Date;
  error?: string;
}) {
  const errorId = `modal-${name}-error`;
  return (
    <label className="grid gap-2 text-sm font-bold text-[#dce8d7]">
      <span>{label}</span>
      <span className="relative">
        <CalendarDays
          className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#c5f94d]"
          aria-hidden
        />
        <input
          name={name}
          type="datetime-local"
          required
          defaultValue={defaultValue ? dateTimeLocal(defaultValue) : undefined}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          className={`${controlClass} [color-scheme:dark] pl-10 ${
            error ? "border-[#c76a56] focus:border-[#ff9e87]" : ""
          }`}
        />
      </span>
      {error ? (
        <span id={errorId} className="text-xs font-bold text-[#ffad9a]">
          {error}
        </span>
      ) : (
        <span className="text-xs font-medium text-[#748173]">
          Choose a date and time with the calendar picker.
        </span>
      )}
    </label>
  );
}

function dateTimeLocal(value: Date | string | null | undefined): string {
  if (!value) return "";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date);
  local.setMinutes(local.getMinutes() - local.getTimezoneOffset());
  return local.toISOString().slice(0, 16);
}

function labelFor(value: string) {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
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
