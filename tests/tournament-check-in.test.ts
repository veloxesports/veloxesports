import { describe, expect, it } from "vitest";
import { canCheckIn, getCheckInWindow } from "../src/lib/tournaments/check-in";

describe("tournament check-in window", () => {
  const startDate = new Date("2026-09-01T18:00:00.000Z");

  it("opens only for the configured period before a tournament starts", () => {
    expect(getCheckInWindow(startDate, 60, new Date("2026-09-01T16:59:59.000Z")).phase).toBe("NOT_STARTED");
    expect(getCheckInWindow(startDate, 60, new Date("2026-09-01T17:00:00.000Z")).phase).toBe("OPEN");
    expect(getCheckInWindow(startDate, 60, new Date("2026-09-01T17:59:59.000Z")).phase).toBe("OPEN");
    expect(getCheckInWindow(startDate, 60, new Date("2026-09-01T18:00:00.000Z")).phase).toBe("CLOSED");
  });

  it("requires both the check-in lifecycle status and an open time window", () => {
    const duringWindow = new Date("2026-09-01T17:30:00.000Z");
    expect(canCheckIn("CHECK_IN", startDate, 60, duringWindow)).toBe(true);
    expect(canCheckIn("UPCOMING", startDate, 60, duringWindow)).toBe(false);
    expect(canCheckIn("CHECK_IN", startDate, 60, new Date("2026-09-01T18:00:00.000Z"))).toBe(false);
  });
});
