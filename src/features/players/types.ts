export type PlayerSearchResult = {
  id: string;
  khemoraUsername: string | null;
  displayName: string;
  username: string | null;
  profileImage: string | null;
  rank: string;
  level: number;
  xp: number;
  primaryGame: string | null;
  teamName: string | null;
  teamLogoUrl: string | null;
  isVerified: boolean;
  activityStatus: "ONLINE" | "IN_MATCH" | "RECENTLY_ACTIVE";
};

export type GameStatItem = {
  gameName: string;
  gameSlug: string;
  inGameId: string | null;
  matchesPlayed: number;
  wins: number;
  losses: number;
  winRate: number;
};

export type PlayerCareerStats = {
  tournamentsEntered: number;
  matchesPlayed: number;
  wins: number;
  losses: number;
  winRate: number;
  tournamentWins: number;
  topFinishes: number;
  currentStreak: number;
  globalRank: number;
  gameStats: GameStatItem[];
};

export type PlayerMatchHistoryItem = {
  id: string;
  tournamentId: string;
  tournamentTitle: string;
  tournamentSlug: string;
  gameName: string;
  roundName: string;
  opponentId: string | null;
  opponentName: string;
  opponentAvatar: string | null;
  playerScore: number;
  opponentScore: number;
  isWinner: boolean;
  scheduledTime: string | null;
  completedAt: string;
};

export type PlayerTournamentHistoryItem = {
  id: string;
  title: string;
  slug: string;
  gameName: string;
  bannerUrl: string | null;
  startDate: string;
  format: string;
  placement: number | null;
  prizeWon: number | null;
  status: string;
};

export type PlayerAchievementItem = {
  id: string;
  name: string;
  description: string;
  iconUrl: string | null;
  xpReward: number;
  earnedAt: string | null;
  isUnlocked: boolean;
};

export type PlayerTeamRosterMember = {
  userId: string;
  name: string;
  profileImage: string | null;
  role: "CAPTAIN" | "MEMBER";
  rank: string;
  level: number;
};

export type PlayerTeamDetails = {
  id: string;
  name: string;
  logoUrl: string | null;
  userRole: "CAPTAIN" | "MEMBER";
  captainId: string;
  totalMembers: number;
  teamWins: number;
  teamLosses: number;
  roster: PlayerTeamRosterMember[];
};

export type PlayerPrivacySettings = {
  showHistory: boolean;
  showStats: boolean;
  showDiscord: boolean;
  showTeam: boolean;
};

export type HeadToHeadMatchItem = {
  matchId: string;
  tournamentTitle: string;
  tournamentSlug: string;
  gameName: string;
  playerAScore: number;
  playerBScore: number;
  playerAWon: boolean;
  date: string;
};

export type HeadToHeadRecord = {
  playerA: {
    id: string;
    name: string;
    avatar: string | null;
    rank: string;
  };
  playerB: {
    id: string;
    name: string;
    avatar: string | null;
    rank: string;
  };
  totalEncounters: number;
  playerAWins: number;
  playerBWins: number;
  matches: HeadToHeadMatchItem[];
};

export type PublicPlayerProfile = {
  id: string;
  khemoraUsername: string | null;
  displayName: string;
  telegramUsername: string | null;
  profileImage: string | null;
  country: string | null;
  rank: string;
  level: number;
  xp: number;
  joinedDate: string;
  favoriteGames: string[];
  gamerIds: Record<string, string>;
  discordConnected: boolean;
  discordUsername: string | null;
  isVerified: boolean;
  privacy: PlayerPrivacySettings;
  stats: PlayerCareerStats | null;
  matchHistory: PlayerMatchHistoryItem[];
  tournamentHistory: PlayerTournamentHistoryItem[];
  achievements: PlayerAchievementItem[];
  team: PlayerTeamDetails | null;
};
