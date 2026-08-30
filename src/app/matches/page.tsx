import { Swords } from "lucide-react";
import { getMatchCenter } from "@/features/matches/services";
import { MatchCenter } from "./MatchCenter";

export default async function MatchesPage() {
  const result = await getMatchCenter();

  if (!result.success) {
    return <main className="velox-page flex flex-col items-center justify-center text-center"><Swords className="h-12 w-12 text-[#526052]" aria-hidden /><h1 className="mt-4 text-2xl font-black text-white">Match Center unavailable</h1><p className="mt-2 max-w-sm text-sm leading-relaxed text-[#8e998f]">{result.error}</p></main>;
  }

  return <MatchCenter matches={result.data} />;
}
