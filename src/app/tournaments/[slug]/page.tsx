import { CalendarDays, ChevronLeft, CircleDollarSign, Gamepad2, Info, ShieldCheck, Users } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTournamentBySlug } from "@/features/tournaments/actions";

export default async function TournamentDetailsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const result = await getTournamentBySlug(slug);
  if (!result.success || !result.data) notFound();

  const tournament = result.data;
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

      <section className="velox-card mt-6 flex items-start gap-3 p-5"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#1f3119] text-[#c5f94d]"><ShieldCheck className="h-5 w-5" aria-hidden /></span><p className="text-sm leading-relaxed text-[#aeb8ad]">Registration is confirmed only after VELOX verifies your entry. Telegram Stars payments are never collected outside Telegram.</p></section>

      <div className="fixed inset-x-0 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-40 px-5 sm:px-8">
        <div className="mx-auto w-full max-w-3xl rounded-2xl bg-[#080d09]/90 p-1.5 backdrop-blur">
          {registrationOpen ? <Link href={`/tournaments/${tournament.slug}/register`} className="velox-action w-full text-base">{registrationLabel}</Link> : <span className="flex w-full items-center justify-center rounded-2xl border border-[#2f3930] bg-[#151c15] px-4 py-3 text-sm font-black text-[#788477]">{registrationLabel}</span>}
        </div>
      </div>
    </main>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div className="velox-card min-w-0 p-4"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1f3119] text-[#c5f94d]">{icon}</span><p className="mt-3 text-[10px] font-black uppercase tracking-[0.1em] text-[#8e998f]">{label}</p><p className="mt-1 truncate text-sm font-black text-white">{value}</p></div>;
}

function StatusBadge({ value }: { value: string }) {
  const styles: Record<string, string> = { REGISTRATION_OPEN: "bg-[#263c1c] text-[#d4ff76]", LIVE: "bg-[#3a211e] text-[#ffad9a]", CANCELLED: "bg-[#3a211e] text-[#ffad9a]", CHECK_IN: "bg-[#392f1c] text-[#f0cf78]" };
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
