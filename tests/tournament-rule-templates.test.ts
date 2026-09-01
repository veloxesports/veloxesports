import { describe, expect, it } from "vitest";
import { getTournamentRulesTemplate } from "../src/lib/tournaments/rule-templates";

describe("game-specific tournament rule templates", () => {
  it("covers the VELOX operating rules for every generated template", () => {
    const rules = getTournamentRulesTemplate({ name: "Valorant", slug: "valorant" });

    expect(rules).toContain("Tournament format and match settings");
    expect(rules).toContain("Player and team eligibility");
    expect(rules).toContain("Scheduling and check-in");
    expect(rules).toContain("Results, reporting, and evidence");
    expect(rules).toContain("Disconnections and technical issues");
    expect(rules).toContain("Fair play and prohibited behavior");
    expect(rules).toContain("Disputes and forfeits");
    expect(rules).toContain("Prizes and payments");
    expect(rules).toContain("Organizer decisions");
  });

  it("uses game-specific match rules while keeping an appropriate fallback", () => {
    expect(getTournamentRulesTemplate({ name: "PUBG", slug: "pubg" })).toContain("custom room");
    expect(getTournamentRulesTemplate({ name: "Chess", slug: "chess" })).toContain("Chess engines");
    expect(getTournamentRulesTemplate({ name: "Rocket League", slug: "rocket-league" })).toContain("game mode, platform, region");
  });
});
