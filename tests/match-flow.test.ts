import { describe, expect, it } from "vitest";
import { areMatchSidesOpposing, canConfirmPendingMatchResult, canSubmitMatchResult, hasBothMatchParticipants, isMatchInCenterTab, matchCenterScoreLabel, nextBracketSlotForWinner } from "../src/lib/matches/flow";

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

  it("recognizes a playable fixture only after both sides are known", () => {
    expect(hasBothMatchParticipants({ ...firstBracketMatch })).toBe(true);
    expect(hasBothMatchParticipants({ ...firstBracketMatch, player2Id: null })).toBe(false);
    expect(hasBothMatchParticipants({ player1Id: null, player2Id: null, team1Id: "team-a", team2Id: "team-b" })).toBe(true);
  });

  it("requires an opposing side to confirm or reject a result", () => {
    expect(areMatchSidesOpposing([2], [1])).toBe(true);
    expect(areMatchSidesOpposing([1], [1])).toBe(false);
    expect(areMatchSidesOpposing([1, 2], [1])).toBe(false);
    expect(areMatchSidesOpposing([], [2])).toBe(false);
  });

  it("places every user-visible fixture state in the correct Match Center tab", () => {
    expect(isMatchInCenterTab("SCHEDULED", "Upcoming")).toBe(true);
    expect(isMatchInCenterTab("READY", "Upcoming")).toBe(true);
    expect(isMatchInCenterTab("LIVE", "Live")).toBe(true);
    expect(isMatchInCenterTab("AWAITING_RESULT", "Live")).toBe(true);
    expect(isMatchInCenterTab("UNDER_REVIEW", "Live")).toBe(true);
    expect(isMatchInCenterTab("DISPUTED", "Live")).toBe(true);
    expect(isMatchInCenterTab("COMPLETED", "Completed")).toBe(true);
    expect(isMatchInCenterTab("CANCELLED", "Completed")).toBe(true);
    expect(isMatchInCenterTab("DISPUTED", "Upcoming")).toBe(false);
    expect(matchCenterScoreLabel("CANCELLED", null, null)).toBe("—");
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
