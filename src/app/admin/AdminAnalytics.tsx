import type { AdminAnalytics as AnalyticsData } from "@/features/admin/insights";

const seriesColors = ["#c5f94d", "#84d8ff", "#f0cf78", "#ff997d", "#af93ff", "#9eb69d"];

export function AdminAnalytics({ data }: { data: AnalyticsData }) {
  return (
    <section className="mt-7" aria-labelledby="analytics-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><p className="velox-eyebrow">Platform intelligence</p><h2 id="analytics-title" className="mt-1 text-xl font-black text-white">Analytics</h2></div>
        <p className="text-xs font-bold uppercase tracking-[0.08em] text-[#8e998f]">Last 14 days</p>
      </div>

      <div className="mt-3 grid gap-4 xl:grid-cols-2">
        <ChartCard title="Player growth & entries" detail="New player accounts and tournament registrations by day."><TrendChart data={data.trend} /></ChartCard>
        <ChartCard title="Stars flow" detail="Completed payments, refunds, and prize rewards by day."><StarsChart data={data.trend} /></ChartCard>
        <ChartCard title="Tournament lifecycle" detail="Every event, grouped by its current operating status."><DonutChart data={data.tournamentStatuses} emptyLabel="No tournaments" /></ChartCard>
        <ChartCard title="Player access" detail="Player accounts by their current platform access state."><DonutChart data={data.playerStatuses} emptyLabel="No player accounts" /></ChartCard>
      </div>
    </section>
  );
}

function ChartCard({ title, detail, children }: { title: string; detail: string; children: React.ReactNode }) {
  return <article className="velox-card overflow-hidden"><div className="border-b border-[#29342a] px-5 py-4"><h3 className="text-base font-black text-white">{title}</h3><p className="mt-1 text-xs leading-relaxed text-[#8e998f]">{detail}</p></div><div className="p-4 sm:p-5">{children}</div></article>;
}

function TrendChart({ data }: { data: AnalyticsData["trend"] }) {
  const max = Math.max(1, ...data.flatMap((day) => [day.players, day.registrations]));
  const width = 620;
  const height = 260;
  const left = 48;
  const right = 16;
  const top = 18;
  const bottom = 42;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const x = (index: number) => left + (data.length <= 1 ? plotWidth / 2 : (index / (data.length - 1)) * plotWidth);
  const y = (value: number) => top + plotHeight - (value / max) * plotHeight;
  const line = (values: number[]) => values.map((value, index) => `${x(index)},${y(value)}`).join(" ");
  const yTicks = [0, Math.ceil(max / 2), max];

  return <div><Legend items={[{ label: "New players", color: seriesColors[0] }, { label: "Registrations", color: seriesColors[1] }]} /><svg viewBox={`0 0 ${width} ${height}`} className="mt-4 block h-auto w-full" role="img" aria-label="Line graph of new players and registrations over the last 14 days"><title>Player growth and tournament registrations</title><rect x={left} y={top} width={plotWidth} height={plotHeight} fill="#0c120d" rx="10" /><g stroke="#354235" strokeWidth="1">{yTicks.map((tick) => <line key={tick} x1={left} y1={y(tick)} x2={width - right} y2={y(tick)} />)}</g>{yTicks.map((tick) => <text key={tick} x={left - 8} y={y(tick) + 4} textAnchor="end" fill="#8e998f" fontSize="11">{tick}</text>)}<polyline points={line(data.map((day) => day.players))} fill="none" stroke={seriesColors[0]} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /><polyline points={line(data.map((day) => day.registrations))} fill="none" stroke={seriesColors[1]} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />{data.map((day, index) => <g key={day.label}><circle cx={x(index)} cy={y(day.players)} r="3.5" fill={seriesColors[0]}><title>{`${day.label}: ${day.players} new players`}</title></circle><circle cx={x(index)} cy={y(day.registrations)} r="3.5" fill={seriesColors[1]}><title>{`${day.label}: ${day.registrations} registrations`}</title></circle>{(index === 0 || index === data.length - 1 || index % 3 === 0) && <text x={x(index)} y={height - 16} textAnchor={index === 0 ? "start" : index === data.length - 1 ? "end" : "middle"} fill="#8e998f" fontSize="11">{day.label}</text>}</g>)}</svg></div>;
}

