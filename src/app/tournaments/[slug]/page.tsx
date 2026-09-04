import { CalendarDays, ChevronLeft, CircleDollarSign, ExternalLink, Gamepad2, Info, ShieldCheck, Swords, Trophy, Users } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTournamentBySlug, getTournamentCheckInState } from "@/features/tournaments/actions";
import { TournamentCheckInCard } from "./TournamentCheckInCard";

export default async function TournamentDetailsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const result = await getTournamentBySlug(slug);
  if (!result.success || !result.data) notFound();

  const tournament = result.data;
  const checkInResult = tournament.status === "CHECK_IN" ? await getTournamentCheckInState(tournament.id) : null;
  const registrationOpen = tournament.status === "REGISTRATION_OPEN";
  const registrationLabel = registrationOpen
    ? tournament.isPaid ? `Join · ⭐ ${tournament.entryFee.toLocaleString()}` : "Join tournament"
    : tournament.status === "LIVE" ? "Tournament is live" : tournament.status === "CANCELLED" ? "Tournament cancelled" : "Registration closed";

  return (
    <main className="velox-page pb-40">
      <header className="flex items-start gap-3">
        <Link href="/tournaments" className="velox-muted-button flex h-10 w-10 shrink-0 p-0" aria-label="Back to tournaments"><ChevronLeft className="h-5 w-5" aria-hidden /></Link>
        <div className="min-w-0">
          <p className="velox-eyebrow">Tournament briefing</p>
          <h1 className="mt-1 truncate text-2xl font-black tracking-[-0.04em] text-white sm:text-3xl">{tournament.title}</h1>
          <p className="mt-1 text-sm text-[#8e998f]">{tournament.game.name} · {labelFor(tournament.format)}{tournament.region ? ` · ${tournament.region}` : ""}</p>
        </div>
      </header>

      <section className="relative mt-6 overflow-hidden rounded-[28px] border border-[#405d31] bg-[#182714] p-5 shadow-[0_18px_45px_rgba(0,0,0,0.22)] sm:p-7">
        <div className="absolute -right-16 -top-24 h-64 w-64 rounded-full border-[44px] border-[#355124] opacity-75" aria-hidden />
        <div className="absolute bottom-0 right-12 h-px w-36 bg-[#c5f94d]/45" aria-hidden />
        <div className="relative">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="inline-flex items-center gap-2 rounded-lg bg-[#263b1b] px-3 py-2 text-[11px] font-black uppercase tracking-[0.13em] text-[#c5f94d]"><Gamepad2 className="h-4 w-4" aria-hidden />{tournament.game.name}</span>
            <StatusBadge value={tournament.status} />
          </div>
          <p className="mt-8 max-w-[20ch] text-3xl font-black uppercase leading-[0.94] tracking-[-0.05em] text-white sm:text-4xl">{tournament.title}</p>
          <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.16em] text-[#bdc8b6]">Build your run. Play for the prize.</p>
          <div className="mt-8 flex flex-wrap items-end justify-between gap-5">
            <div><p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#bdc8b6]">Prize pool</p><p className="mt-1 text-4xl font-black tracking-[-0.06em] text-[#c5f94d]">⭐ {tournament.prizePool.toLocaleString()}</p></div>
            <p className="rounded-2xl border border-[#4c663d] bg-[#13200f]/85 px-4 py-3 text-sm font-black text-white">{tournament.isPaid ? `⭐ ${tournament.entryFee.toLocaleString()} entry` : "Free entry"}</p>
          </div>
        </div>
      </section>

      <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat icon={<Users className="h-5 w-5" aria-hidden />} label="Players" value={`${tournament.currentParticipants}/${tournament.maxParticipants}`} />
        <Stat icon={<CalendarDays className="h-5 w-5" aria-hidden />} label="Starts" value={formatDate(tournament.startDate)} />
        <Stat icon={<CalendarDays className="h-5 w-5" aria-hidden />} label="Closes" value={formatDate(tournament.registrationDeadline)} />
        <Stat icon={<CircleDollarSign className="h-5 w-5" aria-hidden />} label="Entry" value={tournament.isPaid ? `⭐ ${tournament.entryFee.toLocaleString()}` : "Free"} />
      </section>

      {tournament.status === "CHECK_IN" && <TournamentCheckInCard tournamentId={tournament.id} state={checkInResult?.success ? checkInResult.data : null} />}

      {tournament.prizes.length > 0 && (
        <section className="velox-card mt-6 overflow-hidden">
          <div className="border-b border-[#29342a] px-5 py-4"><p className="velox-eyebrow">Rewards</p><h2 className="mt-1 text-lg font-black text-white">Prize distribution</h2></div>
          <div className="divide-y divide-[#29342a]">{tournament.prizes.map((prize) => <div key={prize.id} className="flex items-center justify-between gap-3 px-5 py-4"><span className="font-bold text-[#dce8d7]">{placementLabel(prize.placement)}</span><span className="text-base font-black text-[#c5f94d]">⭐ {prize.amount.toLocaleString()}</span></div>)}</div>
        </section>
      )}

      <section className="velox-card mt-6 p-5">
        <div className="flex items-center gap-2"><Info className="h-5 w-5 text-[#c5f94d]" aria-hidden /><div><p className="velox-eyebrow">Rules</p><h2 className="mt-1 text-lg font-black text-white">Competition information</h2></div></div>
        <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-[#b8c5b0]">{tournament.rules?.content || "Standard VELOX competitive rules apply. All matches must be played fairly. Cheating will result in an immediate ban."}</p>
      </section>

      {tournament.status === "COMPLETED" && (
        <section className="velox-card mt-6 overflow-hidden border border-[#406830] bg-gradient-to-r from-[#172814] to-[#0f1b0e] p-5 shadow-lg">
          <div className="flex items-center gap-3.5">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-[#c5f94d]/40 bg-[#c5f94d]/15 text-[#c5f94d]">
              <Trophy className="h-6 w-6" aria-hidden />
            </span>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#c5f94d]">Tournament Concluded</p>
              <h2 className="text-base font-black text-white">Championship Completed</h2>
              <p className="text-xs text-[#9fb39c]">
                All fixtures are completed and prize rewards have been disbursed to winners.
              </p>
            </div>
          </div>
        </section>
      )}

      {["LIVE", "COMPLETED"].includes(tournament.status) && (
        <section className="velox-card mt-6 border border-[#c5f94d]/30 bg-[#162412] p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#c5f94d]/15 text-[#c5f94d]">
                <Swords className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-[#c5f94d]">Active Bracket</p>
                <h3 className="text-sm font-black text-white">Live Tournament Matches</h3>
                <p className="text-[11px] text-[#8e998f]">Track round fixtures, live scores, and brackets in real time.</p>
              </div>
            </div>
            <Link
              href="/matches"
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#c5f94d] px-4 py-2.5 text-xs font-black text-[#0f170d] transition hover:brightness-110"
            >
              <span>View Matches</span>
            </Link>
          </div>
        </section>
      )}

      {/* Official Discord Community & Match Arbitration */}
      <section className="velox-card mt-6 flex items-center justify-between p-5 border border-[#2e2b52] bg-[#0e1220]/70">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#5865F2]/20 text-[#5865F2]">
            <Gamepad2 className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <p className="text-xs font-black text-white">Official Tournament Discord</p>
            <p className="text-[11px] text-[#8e9ab8]">Match dispute arbitration, referee calls, and voice channels.</p>
          </div>
        </div>
        <a
          href="https://discord.gg/veloxesports"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-[#5865F2]/40 bg-[#5865F2]/15 px-3 py-2 text-xs font-black text-[#a5b4fc] transition hover:bg-[#5865F2]/25"
        >
          <span>Join Server</span>
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </section>

      <section className="velox-card mt-6 flex items-start gap-3 p-5"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#1f3119] text-[#c5f94d]"><ShieldCheck className="h-5 w-5" aria-hidden /></span><p className="text-sm leading-relaxed text-[#aeb8ad]">Registration is confirmed only after VELOX verifies your entry. Telegram Stars payments are never collected outside Telegram.</p></section>

      <div className="mt-6">
        {registrationOpen ? <Link href={`/tournaments/${tournament.slug}/register`} className="velox-action w-full text-base">{registrationLabel}</Link> : <span className="flex w-full items-center justify-center rounded-2xl border border-[#2f3930] bg-[#151c15] px-4 py-3 text-sm font-black text-[#788477]">{registrationLabel}</span>}
      </div>

      {registrationOpen && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-[#29342a] bg-[#0c120b]/95 p-3.5 backdrop-blur-md sm:hidden" style={{ paddingBottom: "max(0.875rem, env(safe-area-inset-bottom, 0.875rem))" }}>
          <div className="mx-auto flex max-w-md items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-wider text-[#8e998f]">Entry Fee</p>
              <p className="text-sm font-black text-[#c5f94d]">{tournament.isPaid ? `⭐ ${tournament.entryFee.toLocaleString()}` : "Free"}</p>
            </div>
            <Link href={`/tournaments/${tournament.slug}/register`} className="velox-action flex-1 py-3 text-center text-sm">
              {registrationLabel}
            </Link>
          </div>
        </div>
      )}
    </main>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div className="velox-card min-w-0 p-4"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1f3119] text-[#c5f94d]">{icon}</span><p className="mt-3 text-[10px] font-black uppercase tracking-[0.1em] text-[#8e998f]">{label}</p><p className="mt-1 truncate text-sm font-black text-white">{value}</p></div>;
}

function StatusBadge({ value }: { value: string }) {
  const styles: Record<string, string> = {
    REGISTRATION_OPEN: "bg-[#263c1c] text-[#d4ff76]",
    LIVE: "bg-[#3a211e] text-[#ffad9a]",
    CANCELLED: "bg-[#3a211e] text-[#ffad9a]",
    CHECK_IN: "bg-[#392f1c] text-[#f0cf78]",
    COMPLETED: "bg-[#18291a] text-[#7ef088] border border-[#2b4c2a]",
  };
  return <span className={`rounded-lg px-3 py-2 text-[10px] font-black uppercase tracking-[0.11em] ${styles[value] ?? "bg-[#202820] text-[#b7c0b5]"}`}>{labelFor(value)}</span>;
}

function placementLabel(placement: number) {
  if (placement === 1) return "🥇 1st place";
  if (placement === 2) return "🥈 2nd place";
  if (placement === 3) return "🥉 3rd place";
  return `${placement}th place`;
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(value));
}

function labelFor(value: string) {
  return value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}
