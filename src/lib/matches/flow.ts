export type BracketMatchParticipants = {
  player1Id: string | null;
  player2Id: string | null;
  team1Id: string | null;
  team2Id: string | null;
  bracketPosition: number | null;
};

export type NextBracketSlot = "player1Id" | "player2Id" | "team1Id" | "team2Id";

export function canSubmitMatchResult(status: string) {
  return ["SCHEDULED", "READY", "LIVE"].includes(status);
}

export function isAwaitingOpponentConfirmation(status: string) {
  return status === "AWAITING_RESULT";
}

export function canConfirmPendingMatchResult(status: string, pendingResultSubmitterId: string | undefined, currentUserId: string) {
  return isAwaitingOpponentConfirmation(status) && pendingResultSubmitterId !== undefined && pendingResultSubmitterId !== currentUserId;
}

/** Chooses the correct participant field when a result advances to the next round. */
export function nextBracketSlotForWinner(match: BracketMatchParticipants, winnerId: string): NextBracketSlot | null {
  if (match.bracketPosition === null) return null;

  const winnerIsFirstSide = winnerId === match.player1Id || winnerId === match.team1Id;
  const winnerIsSecondSide = winnerId === match.player2Id || winnerId === match.team2Id;
  if (!winnerIsFirstSide && !winnerIsSecondSide) return null;

  const advancesIntoFirstSlot = match.bracketPosition % 2 === 0;
  const winnerIsTeam = winnerId === match.team1Id || winnerId === match.team2Id;

  if (winnerIsTeam) return advancesIntoFirstSlot ? "team1Id" : "team2Id";
  return advancesIntoFirstSlot ? "player1Id" : "player2Id";
}

export function matchCenterScoreLabel(status: string, score1: number | null, score2: number | null) {
  if (score1 !== null && score2 !== null) return `${score1} – ${score2}`;
  return status === "COMPLETED" ? "—" : "VS";
}
