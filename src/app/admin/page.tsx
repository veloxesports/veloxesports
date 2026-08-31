import { Activity, ArrowUpRight, Calendar, ChevronRight, CreditCard, Gamepad2, LogOut, ShieldAlert, Swords, Trophy, Users } from "lucide-react";
import Link from "next/link";
import { getAdminStats } from "@/features/admin/actions";
import { getAdminAnalytics } from "@/features/admin/insights";
import { AdminAnalytics } from "./AdminAnalytics";

export default async function AdminDashboard() {
  const [result, analyticsResult] = await Promise.all([getAdminStats(), getAdminAnalytics()]);

  if (!result.success || !result.data) {
    return (
      <main className="velox-page flex flex-col items-center justify-center text-center">
        <ShieldAlert className="h-12 w-12 text-red-300" aria-hidden />
        <p className="mt-4 text-xl font-black text-white">Command Center unavailable</p>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-[#8e998f]">{result.error ?? "Unable to load the command center."}</p>
        <Link href="/" className="velox-muted-button mt-6">Return to VELOX</Link>
      </main>
    );
  }

  const stats = result.data;

  return (
    <main className="velox-page">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="velox-eyebrow">VELOX / Operations</p>
          <h1 className="mt-2 text-3xl font-black tracking-[-0.05em] text-white sm:text-4xl">Command Center</h1>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-[#8e998f]">Monitor the competitive platform and act on the work that needs your team.</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link href="/" className="velox-muted-button px-3 py-2.5 text-xs" aria-label="Open the player experience">
            Player app <ArrowUpRight className="ml-1.5 h-3.5 w-3.5" aria-hidden />
          </Link>
          <form action="/api/admin/auth/logout" method="post">
            <button type="submit" className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[#2a352b] bg-[#131b14] text-[#aeb8ad] transition hover:border-[#6c7d5a] hover:text-white" aria-label="Sign out of the Command Center">
              <LogOut className="h-4 w-4" aria-hidden />
            </button>
          </form>
        </div>
      </header>

      <section className="relative mt-7 overflow-hidden rounded-[28px] border border-[#415d32] bg-[#182714] p-5 shadow-[0_18px_45px_rgba(0,0,0,0.22)] sm:p-7">
        <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full border-[36px] border-[#355124] opacity-70" aria-hidden />
        <div className="absolute bottom-0 right-10 h-px w-40 bg-[#c5f94d]/45" aria-hidden />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="inline-flex items-center gap-2 rounded-lg bg-[#263b1b] px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.14em] text-[#c5f94d]"><Activity className="h-3.5 w-3.5" aria-hidden /> Platform pulse</p>
            <p className="mt-5 text-2xl font-black uppercase tracking-[-0.04em] text-white sm:text-3xl">Ready for match day.</p>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-[#b6c5ac]">A single view of player growth, active events, financial review, and moderation workload.</p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:min-w-64">
            <Pulse value={stats.matchesNeedingAttention} label="Match desk" />
            <Pulse value={stats.pendingDisputes} label="Open disputes" priority={stats.pendingDisputes > 0} />
          </div>
        </div>
      </section>

      <section className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Platform metrics">
        <Kpi href="/admin/insights/players" icon={<Users className="h-5 w-5" aria-hidden />} label="Players" value={stats.totalUsers} detail="Platform accounts" />
        <Kpi href="/admin/insights/active-players" icon={<Activity className="h-5 w-5" aria-hidden />} label="Active players" value={stats.activeUsers} detail="Seen in the last 30 days" />
        <Kpi href="/admin/insights/tournaments" icon={<Trophy className="h-5 w-5" aria-hidden />} label="Tournaments" value={stats.totalTournaments} detail={`${stats.activeTournaments} in the operating queue`} />
        <Kpi href="/admin/insights/live-events" icon={<Swords className="h-5 w-5" aria-hidden />} label="Live events" value={stats.liveTournaments} detail="Currently competing" />
        <Kpi href="/admin/insights/confirmed-entries" icon={<Activity className="h-5 w-5" aria-hidden />} label="Confirmed entries" value={stats.registrations} detail="Competition ready" />
        <Kpi href="/admin/insights/verified-stars" icon={<CreditCard className="h-5 w-5" aria-hidden />} label="Verified Stars" value={stats.totalPaymentStars} detail="Completed Telegram payments" amount />
        <Kpi href="/admin/insights/refunded-stars" icon={<CreditCard className="h-5 w-5" aria-hidden />} label="Refunded Stars" value={stats.totalRefundStars} detail="Completed refund value" amount warning={stats.totalRefundStars > 0} />
        <Kpi href="/admin/insights/prize-rewards" icon={<Trophy className="h-5 w-5" aria-hidden />} label="Prize rewards" value={stats.tournamentRewardStars} detail="Completed player rewards" amount />
      </section>

      {analyticsResult.success ? <AdminAnalytics data={analyticsResult.data} /> : <section className="velox-card mt-7 p-5"><p className="velox-eyebrow">Platform intelligence</p><p className="mt-2 font-black text-white">Analytics temporarily unavailable</p><p className="mt-1 text-sm text-[#8e998f]">{analyticsResult.error}</p></section>}

      <section className="mt-7 grid gap-5 lg:grid-cols-[1.28fr_0.72fr]">
        <div className="velox-card overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-[#29342a] px-5 py-4">
            <div>
              <p className="text-lg font-black text-white">Active events</p>
              <p className="mt-0.5 text-xs text-[#8e998f]">The next tournaments in your operating queue.</p>
            </div>
            <Link href="/admin/tournaments" className="inline-flex shrink-0 items-center gap-1 text-xs font-black uppercase tracking-[0.1em] text-[#c5f94d] hover:text-[#d5ff70]">Manage <ChevronRight className="h-4 w-4" aria-hidden /></Link>
          </div>
          {stats.activeEvents.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <Gamepad2 className="mx-auto h-8 w-8 text-[#526052]" aria-hidden />
              <p className="mt-3 font-bold text-white">No active events</p>
              <p className="mt-1 text-sm text-[#8e998f]">Create a tournament to begin operating a new competition.</p>
              <Link href="/admin/tournaments" className="velox-action mt-5">Create tournament</Link>
            </div>
          ) : (
            <div className="divide-y divide-[#29342a]">
              {stats.activeEvents.map((event) => (
                <Link key={event.id} href={`/admin/tournaments/${event.id}`} className="group flex items-center gap-3 px-5 py-4 transition hover:bg-[#172117]">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#1f3119] text-[#c5f94d]"><Trophy className="h-5 w-5" aria-hidden /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-black text-white">{event.title}</span>
                    <span className="mt-1 block truncate text-xs text-[#8e998f]">{event.game.name} · {event.currentParticipants}/{event.maxParticipants} registered</span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-[10px] font-black uppercase tracking-[0.1em] text-[#c5f94d]">{labelFor(event.status)}</span>
                    <span className="mt-1 inline-flex items-center gap-1 text-xs text-[#8e998f]"><Calendar className="h-3.5 w-3.5" aria-hidden />{formatEventDate(event.startDate)}</span>
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>

        <aside className="grid gap-3">
          <PriorityCard
            href="/admin/disputes"
            icon={<ShieldAlert className="h-5 w-5" aria-hidden />}
            eyebrow="Moderator queue"
            title={stats.pendingDisputes === 0 ? "No open disputes" : `${stats.pendingDisputes} dispute${stats.pendingDisputes === 1 ? "" : "s"} need review`}
            description={stats.pendingDisputes === 0 ? "The match desk is clear. Keep an eye on reports as live events continue." : "Review evidence and resolve the outcome with a complete audit trail."}
            critical={stats.pendingDisputes > 0}
          />
          <PriorityCard
            href="/admin/finance"
            icon={<CreditCard className="h-5 w-5" aria-hidden />}
            eyebrow="Finance desk"
            title={stats.pendingPayments === 0 && stats.pendingTransactions === 0 ? "Payments reconciled" : `${stats.pendingPayments + stats.pendingTransactions} finance item${stats.pendingPayments + stats.pendingTransactions === 1 ? "" : "s"} pending`}
            description={stats.pendingPayments === 0 && stats.pendingTransactions === 0 ? "No Telegram Stars payments or wallet transactions are waiting for review." : "Check payment status and resolve supported refund requests."}
            critical={stats.pendingPayments + stats.pendingTransactions > 0}
          />
          <EventLifecycle total={stats.totalTournaments} counts={stats.tournamentStatusCounts} />
        </aside>
      </section>

      <section className="mt-7">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="velox-eyebrow">Latest activity</p>
            <h2 className="mt-1 text-xl font-black text-white">Wallet ledger</h2>
          </div>
          <Link href="/admin/finance" className="inline-flex items-center gap-1 text-xs font-black uppercase tracking-[0.1em] text-[#c5f94d] hover:text-[#d5ff70]">Finance desk <ChevronRight className="h-4 w-4" aria-hidden /></Link>
        </div>
        <div className="velox-card mt-3 overflow-hidden">
          {stats.recentTransactions.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-[#8e998f]">No wallet activity has been recorded yet.</p>
          ) : (
            <div className="divide-y divide-[#29342a]">
              {stats.recentTransactions.map((transaction) => {
                const player = transaction.wallet.user.profile?.veloxUsername ?? transaction.wallet.user.username ?? transaction.wallet.user.firstName ?? "VELOX player";
                const description = transaction.tournament?.title ?? transaction.description ?? labelFor(transaction.type);
                return (
                  <Link key={transaction.id} href="/admin/finance" className="group flex items-center gap-3 px-5 py-4 transition hover:bg-[#172117]">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#1d281d] text-xs font-black text-[#c5f94d]">{player.slice(0, 1).toUpperCase()}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-white">{player}</span>
                      <span className="mt-0.5 block truncate text-xs text-[#8e998f]">{description}</span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block text-sm font-black text-white">⭐ {transaction.amount.toLocaleString()}</span>
                      <span className="mt-0.5 block text-[10px] font-bold uppercase tracking-[0.08em] text-[#8e998f]">{labelFor(transaction.status)}</span>
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <section className="mt-7 grid gap-5 lg:grid-cols-2">
        <ActivityList
          eyebrow="Player movement"
          title="Recent registrations"
          empty="No registrations have been recorded yet."
          items={stats.recentRegistrations.map((registration) => ({
            id: registration.id,
            name: playerName(registration.user),
            detail: `${registration.tournament.title} · ${registration.tournament.game.name}`,
            timestamp: registration.createdAt,
            status: labelFor(registration.status),
          }))}
        />
        <ActivityList
          eyebrow="Audit trail"
          title="Recent admin activity"
          empty="No administrative actions have been recorded yet."
          items={stats.recentActivity.map((activity) => ({
            id: activity.id,
            name: playerName(activity.admin),
            detail: `${labelFor(activity.action)} · ${activity.entity}`,
            timestamp: activity.createdAt,
            status: "Recorded",
          }))}
        />
      </section>

      <section className="mt-7 grid gap-3 sm:grid-cols-3" aria-label="Administrative tools">
        <AdminLink href="/admin/tournaments" icon={<Trophy className="h-5 w-5" aria-hidden />} title="Tournaments" description="Games, brackets, events, and safe cancellations." />
        <AdminLink href="/admin/finance" icon={<CreditCard className="h-5 w-5" aria-hidden />} title="Finance" description="Telegram Stars payments, refunds, and reconciliation." />
        <AdminLink href="/admin/disputes" icon={<Swords className="h-5 w-5" aria-hidden />} title="Disputes" description="Evidence-led moderation and outcome resolution." />
      </section>
    </main>
  );
}

function Kpi({ href, icon, label, value, detail, warning = false, amount = false }: { href: string; icon: React.ReactNode; label: string; value: number; detail: string; warning?: boolean; amount?: boolean }) {
  return (
    <Link href={href} className="velox-card block p-4 transition hover:-translate-y-0.5 hover:border-[#5e7b4b] hover:bg-[#162016] sm:p-5" aria-label={`View ${label.toLowerCase()} data`}>
      <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${warning ? "bg-[#3b2720] text-[#ff9d85]" : "bg-[#1f3119] text-[#c5f94d]"}`}>{icon}</span>
      <p className="mt-4 text-2xl font-black tracking-[-0.04em] text-white">{amount ? "⭐ " : ""}{value.toLocaleString()}</p>
      <p className="mt-1 text-[11px] font-black uppercase tracking-[0.11em] text-[#c3ceb9]">{label}</p>
      <p className="mt-1 text-xs text-[#718072]">{detail}</p>
    </Link>
  );
}

function Pulse({ value, label, priority = false }: { value: number; label: string; priority?: boolean }) {
  return <div className={`rounded-2xl border px-3 py-3 ${priority ? "border-[#a4503f]/70 bg-[#32211c]" : "border-[#4a633b] bg-[#172216]/90"}`}><p className={`text-xl font-black ${priority ? "text-[#ffad97]" : "text-[#c5f94d]"}`}>{value.toLocaleString()}</p><p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.09em] text-[#a6b49c]">{label}</p></div>;
}

function PriorityCard({ href, icon, eyebrow, title, description, critical = false }: { href: string; icon: React.ReactNode; eyebrow: string; title: string; description: string; critical?: boolean }) {
  return (
    <Link href={href} className={`rounded-[24px] border p-5 transition hover:-translate-y-0.5 ${critical ? "border-[#91463b] bg-[#251817] hover:border-[#c36551]" : "border-[#2f4530] bg-[#121b12] hover:border-[#587546]"}`}>
      <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${critical ? "bg-[#4a2722] text-[#ff9d85]" : "bg-[#1f3119] text-[#c5f94d]"}`}>{icon}</span>
      <p className={`mt-4 text-[10px] font-black uppercase tracking-[0.12em] ${critical ? "text-[#ffad97]" : "text-[#c5f94d]"}`}>{eyebrow}</p>
      <p className="mt-1 text-lg font-black leading-tight text-white">{title}</p>
      <p className="mt-2 text-sm leading-relaxed text-[#9eaa9d]">{description}</p>
      <span className={`mt-4 inline-flex items-center gap-1 text-xs font-black uppercase tracking-[0.1em] ${critical ? "text-[#ffad97]" : "text-[#c5f94d]"}`}>Open queue <ChevronRight className="h-4 w-4" aria-hidden /></span>
    </Link>
  );
}

function EventLifecycle({ total, counts }: { total: number; counts: Array<{ status: string; _count: { _all: number } }> }) {
  const states = ["REGISTRATION_OPEN", "UPCOMING", "CHECK_IN", "LIVE", "COMPLETED"];
  const countFor = (status: string) => counts.find((entry) => entry.status === status)?._count._all ?? 0;

  return (
    <div className="rounded-[24px] border border-[#2f4530] bg-[#121b12] p-5">
      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#c5f94d]">Competition mix</p>
      <p className="mt-1 text-lg font-black text-white">Tournament lifecycle</p>
      <div className="mt-4 space-y-3">
        {states.map((status) => {
          const count = countFor(status);
          const percentage = total === 0 ? 0 : Math.round((count / total) * 100);
          return (
            <div key={status}>
              <div className="flex items-center justify-between gap-3 text-xs"><span className="font-bold text-[#b8c5b0]">{labelFor(status)}</span><span className="font-black text-white">{count}</span></div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#263126]"><div className="h-full rounded-full bg-[#c5f94d]" style={{ width: `${percentage}%` }} /></div>
            </div>
          );
        })}
      </div>
      <p className="mt-4 border-t border-[#29342a] pt-3 text-xs text-[#849384]">{total.toLocaleString()} tournament{total === 1 ? "" : "s"} in the VELOX archive.</p>
    </div>
  );
}

function ActivityList({ eyebrow, title, empty, items }: { eyebrow: string; title: string; empty: string; items: Array<{ id: string; name: string; detail: string; timestamp: Date; status: string }> }) {
  return (
    <div className="velox-card overflow-hidden">
      <div className="border-b border-[#29342a] px-5 py-4"><p className="velox-eyebrow">{eyebrow}</p><h2 className="mt-1 text-lg font-black text-white">{title}</h2></div>
      {items.length === 0 ? <p className="px-5 py-10 text-center text-sm text-[#8e998f]">{empty}</p> : <div className="divide-y divide-[#29342a]">{items.map((item) => <div key={item.id} className="flex items-center gap-3 px-5 py-3.5"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#1d281d] text-xs font-black text-[#c5f94d]">{item.name.slice(0, 1).toUpperCase()}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold text-white">{item.name}</span><span className="mt-0.5 block truncate text-xs text-[#8e998f]">{item.detail}</span></span><span className="shrink-0 text-right"><span className="block text-[10px] font-black uppercase tracking-[0.08em] text-[#c5f94d]">{item.status}</span><span className="mt-1 block text-[10px] text-[#718072]">{formatActivityDate(item.timestamp)}</span></span></div>)}</div>}
    </div>
  );
}

function AdminLink({ href, icon, title, description }: { href: string; icon: React.ReactNode; title: string; description: string }) {
  return (
    <Link href={href} className="group rounded-2xl border border-[#2a352b] bg-[#111811] p-4 transition hover:border-[#577246] hover:bg-[#162016]">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1f3119] text-[#c5f94d]">{icon}</span>
      <p className="mt-4 flex items-center justify-between gap-2 font-black text-white">{title}<ChevronRight className="h-4 w-4 text-[#c5f94d] transition group-hover:translate-x-0.5" aria-hidden /></p>
      <p className="mt-1 text-sm leading-relaxed text-[#8e998f]">{description}</p>
    </Link>
  );
}

function labelFor(value: string) {
  return value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function playerName(user: { username: string | null; firstName: string | null; profile: { veloxUsername: string | null } | null }) {
  return user.profile?.veloxUsername ?? user.username ?? user.firstName ?? "VELOX player";
}

function formatEventDate(value: Date) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(value);
}

function formatActivityDate(value: Date) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(value);
}
