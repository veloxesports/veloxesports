import { describe, expect, it } from "vitest";
import type { FilterOption } from "../src/components/tournaments/TournamentFilterSelector";

describe("Tournament Filter Selector & Discovery", () => {
  const games = [
    { id: "game-1", name: "Chess" },
    { id: "game-2", name: "PUBG Mobile" },
    { id: "game-3", name: "Fall Guys" },
  ];

  const formats = ["SINGLE_ELIMINATION", "DOUBLE_ELIMINATION", "ROUND_ROBIN"];
  const regions = ["Global", "North America", "Europe"];

  it("maps games to clean filter options including an 'all' option", () => {
    const gameOptions: FilterOption[] = [
      { value: "all", label: "All Games" },
      ...games.map((g) => ({ value: g.id, label: g.name })),
    ];

    expect(gameOptions).toHaveLength(4);
    expect(gameOptions[0]).toEqual({ value: "all", label: "All Games" });
    expect(gameOptions[1]).toEqual({ value: "game-1", label: "Chess" });
    expect(gameOptions[2]).toEqual({ value: "game-2", label: "PUBG Mobile" });
    expect(gameOptions[3]).toEqual({ value: "game-3", label: "Fall Guys" });
  });

  it("maps formats replacing underscores with spaces", () => {
    const formatLabel = (value: string) => value.replaceAll("_", " ");
    const formatOptions: FilterOption[] = [
      { value: "all", label: "All Formats" },
      ...formats.map((f) => ({ value: f, label: formatLabel(f) })),
    ];

    expect(formatOptions).toHaveLength(4);
    expect(formatOptions[0]).toEqual({ value: "all", label: "All Formats" });
    expect(formatOptions[1]).toEqual({ value: "SINGLE_ELIMINATION", label: "SINGLE ELIMINATION" });
  });

  it("maps regions cleanly", () => {
    const regionOptions: FilterOption[] = [
      { value: "all", label: "All Regions" },
      ...regions.map((r) => ({ value: r, label: r })),
    ];

    expect(regionOptions).toHaveLength(4);
    expect(regionOptions[0]).toEqual({ value: "all", label: "All Regions" });
    expect(regionOptions[1]).toEqual({ value: "Global", label: "Global" });
  });

  it("filters tournament items accurately by game, format, and region", () => {
    const sampleTournaments = [
      {
        id: "t1",
        title: "VELOX Chess Grand Prix",
        game: { id: "game-1", name: "Chess" },
        format: "SINGLE_ELIMINATION",
        region: "Global",
        status: "REGISTRATION_OPEN",
        isPaid: false,
        participantType: "INDIVIDUAL" as const,
      },
      {
        id: "t2",
        title: "PUBG Mobile Masters",
        game: { id: "game-2", name: "PUBG Mobile" },
        format: "DOUBLE_ELIMINATION",
        region: "Europe",
        status: "LIVE",
        isPaid: true,
        participantType: "TEAM" as const,
      },
    ];

    // Filter by game
    const chessOnly = sampleTournaments.filter((t) => t.game.id === "game-1");
    expect(chessOnly).toHaveLength(1);
    expect(chessOnly[0].title).toBe("VELOX Chess Grand Prix");

    // Filter by format
    const doubleElimOnly = sampleTournaments.filter((t) => t.format === "DOUBLE_ELIMINATION");
    expect(doubleElimOnly).toHaveLength(1);
    expect(doubleElimOnly[0].title).toBe("PUBG Mobile Masters");

    // Filter by region
    const europeOnly = sampleTournaments.filter((t) => t.region === "Europe");
    expect(europeOnly).toHaveLength(1);
    expect(europeOnly[0].id).toBe("t2");
  });
});
