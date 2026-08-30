import { getGames, getTournaments } from "@/features/tournaments/actions";
import { TournamentBrowser } from "./TournamentBrowser";

export default async function TournamentsPage() {
  const [tournamentsResult, gamesResult] = await Promise.all([getTournaments(), getGames()]);
  return <TournamentBrowser tournaments={tournamentsResult.success ? tournamentsResult.data ?? [] : []} games={gamesResult.success ? gamesResult.data ?? [] : []} />;
}
