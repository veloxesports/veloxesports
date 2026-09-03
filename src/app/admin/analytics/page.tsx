import { ArrowLeft, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { getAdminAnalytics } from "@/features/admin/insights";
import { AdminAnalytics } from "../AdminAnalytics";

export default async function AdminAnalyticsPage() {
  const result = await getAdminAnalytics();

  if (!result.success) {
    return (
      <main className="velox-page flex flex-col items-center justify-center text-center">
        <ShieldAlert className="h-11 w-11 text-[#ffad9a]" aria-hidden />
        <h1 className="mt-4 text-2xl font-black text-white">Analytics unavailable</h1>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-[#8e998f]">
          {result.error ?? "Failed to compile platform analytics."}
        </p>
        <Link href="/admin" className="velox-muted-button mt-6">
          Command Center
        </Link>
      </main>
    );
  }

  return (
    <main className="velox-page">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="velox-eyebrow">Platform Intelligence</p>
          <h1 className="mt-1 text-2xl font-black tracking-[-0.05em] text-white sm:text-3xl">
            Analytics & Insights
          </h1>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-[#8e998f]">
            Platform growth metrics, entry trends, Telegram Stars financial circulation, and tournament catalog performance.
          </p>
        </div>
        <Link href="/admin" className="velox-muted-button inline-flex items-center gap-1.5 self-start sm:self-auto">
          <ArrowLeft className="h-4 w-4" />
          <span>Command Center</span>
        </Link>
      </header>

      <AdminAnalytics data={result.data} />
    </main>
  );
}
