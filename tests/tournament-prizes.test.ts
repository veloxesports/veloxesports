import { describe, expect, it } from "vitest";
import { splitPlacementPrize, splitPrizeAmount } from "../src/lib/tournaments/prizes";

describe("tournament prize allocation", () => {
  it("gives an indivisible remainder to the first recipient (the captain for teams)", () => {
    expect(splitPrizeAmount(10, ["captain", "member-a", "member-b"]))
      .toEqual([
        { userId: "captain", amount: 4 },
        { userId: "member-a", amount: 3 },
        { userId: "member-b", amount: 3 },
      ]);
  });

  it("splits a shared placement before splitting each team reward", () => {
    expect(splitPlacementPrize(101, ["team-a", "team-b"]))
      .toEqual([
        { entityId: "team-a", amount: 51 },
        { entityId: "team-b", amount: 50 },
      ]);
  });

  it("does not create payouts when no eligible recipient exists", () => {
    expect(splitPrizeAmount(500, [])).toEqual([]);
    expect(splitPlacementPrize(500, [])).toEqual([]);
  });
});
