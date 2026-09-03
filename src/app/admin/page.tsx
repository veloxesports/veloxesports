import { ShieldAlert } from "lucide-react";
import Link from "next/link";
import { getAdminDashboardOverview, getAdminGames } from "@/features/admin/actions";
import { getAdminAnalytics } from "@/features/admin/insights";
import { AdminDashboardClient } from "./AdminDashboardClient";

export default async function AdminDashboard() {
  const [overviewResult, analyticsResult, gamesResult] = await Promise.all([
    getAdminDashboardOverview(),
    getAdminAnalytics(),
    getAdminGames(),
  ]);

  if (!overviewResult.success) {
    return (
      <main className="velox-page flex flex-col items-center justify-center text-center">
        <ShieldAlert className="h-12 w-12 text-[#ffad9a]" aria-hidden />
        <h1 className="mt-4 text-xl font-black text-white">Command Center unavailable</h1>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-[#8e998f]">
          {overviewResult.error ?? "Unable to load the operations command center."}
        </p>
        <Link href="/" className="velox-muted-button mt-6">
          Return to VELOX
        </Link>
      </main>
    );
  }

  const overview = overviewResult.data;
  const analytics = analyticsResult.success ? analyticsResult.data : null;
  const games = gamesResult.success && gamesResult.data ? gamesResult.data : [];

  return (
    <AdminDashboardClient
      overview={overview}
      analytics={analytics}
      games={games}
    />
  );
}