function StarsChart({ data }: { data: AnalyticsData["trend"] }) {
  const max = Math.max(1, ...data.flatMap((day) => [day.payments, day.refunds, day.rewards]));
  const width = 620;
  const height = 260;
  const left = 52;
  const right = 16;
  const top = 18;
  const bottom = 42;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const barWidth = Math.max(2, Math.min(10, plotWidth / Math.max(data.length * 4, 1)));
  const groupWidth = plotWidth / Math.max(data.length, 1);
  const y = (value: number) => top + plotHeight - (value / max) * plotHeight;
  const yTicks = [0, Math.ceil(max / 2), max];

  return <div><Legend items={[{ label: "Payments", color: seriesColors[0] }, { label: "Refunds", color: seriesColors[3] }, { label: "Prize rewards", color: seriesColors[2] }]} /><svg viewBox={`0 0 ${width} ${height}`} className="mt-4 block h-auto w-full" role="img" aria-label="Bar graph of completed Stars payments, refunds and prize rewards over the last 14 days"><title>Stars flow over the last 14 days</title><rect x={left} y={top} width={plotWidth} height={plotHeight} fill="#0c120d" rx="10" /><g stroke="#354235" strokeWidth="1">{yTicks.map((tick) => <line key={tick} x1={left} y1={y(tick)} x2={width - right} y2={y(tick)} />)}</g>{yTicks.map((tick) => <text key={tick} x={left - 8} y={y(tick) + 4} textAnchor="end" fill="#8e998f" fontSize="11">⭐ {tick.toLocaleString()}</text>)}{data.map((day, index) => { const groupStart = left + index * groupWidth + (groupWidth - barWidth * 3 - 4) / 2; return <g key={day.label}><Bar x={groupStart} value={day.payments} y={y} bottom={top + plotHeight} color={seriesColors[0]} label={`${day.label}: ${day.payments} payment Stars`} /><Bar x={groupStart + barWidth + 2} value={day.refunds} y={y} bottom={top + plotHeight} color={seriesColors[3]} label={`${day.label}: ${day.refunds} refund Stars`} /><Bar x={groupStart + (barWidth + 2) * 2} value={day.rewards} y={y} bottom={top + plotHeight} color={seriesColors[2]} label={`${day.label}: ${day.rewards} prize Stars`} />{(index === 0 || index === data.length - 1 || index % 3 === 0) && <text x={left + index * groupWidth + groupWidth / 2} y={height - 16} textAnchor={index === 0 ? "start" : index === data.length - 1 ? "end" : "middle"} fill="#8e998f" fontSize="11">{day.label}</text>}</g>; })}</svg></div>;
}

function Bar({ x, value, y, bottom, color, label }: { x: number; value: number; y: (value: number) => number; bottom: number; color: string; label: string }) {
  const top = y(value);
  return <rect x={x} y={top} width="8" height={Math.max(0, bottom - top)} fill={color} rx="3"><title>{label}</title></rect>;
}

function DonutChart({ data, emptyLabel }: { data: Array<{ label: string; value: number }>; emptyLabel: string }) {
  const values = data.filter((item) => item.value > 0);
  const total = values.reduce((sum, item) => sum + item.value, 0);
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const segments = values.map((item, index) => {
    const length = total === 0 ? 0 : (item.value / total) * circumference;
    const offset = values.slice(0, index).reduce((sum, previous) => sum + (total === 0 ? 0 : (previous.value / total) * circumference), 0);
    return { item, index, length, offset };
  });

  return <div className="grid items-center gap-5 sm:grid-cols-[190px_1fr]"><svg viewBox="0 0 180 180" className="mx-auto h-auto w-full max-w-[180px]" role="img" aria-label={`${total} records split by status`}><title>Status distribution</title><circle cx="90" cy="90" r={radius} fill="none" stroke="#243024" strokeWidth="24" />{segments.map(({ item, index, length, offset }) => <circle key={item.label} cx="90" cy="90" r={radius} fill="none" stroke={seriesColors[index % seriesColors.length]} strokeWidth="24" strokeDasharray={`${length} ${circumference - length}`} strokeDashoffset={-offset} strokeLinecap="butt" transform="rotate(-90 90 90)"><title>{`${labelFor(item.label)}: ${item.value}`}</title></circle>)}<text x="90" y="86" textAnchor="middle" fill="#ffffff" fontSize="26" fontWeight="800">{total}</text><text x="90" y="106" textAnchor="middle" fill="#8e998f" fontSize="11">{total === 1 ? "record" : "records"}</text></svg><div className="grid gap-2">{values.length === 0 ? <p className="text-sm text-[#8e998f]">{emptyLabel}</p> : values.map((item, index) => <div key={item.label} className="flex items-center justify-between gap-3 text-sm"><span className="flex min-w-0 items-center gap-2 text-[#c3ceb9]"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: seriesColors[index % seriesColors.length] }} aria-hidden /> <span className="truncate">{labelFor(item.label)}</span></span><span className="font-black text-white">{item.value}</span></div>)}</div></div>;
}

function Legend({ items }: { items: Array<{ label: string; color: string }> }) {
  return <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-[#c3ceb9]">{items.map((item) => <span key={item.label} className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} aria-hidden />{item.label}</span>)}</div>;
}

function labelFor(value: string) {
  return value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}
