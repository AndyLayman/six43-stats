import { describe, it, expect } from "vitest";
import {
  createInitialGameState,
  getCurrentBatter,
  recordAtBat,
  recordOpponentAtBat,
  addOpponentBatter,
} from "./game-engine";
import type { GameState, RecordAtBatPayload } from "./types";
import { getDefaultRunnerAdvances } from "./baseball-rules";

// Small helpers to keep the tests readable. Real tests should look like
// english: "given this state, when this action, expect this result."

const PLAYERS = [
  { id: 1, first_name: "Alice", last_name: "One" },
  { id: 2, first_name: "Bob", last_name: "Two" },
  { id: 3, first_name: "Cam", last_name: "Three" },
];

const LINEUP = [
  { player_id: 1, batting_order: 1 },
  { player_id: 2, batting_order: 2 },
  { player_id: 3, batting_order: 3 },
];

function freshState(): GameState {
  // Home team (we bat bottom) so that recordAtBat uses our lineup.
  const s = createInitialGameState("game-1", LINEUP, PLAYERS);
  return { ...s, currentHalf: "bottom" };
}

function payload(overrides: Partial<RecordAtBatPayload> = {}): RecordAtBatPayload {
  return {
    result: "1B",
    sprayX: null,
    sprayY: null,
    rbis: 0,
    stolenBases: 0,
    scorebookNotation: "",
    fieldingPlays: [],
    runnerAdvances: [],
    ...overrides,
  };
}

describe("createInitialGameState", () => {
  it("starts in top of 1st with no outs, no runners, no score", () => {
    const state = createInitialGameState("g1", LINEUP, PLAYERS);
    expect(state.currentInning).toBe(1);
    expect(state.currentHalf).toBe("top");
    expect(state.outs).toBe(0);
    expect(state.ourScore).toBe(0);
    expect(state.opponentScore).toBe(0);
    expect(state.runnerFirst).toBeNull();
    expect(state.runnerSecond).toBeNull();
    expect(state.runnerThird).toBeNull();
  });
});

describe("getCurrentBatter", () => {
  it("returns the first player in the lineup at start", () => {
    const state = freshState();
    const batter = getCurrentBatter(state);
    expect(batter?.playerId).toBe(1);
    expect(batter?.playerName).toBe("Alice One");
  });

  it("wraps back to the top of the order after the last batter", () => {
    const state = { ...freshState(), currentBatterIndex: 3 };
    expect(getCurrentBatter(state)?.playerId).toBe(1);
  });
});

describe("recordAtBat — batter placement", () => {
  it("single puts batter on first and advances to next batter", () => {
    const state = recordAtBat(freshState(), payload({ result: "1B" }));
    expect(state.runnerFirst?.playerId).toBe(1);
    expect(state.runnerSecond).toBeNull();
    expect(state.runnerThird).toBeNull();
    expect(state.currentBatterIndex).toBe(1);
    expect(state.outs).toBe(0);
  });

  it("double puts batter on second", () => {
    const state = recordAtBat(freshState(), payload({ result: "2B" }));
    expect(state.runnerFirst).toBeNull();
    expect(state.runnerSecond?.playerId).toBe(1);
  });

  it("triple puts batter on third", () => {
    const state = recordAtBat(freshState(), payload({ result: "3B" }));
    expect(state.runnerThird?.playerId).toBe(1);
  });

  it("walk puts batter on first", () => {
    const state = recordAtBat(freshState(), payload({ result: "BB" }));
    expect(state.runnerFirst?.playerId).toBe(1);
    expect(state.outs).toBe(0);
  });

  it("strikeout records one out and no runner", () => {
    const state = recordAtBat(freshState(), payload({ result: "SO" }));
    expect(state.runnerFirst).toBeNull();
    expect(state.outs).toBe(1);
  });
});

describe("recordAtBat — runners", () => {
  it("single with runner on 1st: runner goes to 2nd, batter on 1st", () => {
    const start = freshState();
    const defaults = getDefaultRunnerAdvances("1B", {
      first: { playerId: 2, opponentBatterId: null, playerName: "Bob Two" },
      second: null,
      third: null,
    });
    const stateWithRunner: GameState = {
      ...start,
      runnerFirst: { playerId: 2, opponentBatterId: null, playerName: "Bob Two" },
      currentBatterIndex: 0,
    };
    const result = recordAtBat(
      stateWithRunner,
      payload({ result: "1B", runnerAdvances: defaults })
    );
    expect(result.runnerFirst?.playerId).toBe(1); // batter
    expect(result.runnerSecond?.playerId).toBe(2); // prior runner
    expect(result.runnerThird).toBeNull();
    expect(result.ourScore).toBe(0);
  });

  it("home run with bases loaded scores 4 and clears the bases", () => {
    const start: GameState = {
      ...freshState(),
      runnerFirst: { playerId: 2, opponentBatterId: null, playerName: "Bob Two" },
      runnerSecond: { playerId: 3, opponentBatterId: null, playerName: "Cam Three" },
      runnerThird: { playerId: 2, opponentBatterId: null, playerName: "Bob Two" },
    };
    const defaults = getDefaultRunnerAdvances("HR", {
      first: start.runnerFirst,
      second: start.runnerSecond,
      third: start.runnerThird,
    });
    const result = recordAtBat(start, payload({ result: "HR", runnerAdvances: defaults }));
    expect(result.ourScore).toBe(4);
    expect(result.runnerFirst).toBeNull();
    expect(result.runnerSecond).toBeNull();
    expect(result.runnerThird).toBeNull();
  });

  it("bases-loaded walk forces in a run and keeps bases loaded", () => {
    const start: GameState = {
      ...freshState(),
      runnerFirst: { playerId: 2, opponentBatterId: null, playerName: "Bob" },
      runnerSecond: { playerId: 3, opponentBatterId: null, playerName: "Cam" },
      runnerThird: { playerId: 2, opponentBatterId: null, playerName: "Bob" },
    };
    const defaults = getDefaultRunnerAdvances("BB", {
      first: start.runnerFirst,
      second: start.runnerSecond,
      third: start.runnerThird,
    });
    const result = recordAtBat(start, payload({ result: "BB", runnerAdvances: defaults }));
    expect(result.ourScore).toBe(1);
    expect(result.runnerFirst).not.toBeNull();
    expect(result.runnerSecond).not.toBeNull();
    expect(result.runnerThird).not.toBeNull();
  });
});

describe("recordAtBat — half-inning transitions", () => {
  it("third out in the bottom half advances inning and clears runners", () => {
    const start: GameState = {
      ...freshState(),
      outs: 2,
      runnerFirst: { playerId: 2, opponentBatterId: null, playerName: "Bob" },
    };
    const result = recordAtBat(start, payload({ result: "SO" }));
    expect(result.outs).toBe(0);
    expect(result.currentInning).toBe(2);
    expect(result.currentHalf).toBe("top");
    expect(result.runnerFirst).toBeNull();
  });

  it("third out in the top half moves to bottom of same inning", () => {
    const start: GameState = { ...freshState(), currentHalf: "top", outs: 2 };
    // Top-half at-bats are opponent batters, so we need an opponent lineup.
    const withOpp = addOpponentBatter(start, {
      id: "opp-1",
      game_id: "game-1",
      name: "Visitor",
      batting_order: 1,
    });
    const result = recordOpponentAtBat(withOpp, payload({ result: "SO" }));
    expect(result.outs).toBe(0);
    expect(result.currentInning).toBe(1);
    expect(result.currentHalf).toBe("bottom");
  });
});
