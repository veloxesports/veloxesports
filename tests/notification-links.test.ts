import { describe, expect, it } from "vitest";
import { notificationMiniAppUrl, notificationTarget } from "../src/lib/notifications/links";

describe("notification deep links", () => {
  it("opens a specific match whenever the notification has a match identifier", () => {
    expect(notificationTarget("MATCH", { matchId: "match-123" })).toEqual({ href: "/matches/match-123", label: "Open match" });
  });

  it("opens a tournament detail when a slug is available and the tournament list otherwise", () => {
    expect(notificationTarget("TOURNAMENT", { tournamentId: "event-id", tournamentSlug: "nightfall-cup" })).toEqual({ href: "/tournaments/nightfall-cup", label: "Open tournament" });
    expect(notificationTarget("TOURNAMENT", { tournamentId: "event-id" })).toEqual({ href: "/tournaments", label: "Open tournaments" });
  });

  it("routes payment, profile, and general updates to their appropriate Mini App sections", () => {
    expect(notificationTarget("PAYMENT", {})).toEqual({ href: "/wallet", label: "Open wallet" });
    expect(notificationTarget("ACHIEVEMENT", {})).toEqual({ href: "/profile", label: "Open profile" });
    expect(notificationTarget("SYSTEM", {})).toEqual({ href: "/notifications", label: "Open alerts" });
  });

  it("encodes untrusted identifiers before putting them into a route", () => {
    expect(notificationTarget("MATCH", { matchId: "a/b" }).href).toBe("/matches/a%2Fb");
  });

  it("creates a Telegram Web App action only for the configured HTTPS app URL", () => {
    const originalUrl = process.env.NEXT_PUBLIC_APP_URL;
    try {
      process.env.NEXT_PUBLIC_APP_URL = "https://velox.example/";
      expect(notificationMiniAppUrl("/matches/match-123")).toBe("https://velox.example/matches/match-123");
      process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
      expect(notificationMiniAppUrl("/matches/match-123")).toBeNull();
    } finally {
      if (originalUrl === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
      else process.env.NEXT_PUBLIC_APP_URL = originalUrl;
    }
  });
});
