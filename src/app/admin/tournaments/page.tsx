import Link from "next/link";
import { ChevronLeft, Trophy } from "lucide-react";
import { getAdminGames, getAdminTournaments } from "@/features/admin/actions";
import { AdminTournamentsClient } from "./AdminTournamentsClient";

export default async function AdminTournamentsPage() {
  const [gamesResult, tournamentsResult] = await Promise.all([getAdminGames(), getAdminTournaments()]);
  if (!gamesResult.success || !tournamentsResult.success) return <main className="velox-page flex flex-col items-center justify-center text-center"><Trophy className="h-11 w-11 text-[#526052]" aria-hidden /><h1 className="mt-4 text-2xl font-black text-white">Tournament control unavailable</h1><p className="mt-2 max-w-sm text-sm leading-relaxed text-[#8e998f]">{gamesResult.error ?? tournamentsResult.error ?? "Unable to load tournament administration."}</p><Link href="/admin" className="velox-muted-button mt-6"><ChevronLeft className="mr-1.5 h-4 w-4" aria-hidden />Back to Command Center</Link></main>;
  return <AdminTournamentsClient games={gamesResult.data ?? []} tournaments={tournamentsResult.data ?? []} />;
}
