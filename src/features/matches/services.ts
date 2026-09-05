import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/database/prisma";

type MatchCenterMatch = {
  id: string;
  tournamentTitle: string;
  gameName: string;
  round: number;
  scheduledTime: Date | null;
  status: string;
  score1: number | null;
  score2: number | null;
  player1: { name: string; isCurrentUser: boolean };
  player2: { name: string; isCurrentUser: boolean };
};

export async function getMatchCenter(): Promise<{ success: true; data: MatchCenterMatch[] } | { success: false; error: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "Open Khemora inside Telegram to view your matches." };

    const memberships = await prisma.teamMember.findMany({
      where: { userId: user.id },
      select: { teamId: true },
    });
    const teamIds = memberships.map((membership) => membership.teamId);
    const matches = await prisma.match.findMany({
      where: {
        OR: [
          { player1Id: user.id },
          { player2Id: user.id },
          ...(teamIds.length ? [{ team1Id: { in: teamIds } }, { team2Id: { in: teamIds } }] : []),
        ],
      },
      select: {
        id: true,
        round: true,
        scheduledTime: true,
        status: true,
        score1: true,
        score2: true,
        player1Id: true,
        player2Id: true,
        team1Id: true,
        team2Id: true,
        tournament: { select: { title: true, game: { select: { name: true } } } },
      },
      orderBy: [{ scheduledTime: "asc" }, { createdAt: "desc" }],
      take: 50,
    });

    const playerIds = [...new Set(matches.flatMap((match) => [match.player1Id, match.player2Id]).filter((id): id is string => Boolean(id)))];
    const participantTeamIds = [...new Set(matches.flatMap((match) => [match.team1Id, match.team2Id]).filter((id): id is string => Boolean(id)))];
    const [players, teams] = await Promise.all([
      prisma.user.findMany({ where: { id: { in: playerIds } }, select: { id: true, firstName: true, username: true } }),
      prisma.team.findMany({ where: { id: { in: participantTeamIds } }, select: { id: true, name: true } }),
    ]);
    const playerNames = new Map(players.map((player) => [player.id, player.username ?? player.firstName ?? "Player"]));
    const teamNames = new Map(teams.map((team) => [team.id, team.name]));
    const labelFor = (playerId: string | null, teamId: string | null) => playerId ? playerNames.get(playerId) ?? "Player" : teamId ? teamNames.get(teamId) ?? "Team" : "TBD";

    return {
      success: true,
      data: matches.map((match) => ({
        id: match.id,
        tournamentTitle: match.tournament.title,
        gameName: match.tournament.game.name,
        round: match.round,
        scheduledTime: match.scheduledTime,
        status: match.status,
        score1: match.score1,
        score2: match.score2,
        player1: { name: labelFor(match.player1Id, match.team1Id), isCurrentUser: match.player1Id === user.id || (match.team1Id ? teamIds.includes(match.team1Id) : false) },
        player2: { name: labelFor(match.player2Id, match.team2Id), isCurrentUser: match.player2Id === user.id || (match.team2Id ? teamIds.includes(match.team2Id) : false) },
      })),
    };
  } catch (error) {
    console.error("Match center fetch failed", error);
    return { success: false, error: "We couldn't load your matches." };
  }
}
