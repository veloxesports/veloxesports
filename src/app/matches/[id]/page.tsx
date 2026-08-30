import { ChevronLeft, Swords } from "lucide-react";
import Link from "next/link";
import { getMatchDetails } from "@/features/matches/actions";
import { MatchDetailsClient } from "./MatchDetailsClient";

export default async function MatchDetailsPage({ params }: PageProps<"/matches/[id]">) {
  const { id } = await params;
  const result = await getMatchDetails(id);

  if (!result.success || !result.data) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-black p-6 text-center">
        <Swords className="mb-4 h-14 w-14 text-slate-700" aria-hidden />
        <h1 className="text-xl font-bold text-white">Match unavailable</h1>
        <p className="mt-2 max-w-sm text-sm text-slate-400">{result.error ?? "We couldn't load this match."}</p>
        <Link href="/matches" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[#c5f94d]">
          <ChevronLeft className="h-4 w-4" aria-hidden /> Back to Match Center
        </Link>
      </main>
    );
  }

  return <MatchDetailsClient match={result.data} />;
}
