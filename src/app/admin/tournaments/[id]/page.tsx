import { CalendarDays, ChevronLeft, CircleDollarSign, Gamepad2, ShieldCheck, Users } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdminTournamentDetail } from "@/features/admin/insights";

export default async function AdminTournamentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getAdminTournamentDetail(id);
  if (!result.success) {
    if (result.error === "Tournament not found.") notFound();
    return <Unavailable message={result.error} />;
  }

  const { data: tournament } = result;
  return (
    <main className="velox-page">
      <header className="flex items-start gap-3">
        <Link href="/admin/tournaments" className="velox-muted-button flex h-10 w-10 shrink-0 p-0" aria-label="Back to tournament control"><ChevronLeft className="h-5 w-5" aria-hidden /></Link>
        <div>
          <p className="velox-eyebrow">Tournament roster</p>
          <h1 className="mt-1 text-2xl font-black tracking-[-0.04em] text-white sm:text-3xl">{tournament.title}</h1>
          <p className="mt-1 text-sm leading-relaxed text-[#8e998f]">{tournament.game.name} · {labelFor(tournament.format)}{tournament.gameMode ? ` · ${tournament.gameMode}` : ""}</p>
        </div>
      </header>

      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={<Users className="h-5 w-5" aria-hidden />} label="Registrations" value={`${tournament._count.registrations}/${tournament.maxParticipants}`} />
        <Stat icon={<ShieldCheck className="h-5 w-5" aria-hidden />} label="Confirmed" value={tournament.registrations.filter((registration) => registration.status === "CONFIRMED").length} />
        <Stat icon={<CalendarDays className="h-5 w-5" aria-hidden />} label="Tournament starts" value={formatShortDate(tournament.startDate)} />
        <Stat icon={<CircleDollarSign className="h-5 w-5" aria-hidden />} label={tournament.isPaid ? "Entry fee" : "Prize pool"} value={`⭐ ${(tournament.isPaid ? tournament.entryFee : tournament.prizePool).toLocaleString()}`} />
      </section>

      <section className="velox-card mt-6 overflow-hidden">
        <div className="border-b border-[#29342a] bg-[radial-gradient(circle_at_95%_0%,rgba(197,249,77,0.1),transparent_32%)] px-5 py-5"><div className="flex items-start justify-between gap-3"><div><p className="velox-eyebrow">Player roster</p><h2 className="mt-1 text-xl font-black text-white">Registered players</h2></div><StatusBadge value={tournament.status} /></div><p className="mt-2 text-sm text-[#8e998f]">Registrations are listed newest first. Confirmed players and check-ins are marked below.</p></div>
        {tournament.registrations.length === 0 ? <div className="px-5 py-12 text-center"><Users className="mx-auto h-9 w-9 text-[#526052]" aria-hidden /><p className="mt-3 font-black text-white">No registered players yet</p><p className="mt-1 text-sm text-[#8e998f]">Player registrations will appear here as they are created.</p></div> : <div className="divide-y divide-[#29342a]">{tournament.registrations.map((registration) => { const name = registration.user.profile?.veloxUsername ?? registration.user.username ?? registration.user.firstName ?? "VELOX player"; return <article key={registration.id} className="flex items-center gap-3 px-5 py-4"><Avatar imageUrl={registration.user.profileImage} label={name} /><div className="min-w-0 flex-1"><p className="truncate font-black text-white">{name}</p><p className="mt-1 truncate text-xs text-[#8e998f]">{registration.team ? `Team ${registration.team.name}` : registration.user.profile ? `${labelFor(registration.user.profile.rank)} · Level ${registration.user.profile.level}` : "Individual player"}</p></div><div className="shrink-0 text-right"><StatusBadge value={registration.status} /><p className={`mt-1 text-[10px] font-black uppercase tracking-[0.08em] ${registration.checkedIn ? "text-[#c5f94d]" : "text-[#718071]"}`}>{registration.checkedIn ? "Checked in" : "Not checked in"}</p><p className="mt-1 text-[10px] text-[#718071]">{formatShortDate(registration.createdAt)}</p></div></article>; })}</div>}
      </section>
    </main>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return <div className="velox-card p-5"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1f3119] text-[#c5f94d]">{icon}</span><p className="mt-4 text-[11px] font-black uppercase tracking-[0.1em] text-[#c3ceb9]">{label}</p><p className="mt-1 truncate text-xl font-black tracking-[-0.04em] text-white">{value}</p></div>;
}

function Avatar({ imageUrl, label }: { imageUrl: string | null; label: string }) {
  return imageUrl ? <img src={imageUrl} alt="" className="h-10 w-10 shrink-0 rounded-xl border border-[#40503e] object-cover" /> : <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#1f3119] text-sm font-black text-[#c5f94d]">{label.slice(0, 1).toUpperCase()}</span>;
}

function StatusBadge({ value }: { value: string }) {
  const styles: Record<string, string> = { CONFIRMED: "bg-[#20331b] text-[#c5f94d]", LIVE: "bg-[#20331b] text-[#c5f94d]", REGISTRATION_OPEN: "bg-[#20331b] text-[#c5f94d]", PENDING: "bg-[#392f1c] text-[#f0cf78]", CANCELLED: "bg-[#3b211e] text-[#ffad9a]" };
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em] ${styles[value] ?? "bg-[#242b25] text-[#a4aea3]"}`}>{labelFor(value)}</span>;
}

function Unavailable({ message }: { message: string }) {
  return <main className="velox-page flex flex-col items-center justify-center text-center"><Gamepad2 className="h-11 w-11 text-[#526052]" aria-hidden /><h1 className="mt-4 text-2xl font-black text-white">Tournament roster unavailable</h1><p className="mt-2 max-w-sm text-sm leading-relaxed text-[#8e998f]">{message}</p><Link href="/admin/tournaments" className="velox-muted-button mt-6"><ChevronLeft className="mr-1.5 h-4 w-4" aria-hidden />Back to Tournament Control</Link></main>;
}

function formatShortDate(value: Date) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(value);
}

function labelFor(value: string) {
  return value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}
