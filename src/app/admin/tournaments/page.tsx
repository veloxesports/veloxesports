import Link from "next/link";
import { getAdminGames, getAdminTournaments } from "@/features/admin/actions";
import { AdminTournamentsClient } from "./AdminTournamentsClient";

export default async function AdminTournamentsPage() {
  const [gamesResult, tournamentsResult] = await Promise.all([getAdminGames(), getAdminTournaments()]);
  if (!gamesResult.success || !tournamentsResult.success) return <main className="min-h-screen bg-black p-6 text-center text-red-300"><Link href="/admin" className="text-violet-300">Back to command center</Link><p className="mt-5">{gamesResult.error ?? tournamentsResult.error ?? "Unable to load tournament administration."}</p></main>;
  return <AdminTournamentsClient games={gamesResult.data ?? []} tournaments={tournamentsResult.data ?? []} />;
}
