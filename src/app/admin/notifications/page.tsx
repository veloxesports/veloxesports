import { ShieldAlert } from "lucide-react";
import Link from "next/link";
import { getAdminNotifications, getAdminTournaments } from "@/features/admin/actions";
import { AdminNotificationsClient } from "./AdminNotificationsClient";

export default async function AdminNotificationsPage() {
  const [notificationsResult, tournamentsResult] = await Promise.all([
    getAdminNotifications({ limit: 100 }),
    getAdminTournaments(),
  ]);

  if (!notificationsResult.success) {
    return (
      <main className="velox-page flex flex-col items-center justify-center text-center">
        <ShieldAlert className="h-11 w-11 text-[#ffad9a]" aria-hidden />
        <h1 className="mt-4 text-2xl font-black text-white">Notifications desk unavailable</h1>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-[#8e998f]">
          {notificationsResult.error ?? "Failed to load notification logs."}
        </p>
        <Link href="/admin" className="velox-muted-button mt-6">
          Command Center
        </Link>
      </main>
    );
  }

  const data = notificationsResult.data;
  const tournaments = tournamentsResult.success && tournamentsResult.data
    ? tournamentsResult.data.map((t) => ({
        id: t.id,
        title: t.title,
        gameName: t.game.name,
      }))
    : [];

  return <AdminNotificationsClient data={data} tournaments={tournaments} />;
}
