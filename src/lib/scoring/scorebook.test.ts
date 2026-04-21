import { describe, it, expect } from "vitest";
import {
  POSITIONS,
  POSITION_NUMBERS,
  sprayToPosition,
  sprayCfSide,
  generateNotation,
  parseNotationToFieldingPlays,
  resolvePositionToPlayerId,
  getResultColor,
} from "./scorebook";
import type { BaseState } from "./baseball-rules";
import type { BaseRunner, GameLineup, Player } from "./types";

const runner = (name: string): BaseRunner => ({
  playerId: null,
  opponentBatterId: null,
  playerName: name,
});

describe("POSITIONS / POSITION_NUMBERS", () => {
  it("maps Retrosheet position numbers to abbreviations", () => {
    expect(POSITIONS[1]).toBe("P");
    expect(POSITIONS[6]).toBe("SS");
    expect(POSITIONS[8]).toBe("CF");
  });

  it("reverse mapping agrees", () => {
    expect(POSITION_NUMBERS["P"]).toBe(1);
    expect(POSITION_NUMBERS["SS"]).toBe(6);
    expect(POSITION_NUMBERS["CF"]).toBe(8);
  });
});

describe("sprayToPosition — maps spray chart (x,y) to a fielding position", () => {
  // Home plate is at (150, 280). SVG y increases downward, so smaller y = deeper in the field.
  it("deep center field is CF (8)", () => {
    expect(sprayToPosition(150, 50)).toBe(8);
  });

  it("deep left field is LF (7)", () => {
    expect(sprayToPosition(50, 60)).toBe(7);
  });

  it("deep right field is RF (9)", () => {
    expect(sprayToPosition(250, 60)).toBe(9);
  });

  it("shallow third-base side is 3B (5)", () => {
    expect(sprayToPosition(90, 200)).toBe(5);
  });

  it("shallow first-base side is 1B (3)", () => {
    expect(sprayToPosition(210, 200)).toBe(3);
  });

  it("very close to home plate returns pitcher (1)", () => {
    expect(sprayToPosition(150, 260)).toBe(1);
  });
});

describe("sprayCfSide", () => {
  it("x <= 150 is LC, x > 150 is RC", () => {
    expect(sprayCfSide(100, 50)).toBe("LC");
    expect(sprayCfSide(150, 50)).toBe("LC");
    expect(sprayCfSide(200, 50)).toBe("RC");
  });
});

describe("generateNotation — scorebook shorthand for a plate appearance", () => {
  it("strikeout is K", () => {
    expect(generateNotation("SO", null)).toBe("K");
  });

  it("walk is BB, HBP is HBP, HR is HR (no position)", () => {
    expect(generateNotation("BB", null)).toBe("BB");
    expect(generateNotation("HBP", null)).toBe("HBP");
    expect(generateNotation("HR", 8)).toBe("HR");
  });

  it("hits include hit location: 1B-7, 2B-8, 3B-9", () => {
    expect(generateNotation("1B", 7)).toBe("1B-7");
    expect(generateNotation("2B", 8)).toBe("2B-8");
    expect(generateNotation("3B", 9)).toBe("3B-9");
  });

  it("ground out uses dash-to-first: 6-3, 4-3; 3U when unassisted", () => {
    expect(generateNotation("GO", 6)).toBe("6-3");
    expect(generateNotation("GO", 4)).toBe("4-3");
    expect(generateNotation("GO", 3)).toBe("3U");
  });

  it("fly out prefixes with F: F8, F7", () => {
    expect(generateNotation("FO", 8)).toBe("F8");
    expect(generateNotation("FO", 7)).toBe("F7");
  });

  it("errors: E6, E3", () => {
    expect(generateNotation("E", 6)).toBe("E6");
    expect(generateNotation("E", 3)).toBe("E3");
  });

  it("DP without base state falls back to standard sequences by field position", () => {
    expect(generateNotation("DP", 6)).toBe("6-4-3");
    expect(generateNotation("DP", 4)).toBe("4-6-3");
    expect(generateNotation("DP", 5)).toBe("5-4-3");
  });

  it("DP with base state uses rules engine for context-aware notation", () => {
    const basesWithRunnerOnFirst: BaseState = { first: runner("A"), second: null, third: null };
    expect(generateNotation("DP", 6, basesWithRunnerOnFirst)).toBe("6-4-3");
  });

  it("CF notation gets annotated with LC/RC when cfSide provided", () => {
    expect(generateNotation("FO", 8, undefined, "LC")).toBe("F8LC");
    expect(generateNotation("1B", 8, undefined, "RC")).toBe("1B-8RC");
  });
});

