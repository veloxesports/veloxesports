import { ArrowUpRight, Bell, ChevronRight, Gamepad2, Trophy, Zap } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getTournaments } from "@/features/tournaments/actions";
import { getWalletSummary } from "@/features/wallet/services";

export default async function Home() {
  const [user, tournamentsResult, walletResult] = await Promise.all([
    getCurrentUser(),
    getTournaments({ status: "REGISTRATION_OPEN" }),
    getWalletSummary(),
  ]);
  const featuredTournament = tournamentsResult.success && tournamentsResult.data ? tournamentsResult.data[0] : undefined;
  const wallet = walletResult.success && walletResult.data ? walletResult.data.wallet : null;
  const profile = user?.profile;
  const displayName = profile?.veloxUsername || user?.username || user?.firstName || "Player";
  const totalMatches = (profile?.wins ?? 0) + (profile?.losses ?? 0);
  const winRate = totalMatches ? `${Math.round(((profile?.wins ?? 0) / totalMatches) * 100)}%` : "—";

  return (
    <main className="velox-page">
      <header className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-white">
            <span className="grid h-9 w-9 place-items-center rounded-sm bg-[#c5f94d] text-lg font-black tracking-tighter text-[#090d09]">{"//"}</span>
            <span className="text-xl font-black tracking-[0.24em]">VELOX</span>
          </div>
          <p className="mt-7 velox-eyebrow">Ready to compete</p>
          <h1 className="mt-2 text-3xl font-black tracking-[-0.045em] text-white sm:text-4xl">
            Welcome back, <span className="text-[#c5f94d]">{displayName}</span>
          </h1>
        </div>
        <Link href="/notifications" aria-label="Open notifications" className="mt-1 grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-[#2a352b] bg-[#111811] text-[#dce3d6] transition hover:border-[#c5f94d]/50 hover:text-[#c5f94d]">
          <Bell className="h-5 w-5" aria-hidden />
        </Link>
      </header>

      <section className="velox-card mt-7 grid grid-cols-3 divide-x divide-[#2a352b] px-1 py-4">
        <Stat label="Current rank" value={profile?.rank ?? "Unranked"} icon={<Trophy className="h-4 w-4" />} />
        <Stat label="Win rate" value={winRate} icon={<ArrowUpRight className="h-4 w-4" />} />
        <Stat label="XP level" value={String(profile?.level ?? 1)} icon={<Zap className="h-4 w-4" />} />
      </section>

      <section className="mt-9">
        <SectionHeader title="Featured tournament" href="/tournaments" label="Explore" />
        {featuredTournament ? (
          <article className="relative mt-4 overflow-hidden rounded-[28px] border border-[#38512e] bg-[#1d3518] p-6 shadow-[0_20px_50px_rgba(0,0,0,0.28)] sm:p-7">
            <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full border border-[#5f8947]/35 bg-[#2d5321]" />
            <div className="absolute -right-10 top-28 h-36 w-36 rounded-full border border-[#5f8947]/25" />
            <div className="relative flex items-center justify-between gap-4">
              <span className="inline-flex items-center gap-2 rounded-lg bg-[#2a4a1f] px-3 py-2 text-[11px] font-black uppercase tracking-[0.14em] text-[#d4ff76]">
                <Gamepad2 className="h-4 w-4" aria-hidden /> {featuredTournament.game.name}
              </span>
              <span className="inline-flex items-center gap-2 rounded-lg bg-[#101b0d]/70 px-3 py-2 text-[11px] font-black uppercase tracking-[0.13em] text-[#d4ff76]">
                <span className="h-2 w-2 rounded-full bg-[#c5f94d]" /> Open
              </span>
            </div>
            <h2 className="relative mt-8 max-w-[15ch] text-3xl font-black uppercase leading-[0.93] tracking-[-0.05em] text-white sm:text-4xl">
              {featuredTournament.title}
            </h2>
            <p className="relative mt-4 text-[11px] font-bold uppercase tracking-[0.16em] text-[#bdc8b6]">Your next battle starts here</p>
            <div className="relative mt-8 flex flex-wrap items-end justify-between gap-5">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#bdc8b6]">Prize pool</p>
                <p className="mt-1 text-4xl font-black tracking-[-0.06em] text-[#c5f94d]">⭐ {featuredTournament.prizePool}</p>
              </div>
              <Link href={`/tournaments/${featuredTournament.slug}/register`} className="velox-action min-w-[142px] gap-2">
                {featuredTournament.isPaid ? `Join · ⭐ ${featuredTournament.entryFee}` : "Join now"} <ArrowUpRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          </article>
        ) : (
          <div className="velox-card mt-4 p-6 text-center">
            <Gamepad2 className="mx-auto h-9 w-9 text-[#5a675b]" aria-hidden />
            <h2 className="mt-3 font-black text-white">New competition is on the way</h2>
            <p className="mt-1 text-sm text-[#8e998f]">Check back soon for the next open bracket.</p>
          </div>
        )}
      </section>

      <section className="mt-9">
        <SectionHeader title="Your VELOX activity" href="/wallet" label="Wallet" />
        <div className="velox-card mt-4 overflow-hidden">
          {wallet ? (
            <div className="divide-y divide-[#263128]">
              <ActivityRow label="Stars spent" value={`⭐ ${wallet.totalSpent}`} />
              <ActivityRow label="Tournament rewards" value={`+ ⭐ ${wallet.totalRewards}`} highlight />
              <ActivityRow label="Refunds" value={`+ ⭐ ${wallet.totalRefunds}`} highlight />
            </div>
          ) : (
            <p className="p-5 text-sm leading-relaxed text-[#8e998f]">Open VELOX in Telegram to view your verified tournament activity.</p>
          )}
        </div>
      </section>
    </main>
  );
}

function Stat({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return <div className="min-w-0 px-3 sm:px-5"><p className="truncate text-[9px] font-black uppercase tracking-[0.13em] text-[#899489]">{label}</p><p className="mt-2 flex items-center gap-1.5 truncate text-base font-black text-white sm:text-lg">{value}<span className="text-[#c5f94d]">{icon}</span></p></div>;
}

function SectionHeader({ title, href, label }: { title: string; href: string; label: string }) {
  return <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-black uppercase tracking-[0.06em] text-white">{title}</h2><Link href={href} className="inline-flex shrink-0 items-center gap-1 text-xs font-black uppercase tracking-[0.1em] text-[#c5f94d] hover:text-[#d5ff70]">{label}<ChevronRight className="h-4 w-4" aria-hidden /></Link></div>;
}

function ActivityRow({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return <div className="flex items-center justify-between gap-4 px-5 py-4"><span className="text-sm font-medium text-[#aeb8ad]">{label}</span><span className={`text-sm font-black ${highlight ? "text-[#c5f94d]" : "text-white"}`}>{value}</span></div>;
}
