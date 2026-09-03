import { ShieldAlert } from "lucide-react";
import Link from "next/link";
import { getAdminRegistrations, getAdminTournaments } from "@/features/admin/actions";
import { AdminRegistrationsClient } from "./AdminRegistrationsClient";

export default async function AdminRegistrationsPage() {
  const [registrationsResult, tournamentsResult] = await Promise.all([
    getAdminRegistrations({ limit: 100 }),
    getAdminTournaments(),
  ]);

  if (!registrationsResult.success) {
    return (
      <main className="velox-page flex flex-col items-center justify-center text-center">
        <ShieldAlert className="h-11 w-11 text-[#ffad9a]" aria-hidden />
        <h1 className="mt-4 text-2xl font-black text-white">Registrations desk unavailable</h1>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-[#8e998f]">
          {registrationsResult.error ?? "Failed to load tournament registrations."}
        </p>
        <Link href="/admin" className="velox-muted-button mt-6">
          Command Center
        </Link>
      </main>
    );
  }

  const registrations = registrationsResult.data;
  const tournaments = tournamentsResult.success && tournamentsResult.data
    ? tournamentsResult.data.map((t) => ({
        id: t.id,
        title: t.title,
        gameName: t.game.name,
      }))
    : [];

  return <AdminRegistrationsClient registrations={registrations} tournaments={tournaments} />;
}