describe("parseNotationToFieldingPlays — assign PO/A/E to fielders", () => {
  it("strikeout gives catcher a PO", () => {
    const plays = parseNotationToFieldingPlays("K", "SO");
    expect(plays).toEqual([
      { positionNumber: 2, playType: "PO", description: "K", cfSide: undefined },
    ]);
  });

  it("error on shortstop: E6 → E to position 6", () => {
    const plays = parseNotationToFieldingPlays("E6", "E");
    expect(plays).toHaveLength(1);
    expect(plays[0]).toMatchObject({ positionNumber: 6, playType: "E" });
  });

  it("fly out: F8 → PO to position 8", () => {
    const plays = parseNotationToFieldingPlays("F8", "FO");
    expect(plays).toHaveLength(1);
    expect(plays[0]).toMatchObject({ positionNumber: 8, playType: "PO" });
  });

  it("ground out 6-3: SS gets assist, 1B gets putout", () => {
    const plays = parseNotationToFieldingPlays("6-3", "GO");
    expect(plays).toEqual([
      { positionNumber: 6, playType: "A", description: "6-3", cfSide: undefined },
      { positionNumber: 3, playType: "PO", description: "6-3", cfSide: undefined },
    ]);
  });

  it("unassisted 3U: 1B gets only a putout", () => {
    const plays = parseNotationToFieldingPlays("3U", "GO");
    expect(plays).toEqual([
      { positionNumber: 3, playType: "PO", description: "3U", cfSide: undefined },
    ]);
  });

  it("6-4-3 double play: SS assist, 2B putout+assist, 1B putout", () => {
    const plays = parseNotationToFieldingPlays("6-4-3", "DP");
    // First out (force at 2nd): 6 assists, 4 puts out
    // Second out (throw to 1st): 4 assists, 3 puts out
    expect(plays).toEqual([
      { positionNumber: 6, playType: "A", description: "6-4-3", cfSide: undefined },
      { positionNumber: 4, playType: "PO", description: "6-4-3", cfSide: undefined },
      { positionNumber: 4, playType: "A", description: "6-4-3", cfSide: undefined },
      { positionNumber: 3, playType: "PO", description: "6-4-3", cfSide: undefined },
    ]);
  });

  it("CF side (8LC) is preserved on the play", () => {
    const plays = parseNotationToFieldingPlays("F8LC", "FO");
    expect(plays[0]).toMatchObject({ positionNumber: 8, playType: "PO", cfSide: "LC" });
  });

  it("line drive DP (L6-DP) → PO to the catcher of the liner", () => {
    const plays = parseNotationToFieldingPlays("L6-DP", "DP");
    expect(plays).toEqual([
      { positionNumber: 6, playType: "PO", description: "L6-DP", cfSide: undefined },
    ]);
  });

  it("hits and walks generate no fielding plays", () => {
    expect(parseNotationToFieldingPlays("1B-7", "1B")).toEqual([]);
    expect(parseNotationToFieldingPlays("BB", "BB")).toEqual([]);
    expect(parseNotationToFieldingPlays("HR", "HR")).toEqual([]);
  });
});

describe("resolvePositionToPlayerId", () => {
  const players: Player[] = [
    {
      id: 1, first_name: "A", last_name: "Pitcher", number: "", position: "P",
      bats: null, throws: null, photo_file: null, intro_file: null, song_file: null,
      combo_file: null, sort_order: 1,
    },
    {
      id: 2, first_name: "B", last_name: "Short", number: "", position: "SS",
      bats: null, throws: null, photo_file: null, intro_file: null, song_file: null,
      combo_file: null, sort_order: 2,
    },
    {
      id: 3, first_name: "C", last_name: "Center", number: "", position: "CF",
      bats: null, throws: null, photo_file: null, intro_file: null, song_file: null,
      combo_file: null, sort_order: 3,
    },
  ];

  const lineup: GameLineup[] = [
    { id: "l1", game_id: "g", player_id: 1, batting_order: 1, position: "P" },
    { id: "l2", game_id: "g", player_id: 2, batting_order: 2, position: "SS" },
    { id: "l3", game_id: "g", player_id: 3, batting_order: 3, position: "CF" },
  ];

  it("resolves SS (position 6) from game lineup", () => {
    expect(resolvePositionToPlayerId(6, lineup, players)).toBe(2);
  });

  it("per-inning assignments override the game lineup", () => {
    const inningPositions = [{ player_id: 99, position: "SS" }];
    expect(resolvePositionToPlayerId(6, lineup, players, inningPositions)).toBe(99);
  });

  it("returns null for a position nobody plays", () => {
    const emptyLineup: GameLineup[] = [];
    expect(resolvePositionToPlayerId(7, emptyLineup, [])).toBeNull();
  });

  it("CF with LC hint prefers a player listed at LC", () => {
    const lcLineup: GameLineup[] = [
      { id: "l1", game_id: "g", player_id: 10, batting_order: 1, position: "LC" },
      { id: "l2", game_id: "g", player_id: 11, batting_order: 2, position: "RC" },
    ];
    expect(resolvePositionToPlayerId(8, lcLineup, [], undefined, "LC")).toBe(10);
    expect(resolvePositionToPlayerId(8, lcLineup, [], undefined, "RC")).toBe(11);
  });
});

describe("getResultColor", () => {
  it("returns a color for every standard result", () => {
    expect(getResultColor("1B")).toMatch(/^#/);
    expect(getResultColor("HR")).toMatch(/^#/);
    expect(getResultColor("SO")).toMatch(/^#/);
    expect(getResultColor("E")).toMatch(/^#/);
  });
});
