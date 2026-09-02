import { ArrowLeft, ShieldAlert, Swords, Trophy } from "lucide-react";
import Link from "next/link";
import { getAdminStats } from "@/features/admin/actions";

export default async function AdminMatchesPage() {
  const result = await getAdminStats();
  if (!result.success || !result.data) return <Unavailable message={result.error ?? "We couldn't load the match desk."} />;

  const { liveMatches, matchesNeedingAttention } = result.data;
  return (
    <main className="velox-page">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="velox-eyebrow">Competition operations</p>
          <h1 className="mt-1 text-2xl font-black tracking-[-0.05em] text-white sm:text-3xl">Match desk</h1>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-[#8e998f]">Monitor live, reported, and disputed fixtures. Open a fixture&apos;s tournament to manage check-in, brackets, rosters, and event controls.</p>
        </div>
        <Link href="/admin" className="velox-muted-button shrink-0"><ArrowLeft className="mr-1.5 h-4 w-4" aria-hidden />Command Center</Link>
      </header>

      <section className="mt-5 grid gap-3 sm:grid-cols-3">
        <Metric label="Needs attention" value={matchesNeedingAttention} tone={matchesNeedingAttention > 0 ? "alert" : "default"} />
        <Metric label="Live fixture feed" value={liveMatches.filter((match) => match.status === "LIVE").length} />
        <Metric label="Visible operations" value={liveMatches.length} />
      </section>

      <section className="velox-card mt-5 overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-[#29342a] px-5 py-4"><div><p className="velox-eyebrow">Real-time fixture feed</p><h2 className="mt-1 text-lg font-black text-white">Match activity</h2></div><Swords className="h-5 w-5 text-[#c5f94d]" aria-hidden /></div>
        {liveMatches.length === 0 ? <div className="px-5 py-14 text-center"><Swords className="mx-auto h-9 w-9 text-[#526052]" aria-hidden /><p className="mt-3 font-black text-white">No fixtures need action</p><p className="mt-1 text-sm text-[#8e998f]">Live, reported, and disputed matches automatically surface here during competition.</p><Link href="/admin/tournaments" className="velox-action mt-5">Tournament control</Link></div> : <div className="grid divide-y divide-[#29342a] xl:grid-cols-2 xl:divide-x xl:divide-y-0">{liveMatches.map((match) => <Link key={match.id} href={`/admin/tournaments/${match.tournamentId}`} className="group p-5 transition hover:bg-[#172117]"><div className="flex items-center justify-between gap-3"><span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.1em] text-[#a8b6a1]"><Trophy className="h-3.5 w-3.5 text-[#c5f94d]" aria-hidden />{match.game} · Round {match.round}</span><Status value={match.status} /></div><div className="mt-5 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3"><p className="truncate text-base font-black text-white">{match.player1}</p><p className="rounded-lg bg-[#1e3118] px-2.5 py-1.5 text-sm font-black text-[#c5f94d]">{match.score1 ?? "–"} : {match.score2 ?? "–"}</p><p className="truncate text-right text-base font-black text-white">{match.player2}</p></div><div className="mt-4 flex items-center justify-between gap-3 border-t border-[#29342a] pt-3 text-xs text-[#8d9a8a]"><span className="truncate">{match.tournament}</span><span className="inline-flex shrink-0 items-center gap-1 font-bold text-[#c5f94d]">Manage event <span aria-hidden>→</span></span></div></Link>)}</div>}
      </section>
    </main>
  );
}

function Metric({ label, value, tone = "default" }: { label: string; value: number; tone?: "default" | "alert" }) {
  return <div className={`rounded-2xl border p-4 ${tone === "alert" ? "border-[#9b5646] bg-[#261a17]" : "border-[#2f4530] bg-[#121b12]"}`}><p className={`text-2xl font-black ${tone === "alert" ? "text-[#ffad97]" : "text-[#c5f94d]"}`}>{value.toLocaleString()}</p><p className="mt-1 text-[10px] font-black uppercase tracking-[0.1em] text-[#aab7a4]">{label}</p></div>;
}

function Status({ value }: { value: string }) {
  const styles: Record<string, string> = { LIVE: "bg-[#20331b] text-[#c5f94d]", AWAITING_RESULT: "bg-[#2a2d21] text-[#f0cf78]", UNDER_REVIEW: "bg-[#1d3033] text-[#8ee7ec]", DISPUTED: "bg-[#3b211e] text-[#ffad9a]" };
  return <span className={`shrink-0 rounded-full px-2 py-1 text-[9px] font-black uppercase tracking-[0.08em] ${styles[value] ?? "bg-[#242b25] text-[#a4aea3]"}`}>{value.replaceAll("_", " ")}</span>;
}

function Unavailable({ message }: { message: string }) {
  return <main className="velox-page flex flex-col items-center justify-center text-center"><ShieldAlert className="h-11 w-11 text-[#ffad9a]" aria-hidden /><h1 className="mt-4 text-2xl font-black text-white">Match desk unavailable</h1><p className="mt-2 max-w-sm text-sm leading-relaxed text-[#8e998f]">{message}</p><Link href="/admin" className="velox-muted-button mt-6"><ArrowLeft className="mr-1.5 h-4 w-4" aria-hidden />Command Center</Link></main>;
}
