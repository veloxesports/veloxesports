import { describe, expect, it } from "vitest";
import { canConfirmPendingMatchResult, canSubmitMatchResult, matchCenterScoreLabel, nextBracketSlotForWinner } from "../src/lib/matches/flow";

describe("match flow safeguards", () => {
  const firstBracketMatch = { player1Id: "player-a", player2Id: "player-b", team1Id: null, team2Id: null, bracketPosition: 0 };

  it("advances players and teams into matching bracket fields", () => {
    expect(nextBracketSlotForWinner(firstBracketMatch, "player-a")).toBe("player1Id");
    expect(nextBracketSlotForWinner({ ...firstBracketMatch, bracketPosition: 1 }, "player-b")).toBe("player2Id");
    expect(nextBracketSlotForWinner({ player1Id: null, player2Id: null, team1Id: "team-a", team2Id: "team-b", bracketPosition: 0 }, "team-a")).toBe("team1Id");
    expect(nextBracketSlotForWinner({ player1Id: null, player2Id: null, team1Id: "team-a", team2Id: "team-b", bracketPosition: 1 }, "team-b")).toBe("team2Id");
  });

  it("does not create a misleading score for a live match without a result", () => {
    expect(matchCenterScoreLabel("LIVE", null, null)).toBe("VS");
    expect(matchCenterScoreLabel("LIVE", 2, 1)).toBe("2 – 1");
    expect(matchCenterScoreLabel("COMPLETED", null, null)).toBe("—");
  });

  it("allows actions only in their valid match states", () => {
    expect(canSubmitMatchResult("SCHEDULED")).toBe(true);
    expect(canSubmitMatchResult("LIVE")).toBe(true);
    expect(canSubmitMatchResult("AWAITING_RESULT")).toBe(false);
    expect(canConfirmPendingMatchResult("AWAITING_RESULT", "opponent", "player")).toBe(true);
    expect(canConfirmPendingMatchResult("DISPUTED", "opponent", "player")).toBe(false);
    expect(canConfirmPendingMatchResult("AWAITING_RESULT", "player", "player")).toBe(false);
  });
});
