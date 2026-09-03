import { CalendarDays, ChevronLeft, CircleDollarSign, ClipboardList, Gamepad2, Trophy, Users } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdminInsight, isAdminInsightMetric, type AdminInsightItem } from "@/features/admin/insights";
import { PlayerModerationControls } from "./PlayerModerationControls";

/* eslint-disable @next/next/no-img-element -- Admin avatars can originate from Telegram or Supabase. */

export default async function AdminInsightPage({ params }: { params: Promise<{ metric: string }> }) {
  const { metric } = await params;
  if (!isAdminInsightMetric(metric)) notFound();

  const result = await getAdminInsight(metric);
  if (!result.success) return <Unavailable message={result.error} />;

  const { data } = result;
  const icon = metric.includes("star") || metric === "prize-rewards" ? <CircleDollarSign className="h-5 w-5" aria-hidden /> : metric.includes("tournament") || metric === "live-events" ? <Trophy className="h-5 w-5" aria-hidden /> : metric === "confirmed-entries" ? <ClipboardList className="h-5 w-5" aria-hidden /> : <Users className="h-5 w-5" aria-hidden />;

  return (
    <main className="velox-page">
      <header className="flex items-start gap-3">
        <Link href="/admin" className="velox-muted-button flex h-10 w-10 shrink-0 p-0" aria-label="Back to Command Center"><ChevronLeft className="h-5 w-5" aria-hidden /></Link>
        <div>
          <p className="velox-eyebrow">Command Center data</p>
          <h1 className="mt-1 text-2xl font-black tracking-[-0.04em] text-white sm:text-3xl">{data.title}</h1>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-[#8e998f]">{data.description}</p>
        </div>
      </header>

      <section className="relative mt-6 overflow-hidden rounded-[28px] border border-[#405b31] bg-[#182714] p-5 sm:p-6">
        <div className="absolute -right-10 -top-14 h-40 w-40 rounded-full border-[28px] border-[#345123] opacity-70" aria-hidden />
        <div className="relative flex items-center gap-4"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#263b1b] text-[#c5f94d]">{icon}</span><div><p className="text-2xl font-black text-white">{data.totalAmount === undefined ? data.total.toLocaleString() : `⭐ ${data.totalAmount.toLocaleString()}`}</p><p className="text-xs font-black uppercase tracking-[0.1em] text-[#c5f94d]">{data.totalAmount === undefined ? `${data.itemLabel}${data.total === 1 ? "" : "s"} in this view` : `${data.total} ${data.itemLabel}${data.total === 1 ? "" : "s"} recorded`}</p></div></div>
      </section>

      <section className="mt-7">
        <div className="flex items-end justify-between gap-3"><div><p className="velox-eyebrow">{data.eyebrow}</p><h2 className="mt-1 text-xl font-black text-white">Records</h2></div><p className="text-xs font-bold uppercase tracking-[0.08em] text-[#8e998f]">{data.items.length === data.total ? "All records" : `Latest ${data.items.length}`}</p></div>
        <div className="mt-3 grid gap-3">
          {data.items.length === 0 ? <Empty itemLabel={data.itemLabel} /> : data.items.map((item) => <InsightRecord key={item.id} item={item} allowModeration={data.canModeratePlayers === true} />)}
        </div>
      </section>
    </main>
  );
}

function InsightRecord({ item, allowModeration }: { item: AdminInsightItem; allowModeration: boolean }) {
  const content = (
    <>
      <Avatar imageUrl={item.imageUrl} label={item.title} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-black text-white">{item.title}</p>
        <p className="mt-1 truncate text-sm text-[#8e998f]">{item.detail}</p>
        {item.meta && <p className="mt-2 text-xs font-medium text-[#718071]">{item.meta}</p>}
      </div>
      <div className="shrink-0 text-right">
        {item.amount !== undefined && <p className="text-lg font-black text-white">⭐ {item.amount.toLocaleString()}</p>}
        <StatusBadge value={item.status} />
        <p className="mt-2 inline-flex items-center gap-1 text-[11px] text-[#718071]">
          <CalendarDays className="h-3.5 w-3.5" aria-hidden />
          {item.dateLabel}: {formatDate(item.date)}
        </p>
      </div>
    </>
  );

  const discordSection = item.discord ? (
    <div className="mt-3.5 rounded-2xl border border-[#223326] bg-[#0c140e] p-3.5 text-left">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {item.discord.avatarUrl ? (
            <img
              src={item.discord.avatarUrl}
              alt=""
              className="h-9 w-9 shrink-0 rounded-xl object-cover ring-2 ring-[#5865F2]"
            />
          ) : (
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#201d36] text-[#5865F2]">
              <Gamepad2 className="h-5 w-5" />
            </span>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate text-xs font-black text-white">
                {item.discord.displayName || item.discord.username || "Discord"}
              </span>
              {item.discord.username && item.discord.displayName !== item.discord.username && (
                <span className="truncate text-[11px] font-semibold text-[#8ea5bc]">
                  @{item.discord.username}
                </span>
              )}
            </div>

            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-[#8ea08f]">
              {item.discord.id && (
                <span>
                  <strong className="font-medium text-[#657666]">ID:</strong>{" "}
                  <span className="font-mono text-white/90">{item.discord.id}</span>
                </span>
              )}
              {item.discord.connectedAt && (
                <span>
                  <strong className="font-medium text-[#657666]">Connected:</strong>{" "}
                  <span className="text-[#c5f94d]">{formatDate(item.discord.connectedAt)}</span>
                </span>
              )}
            </div>
          </div>
        </div>

        <span
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-wider ${
            item.discord.connected
              ? "border border-emerald-500/30 bg-emerald-500/15 text-emerald-400"
              : "border border-[#303d32] bg-[#141d15] text-[#708072]"
          }`}
        >
          {item.discord.connected && (
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          )}
          {item.discord.connected ? "Discord Connected" : "Discord Not Linked"}
        </span>
      </div>
    </div>
  ) : null;

  return item.href ? (
    <Link href={item.href} className="velox-card flex flex-col p-4 transition hover:border-[#5e7b4b] hover:bg-[#162016] sm:p-5">
      <div className="flex items-start gap-3">{content}</div>
      {discordSection}
    </Link>
  ) : (
    <article className="velox-card p-4 sm:p-5">
      <div className="flex items-start gap-3">{content}</div>
      {discordSection}
      {allowModeration && <PlayerModerationControls playerId={item.id} playerName={item.title} status={item.status} />}
    </article>
  );
}

function Avatar({ imageUrl, label }: { imageUrl?: string | null; label: string }) {
  return imageUrl ? <img src={imageUrl} alt="" className="h-10 w-10 shrink-0 rounded-xl border border-[#40503e] object-cover" /> : <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#1f3119] text-sm font-black text-[#c5f94d]">{label.slice(0, 1).toUpperCase()}</span>;
}

function StatusBadge({ value }: { value: string }) {
  const styles: Record<string, string> = { ACTIVE: "bg-[#20331b] text-[#c5f94d]", CONFIRMED: "bg-[#20331b] text-[#c5f94d]", COMPLETED: "bg-[#20331b] text-[#c5f94d]", REFUNDED: "bg-[#1c3134] text-[#8ee7ec]", LIVE: "bg-[#20331b] text-[#c5f94d]", PENDING: "bg-[#392f1c] text-[#f0cf78]", CANCELLED: "bg-[#3b211e] text-[#ffad9a]", RESTRICTED: "bg-[#392f1c] text-[#f0cf78]", SUSPENDED: "bg-[#3b211e] text-[#ffad9a]", BANNED: "bg-[#3b211e] text-[#ffad9a]", UNDER_REVIEW: "bg-[#273127] text-[#d6dfbf]" };
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em] ${styles[value] ?? "bg-[#242b25] text-[#a4aea3]"}`}>{labelFor(value)}</span>;
}

function Empty({ itemLabel }: { itemLabel: string }) {
  return <div className="velox-card px-5 py-12 text-center"><Users className="mx-auto h-9 w-9 text-[#526052]" aria-hidden /><p className="mt-3 font-black text-white">No {itemLabel}s recorded</p><p className="mt-1 text-sm text-[#8e998f]">New activity will appear here as VELOX records it.</p></div>;
}

function Unavailable({ message }: { message: string }) {
  return <main className="velox-page flex flex-col items-center justify-center text-center"><Users className="h-11 w-11 text-[#526052]" aria-hidden /><h1 className="mt-4 text-2xl font-black text-white">Data view unavailable</h1><p className="mt-2 max-w-sm text-sm leading-relaxed text-[#8e998f]">{message}</p><Link href="/admin" className="velox-muted-button mt-6"><ChevronLeft className="mr-1.5 h-4 w-4" aria-hidden />Back to Command Center</Link></main>;
}

function formatDate(value: Date | null) {
  if (!value) return "Not recorded";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(value);
}

function labelFor(value: string) {
  return value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}
