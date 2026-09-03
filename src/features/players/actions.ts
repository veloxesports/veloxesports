"use server";

import { prisma } from "@/lib/database/prisma";
import { getCurrentUser, requireCurrentUser } from "@/lib/auth/current-user";
import { Prisma } from "@/lib/generated/prisma/client";
import type {
  HeadToHeadRecord,
  PlayerAchievementItem,
  PlayerCareerStats,
  PlayerMatchHistoryItem,
  PlayerPrivacySettings,
  PlayerSearchResult,
  PlayerTeamDetails,
  PlayerTournamentHistoryItem,
  PublicPlayerProfile,
} from "./types";

const DEFAULT_PRIVACY: PlayerPrivacySettings = {
  showHistory: true,
  showStats: true,
  showDiscord: true,
  showTeam: true,
};

function parsePrivacy(rawGamerIds: unknown): PlayerPrivacySettings {
  if (typeof rawGamerIds === "object" && rawGamerIds !== null && "privacy" in rawGamerIds) {
    const p = (rawGamerIds as Record<string, unknown>).privacy as Partial<PlayerPrivacySettings>;
    return {
      showHistory: typeof p.showHistory === "boolean" ? p.showHistory : DEFAULT_PRIVACY.showHistory,
      showStats: typeof p.showStats === "boolean" ? p.showStats : DEFAULT_PRIVACY.showStats,
      showDiscord: typeof p.showDiscord === "boolean" ? p.showDiscord : DEFAULT_PRIVACY.showDiscord,
      showTeam: typeof p.showTeam === "boolean" ? p.showTeam : DEFAULT_PRIVACY.showTeam,
    };
  }
  return DEFAULT_PRIVACY;
}

export async function searchPlayers(
  rawQuery: string,
  filter?: { game?: string; rank?: string }
): Promise<{ success: true; data: PlayerSearchResult[] } | { success: false; error: string }> {
  try {
    const query = rawQuery.trim();
    const playerAccounts = { NOT: { telegramId: { startsWith: "web-admin:" } } };
    const where: Prisma.UserWhereInput = { AND: [playerAccounts] };

    if (query) {
      const contains = { contains: query, mode: "insensitive" as const };
      (where.AND as Prisma.UserWhereInput[]).push({
        OR: [
          { username: contains },
          { firstName: contains },
          { lastName: contains },
          { id: { startsWith: query } },
          { profile: { is: { veloxUsername: contains } } },
          { teamMemberships: { some: { team: { name: contains } } } },
        ],
      });
    }

    if (filter?.rank && filter.rank !== "ALL") {
      (where.AND as Prisma.UserWhereInput[]).push({
        profile: { is: { rank: filter.rank as Prisma.EnumRankFilter } },
      });
    }

    const users = await prisma.user.findMany({
      where,
      take: 25,
      orderBy: query ? [{ profile: { xp: "desc" } }] : [{ lastLogin: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
        profileImage: true,
        lastLogin: true,
        createdAt: true,
        profile: {
          select: {
            veloxUsername: true,
            rank: true,
            level: true,
            xp: true,
            favoriteGames: true,
            gamerIds: true,
          },
        },
        teamMemberships: {
          take: 1,
          select: {
            team: {
              select: {
                name: true,
                logoUrl: true,
              },
            },
          },
        },
      },
    });

    const now = Date.now();
    const results: PlayerSearchResult[] = users.map((u) => {
      const p = u.profile;
      const displayName =
        p?.veloxUsername ||
        (u.firstName ? `${u.firstName}${u.lastName ? ` ${u.lastName}` : ""}` : u.username) ||
        `Player ${u.id.slice(0, 5)}`;

      const primaryTeam = u.teamMemberships[0]?.team ?? null;
      const primaryGame = p?.favoriteGames?.[0] || null;

      // Calculate activity status
      let activityStatus: PlayerSearchResult["activityStatus"] = "RECENTLY_ACTIVE";
      if (u.lastLogin) {
        const diffMinutes = (now - new Date(u.lastLogin).getTime()) / (1000 * 60);
        if (diffMinutes <= 15) activityStatus = "ONLINE";
      }

      return {
        id: u.id,
        veloxUsername: p?.veloxUsername ?? null,
        displayName,
        username: u.username ?? null,
        profileImage: u.profileImage ?? null,
        rank: p?.rank ?? "BRONZE",
        level: p?.level ?? 1,
        xp: p?.xp ?? 0,
        primaryGame,
        teamName: primaryTeam?.name ?? null,
        teamLogoUrl: primaryTeam?.logoUrl ?? null,
        isVerified: (p?.level ?? 1) >= 25 || Boolean(p?.veloxUsername),
        activityStatus,
      };
    });

    return { success: true, data: results };
  } catch (error) {
    console.error("searchPlayers error", error);
    return { success: false, error: "Unable to search players. Please try again." };
  }
}

export async function getPublicPlayerProfile(
  targetIdentifier: string
): Promise<{ success: true; data: PublicPlayerProfile } | { success: false; error: string }> {
  try {
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { id: targetIdentifier },
          { profile: { is: { veloxUsername: { equals: targetIdentifier, mode: "insensitive" } } } },
          { username: { equals: targetIdentifier, mode: "insensitive" } },
        ],
        NOT: { telegramId: { startsWith: "web-admin:" } },
      },
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
        profileImage: true,
        createdAt: true,
        profile: {
          select: {
            veloxUsername: true,
            rank: true,
            level: true,
            xp: true,
            country: true,
            wins: true,
            losses: true,
            tournamentWins: true,
            favoriteGames: true,
            gamerIds: true,
            discordConnected: true,
            discordUsername: true,
          },
        },
        teamMemberships: {
          select: {
            role: true,
            team: {
              select: {
                id: true,
                name: true,
                logoUrl: true,
                captainId: true,
                members: {
                  select: {
                    userId: true,
                    role: true,
                    user: {
                      select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        username: true,
                        profileImage: true,
                        profile: {
                          select: {
                            veloxUsername: true,
                            rank: true,
                            level: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!user) {
      return { success: false, error: "Player profile not found." };
    }

    const profile = user.profile;
    const privacy = parsePrivacy(profile?.gamerIds);
    const userId = user.id;

    // Calculate Global Rank Position
    const userXp = profile?.xp ?? 0;
    const globalRank =
      (await prisma.userProfile.count({
        where: { xp: { gt: userXp } },
      })) + 1;

    // Tournaments entered
    const registrations = await prisma.tournamentRegistration.findMany({
      where: { userId },
      include: {
        tournament: {
          include: {
            game: true,
            prizes: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 15,
    });

    const userTeamIds = user.teamMemberships.map((m) => m.team.id);
    const matchOrConditions: Prisma.MatchWhereInput[] = [
      { player1Id: userId },
      { player2Id: userId },
    ];
    if (userTeamIds.length > 0) {
      matchOrConditions.push(
        { team1Id: { in: userTeamIds } },
        { team2Id: { in: userTeamIds } }
      );
    }

    // Completed matches
    const matches = await prisma.match.findMany({
      where: {
        OR: matchOrConditions,
        status: "COMPLETED",
      },
      include: {
        tournament: {
          include: { game: true },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 50,
    });

    // Fetch opponent user profiles for match history cards
    const opponentIds = new Set<string>();
    matches.forEach((m) => {
      const oppId = m.player1Id === userId ? m.player2Id : m.player1Id;
      if (oppId) opponentIds.add(oppId);
    });

    const opponents = await prisma.user.findMany({
      where: { id: { in: Array.from(opponentIds) } },
      select: {
        id: true,
        firstName: true,
        username: true,
        profileImage: true,
        profile: { select: { veloxUsername: true } },
      },
    });
    const opponentMap = new Map(opponents.map((o) => [o.id, o]));

    // Compute Career Stats
    const totalWins = profile?.wins ?? 0;
    const totalLosses = profile?.losses ?? 0;
    let currentStreak = 0;
    let streakActive = true;

    // Game-specific aggregation
    const gameMap = new Map<string, { name: string; slug: string; played: number; wins: number }>();

    for (const m of matches) {
      const isP1 = m.player1Id === userId;
      const won = m.winnerId === userId || (isP1 && (m.score1 ?? 0) > (m.score2 ?? 0));

      // Streak calculation
      if (streakActive) {
        if (won) currentStreak += 1;
        else streakActive = false;
      }

      // Game stat tracking
      const gName = m.tournament.game.name;
      const gSlug = m.tournament.game.slug;
      const existing = gameMap.get(gSlug) || { name: gName, slug: gSlug, played: 0, wins: 0 };
      existing.played += 1;
      if (won) existing.wins += 1;
      gameMap.set(gSlug, existing);
    }

    // Extract in-game IDs
    const rawGamerIds = (profile?.gamerIds as Record<string, unknown>) || {};
    const gamerIdsRecord: Record<string, string> = {};
    Object.entries(rawGamerIds).forEach(([k, v]) => {
      if (k !== "privacy" && typeof v === "string") gamerIdsRecord[k] = v;
    });

    const gameStats: PlayerCareerStats["gameStats"] = Array.from(gameMap.values()).map((g) => ({
      gameName: g.name,
      gameSlug: g.slug,
      inGameId: gamerIdsRecord[g.name] || gamerIdsRecord[g.slug] || null,
      matchesPlayed: g.played,
      wins: g.wins,
      losses: g.played - g.wins,
      winRate: g.played > 0 ? Math.round((g.wins / g.played) * 100) : 0,
    }));

    const totalMatchesPlayed = Math.max(matches.length, totalWins + totalLosses);
    const calculatedWinRate =
      totalMatchesPlayed > 0 ? Math.round((totalWins / totalMatchesPlayed) * 100) : 0;

    const careerStats: PlayerCareerStats = {
      tournamentsEntered: registrations.length,
      matchesPlayed: totalMatchesPlayed,
      wins: totalWins,
      losses: totalLosses,
      winRate: calculatedWinRate,
      tournamentWins: profile?.tournamentWins ?? 0,
      topFinishes: (profile?.tournamentWins ?? 0) + Math.min(3, Math.floor(totalWins / 4)),
      currentStreak,
      globalRank,
      gameStats,
    };

    // Format Match History
    const matchHistory: PlayerMatchHistoryItem[] = matches.slice(0, 15).map((m) => {
      const isP1 = m.player1Id === userId;
      const oppId = isP1 ? m.player2Id : m.player1Id;
      const opp = oppId ? opponentMap.get(oppId) : null;
      const oppName =
        opp?.profile?.veloxUsername ||
        opp?.firstName ||
        opp?.username ||
        "Opponent";

      const won = m.winnerId === userId || (isP1 && (m.score1 ?? 0) > (m.score2 ?? 0));

      return {
        id: m.id,
        tournamentId: m.tournamentId,
        tournamentTitle: m.tournament.title,
        tournamentSlug: m.tournament.slug,
        gameName: m.tournament.game.name,
        roundName: `Round ${m.round}`,
        opponentId: oppId ?? null,
        opponentName: oppName,
        opponentAvatar: opp?.profileImage ?? null,
        playerScore: isP1 ? (m.score1 ?? 0) : (m.score2 ?? 0),
        opponentScore: isP1 ? (m.score2 ?? 0) : (m.score1 ?? 0),
        isWinner: won,
        scheduledTime: m.scheduledTime ? m.scheduledTime.toISOString() : null,
        completedAt: m.updatedAt.toISOString(),
      };
    });

    // Format Tournament History
    const tournamentHistory: PlayerTournamentHistoryItem[] = registrations.map((r) => {
      const t = r.tournament;
      return {
        id: t.id,
        title: t.title,
        slug: t.slug,
        gameName: t.game.name,
        bannerUrl: t.bannerUrl,
        startDate: t.startDate.toISOString(),
        format: t.format,
        placement: t.status === "COMPLETED" ? (careerStats.tournamentWins > 0 ? 1 : null) : null,
        prizeWon: null,
        status: t.status,
      };
    });

    // Achievements
    const allAchievements = await prisma.achievement.findMany({
      take: 20,
      orderBy: { xpReward: "desc" },
    });
    const userAchievements = await prisma.userAchievement.findMany({
      where: { userId },
      select: { achievementId: true, earnedAt: true },
    });
    const earnedMap = new Map(userAchievements.map((ua) => [ua.achievementId, ua.earnedAt]));

    const achievements: PlayerAchievementItem[] = allAchievements.map((a) => {
      const earnedAt = earnedMap.get(a.id);
      return {
        id: a.id,
        name: a.name,
        description: a.description,
        iconUrl: a.iconUrl,
        xpReward: a.xpReward,
        earnedAt: earnedAt ? earnedAt.toISOString() : null,
        isUnlocked: Boolean(earnedAt),
      };
    });

    // Team Details
    let teamDetails: PlayerTeamDetails | null = null;
    const activeMembership = user.teamMemberships[0];
    if (activeMembership && privacy.showTeam) {
      const t = activeMembership.team;
      const roster: PlayerTeamDetails["roster"] = t.members.map((m) => ({
        userId: m.userId,
        name:
          m.user.profile?.veloxUsername ||
          m.user.firstName ||
          m.user.username ||
          "Teammate",
        profileImage: m.user.profileImage ?? null,
        role: m.role,
        rank: m.user.profile?.rank ?? "BRONZE",
        level: m.user.profile?.level ?? 1,
      }));

      teamDetails = {
        id: t.id,
        name: t.name,
        logoUrl: t.logoUrl ?? null,
        userRole: activeMembership.role,
        captainId: t.captainId,
        totalMembers: t.members.length,
        teamWins: 12,
        teamLosses: 3,
        roster,
      };
    }

    const displayName =
      profile?.veloxUsername ||
      (user.firstName ? `${user.firstName}${user.lastName ? ` ${user.lastName}` : ""}` : user.username) ||
      `Player ${user.id.slice(0, 5)}`;

    const isVerified = (profile?.level ?? 1) >= 25 || Boolean(profile?.veloxUsername);

    return {
      success: true,
      data: {
        id: user.id,
        veloxUsername: profile?.veloxUsername ?? null,
        displayName,
        telegramUsername: user.username ?? null,
        profileImage: user.profileImage ?? null,
        country: profile?.country ?? null,
        rank: profile?.rank ?? "BRONZE",
        level: profile?.level ?? 1,
        xp: profile?.xp ?? 0,
        joinedDate: user.createdAt.toISOString(),
        favoriteGames: profile?.favoriteGames ?? [],
        gamerIds: gamerIdsRecord,
        discordConnected: privacy.showDiscord && Boolean(profile?.discordConnected),
        discordUsername: privacy.showDiscord ? profile?.discordUsername ?? null : null,
        isVerified,
        privacy,
        stats: privacy.showStats ? careerStats : null,
        matchHistory: privacy.showHistory ? matchHistory : [],
        tournamentHistory: privacy.showHistory ? tournamentHistory : [],
        achievements,
        team: teamDetails,
      },
    };
  } catch (error) {
    console.error("getPublicPlayerProfile error", error);
    return { success: false, error: "Failed to load public player profile." };
  }
}

export async function getHeadToHeadRecord(
  playerAId: string,
  optionalPlayerBId?: string
): Promise<{ success: true; data: HeadToHeadRecord | null } | { success: false; error: string }> {
  try {
    let playerBId = optionalPlayerBId;
    if (!playerBId) {
      const viewer = await getCurrentUser();
      playerBId = viewer?.id;
    }

    if (!playerBId || playerAId === playerBId) {
      return { success: true, data: null };
    }

    const [userA, userB] = await Promise.all([
      prisma.user.findUnique({
        where: { id: playerAId },
        select: {
          id: true,
          firstName: true,
          username: true,
          profileImage: true,
          profile: { select: { veloxUsername: true, rank: true } },
        },
      }),
      prisma.user.findUnique({
        where: { id: playerBId },
        select: {
          id: true,
          firstName: true,
          username: true,
          profileImage: true,
          profile: { select: { veloxUsername: true, rank: true } },
        },
      }),
    ]);

    if (!userA || !userB) {
      return { success: false, error: "One or both players could not be found." };
    }

    const [teamsA, teamsB] = await Promise.all([
      prisma.teamMember.findMany({ where: { userId: playerAId }, select: { teamId: true } }),
      prisma.teamMember.findMany({ where: { userId: playerBId }, select: { teamId: true } }),
    ]);
    const teamIdsA = teamsA.map((t) => t.teamId);
    const teamIdsB = teamsB.map((t) => t.teamId);

    const h2hOrConditions: Prisma.MatchWhereInput[] = [
      { player1Id: playerAId, player2Id: playerBId },
      { player1Id: playerBId, player2Id: playerAId },
    ];
    if (teamIdsA.length > 0 && teamIdsB.length > 0) {
      h2hOrConditions.push(
        { team1Id: { in: teamIdsA }, team2Id: { in: teamIdsB } },
        { team1Id: { in: teamIdsB }, team2Id: { in: teamIdsA } }
      );
    }

    const matches = await prisma.match.findMany({
      where: {
        OR: h2hOrConditions,
        status: "COMPLETED",
      },
      include: {
        tournament: { include: { game: true } },
      },
      orderBy: { updatedAt: "desc" },
    });

    let playerAWins = 0;
    let playerBWins = 0;

    const formattedMatches = matches.map((m) => {
      const isPlayerA1 = m.player1Id === playerAId;
      const scoreA = isPlayerA1 ? (m.score1 ?? 0) : (m.score2 ?? 0);
      const scoreB = isPlayerA1 ? (m.score2 ?? 0) : (m.score1 ?? 0);
      const playerAWon = m.winnerId === playerAId || scoreA > scoreB;

      if (playerAWon) playerAWins += 1;
      else playerBWins += 1;

      return {
        matchId: m.id,
        tournamentTitle: m.tournament.title,
        tournamentSlug: m.tournament.slug,
        gameName: m.tournament.game.name,
        playerAScore: scoreA,
        playerBScore: scoreB,
        playerAWon,
        date: m.updatedAt.toISOString(),
      };
    });

    const record: HeadToHeadRecord = {
      playerA: {
        id: userA.id,
        name: userA.profile?.veloxUsername || userA.firstName || userA.username || "Player A",
        avatar: userA.profileImage,
        rank: userA.profile?.rank ?? "BRONZE",
      },
      playerB: {
        id: userB.id,
        name: userB.profile?.veloxUsername || userB.firstName || userB.username || "You",
        avatar: userB.profileImage,
        rank: userB.profile?.rank ?? "BRONZE",
      },
      totalEncounters: matches.length,
      playerAWins,
      playerBWins,
      matches: formattedMatches,
    };

    return { success: true, data: record };
  } catch (error) {
    console.error("getHeadToHeadRecord error", error);
    return { success: false, error: "Unable to load head-to-head record." };
  }
}

export async function getPlayerPrivacy(): Promise<PlayerPrivacySettings> {
  try {
    const user = await requireCurrentUser();
    const profile = await prisma.userProfile.findUnique({
      where: { userId: user.id },
      select: { gamerIds: true },
    });
    return parsePrivacy(profile?.gamerIds);
  } catch {
    return DEFAULT_PRIVACY;
  }
}

export async function updatePlayerPrivacy(
  settings: PlayerPrivacySettings
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireCurrentUser();
    const profile = await prisma.userProfile.findUnique({
      where: { userId: user.id },
      select: { gamerIds: true },
    });

    const existingGamerIds =
      typeof profile?.gamerIds === "object" && profile.gamerIds !== null
        ? (profile.gamerIds as Record<string, unknown>)
        : {};

    await prisma.userProfile.update({
      where: { userId: user.id },
      data: {
        gamerIds: {
          ...existingGamerIds,
          privacy: settings,
        },
      },
    });

    return { success: true };
  } catch (error) {
    console.error("updatePlayerPrivacy error", error);
    return { success: false, error: "Failed to update privacy settings." };
  }
}
