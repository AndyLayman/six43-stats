import type { GameState, RecordAtBatPayload, RunnerAdvance, BaseRunner, OpponentBatter, PlateAppearanceResult } from "./types";
import { isAtBat, isHit, totalBases } from "../stats/calculations";

export function createInitialGameState(
  gameId: string,
  lineup: { player_id: number; batting_order: number }[],
  players: { id: number; name: string }[]
): GameState {
  return {
    gameId,
    currentInning: 1,
    currentHalf: "top",
    outs: 0,
    runnerFirst: null,
    runnerSecond: null,
    runnerThird: null,
    currentBatterIndex: 0,
    opponentBatterIndex: 0,
    ourScore: 0,
    opponentScore: 0,
    lineup: lineup.map((l) => ({ ...l, id: "", game_id: gameId, position: "" })),
    players: players.map((p) => ({ ...p, number: "", bats: null, throws: null, photo_file: null, intro_file: null, song_file: null, combo_file: null, sort_order: 0 })),
    opponentLineup: [],
  };
}

export function getCurrentBatter(state: GameState): BaseRunner | null {
  if (state.lineup.length === 0) return null;
  const idx = state.currentBatterIndex % state.lineup.length;
  const lineupEntry = state.lineup[idx];
  const player = state.players.find((p) => p.id === lineupEntry.player_id);
  return {
    playerId: lineupEntry.player_id,
    opponentBatterId: null,
    playerName: player?.name ?? `Player ${lineupEntry.player_id}`,
  };
}

export function getCurrentOpponentBatter(state: GameState): BaseRunner | null {
  if (state.opponentLineup.length === 0) return null;
  if (state.opponentBatterIndex >= state.opponentLineup.length) return null;
  const batter = state.opponentLineup[state.opponentBatterIndex];
  return {
    playerId: null,
    opponentBatterId: batter.id,
    playerName: batter.name,
  };
}

export function addOpponentBatter(state: GameState, batter: OpponentBatter): GameState {
  return {
    ...state,
    opponentLineup: [...state.opponentLineup, batter],
  };
}

// --- Results where the batter is out (does not reach base) ---
const BATTER_OUT_RESULTS: PlateAppearanceResult[] = ["GO", "FO", "SAC", "SO", "DP"];

// --- Results where the batter reaches a base ---
const BATTER_ON_FIRST: PlateAppearanceResult[] = ["1B", "BB", "HBP", "E", "ROE", "FC"];

/**
 * Count outs recorded by a play result.
 *
 * Follows Chadwick's dp_flag logic:
 *   - DP = 2 outs (batter + one runner, per runnerAdvances with to="out")
 *   - All other out results = 1 out (batter only by default)
 *   - Runners put out via runnerAdvances to="out" add additional outs
 *     (for FC the batter reaches but a runner is out)
 */
function countOutsForResult(result: PlateAppearanceResult, runnerAdvances: RunnerAdvance[]): number {
  let outs = 0;

  // Batter out?
  if (BATTER_OUT_RESULTS.includes(result)) {
    outs += 1;
  }

  // Runners explicitly put out via advances (Retrosheet "X" notation: 1X2, 2XH, etc.)
  for (const advance of runnerAdvances) {
    if (advance.to === "out") {
      outs += 1;
    }
  }

  return outs;
}

/**
 * Unified function to apply a play result to the game state.
 *
 * This replaces the previous separate logic for recordAtBat/recordOpponentAtBat
 * with a single, rules-correct implementation based on Retrosheet/Chadwick:
 *
 * 1. Process runner advances (including outs via to="out")
 * 2. Place batter on the appropriate base (or not, if out)
 * 3. Count outs from both batter result and runner advances
 * 4. Handle HR batter scoring
 * 5. Switch half-inning if 3+ outs reached
 *
 * Runner advances use Retrosheet notation semantics:
 *   { from: "first", to: "third" }   = runner advances 1st → 3rd  (1-3)
 *   { from: "second", to: "home" }   = runner scores from 2nd     (2-H)
 *   { from: "first", to: "out" }     = runner out advancing        (1X2)
 *   { from: "third", to: "home" }    = runner scores from 3rd     (3-H)
 */
function applyPlayResult(
  state: GameState,
  result: PlateAppearanceResult,
  runnerAdvances: RunnerAdvance[],
  batterRunner: BaseRunner | null,
  scoreField: "ourScore" | "opponentScore"
): { newFirst: BaseRunner | null; newSecond: BaseRunner | null; newThird: BaseRunner | null; runsScored: number; outsRecorded: number } {
  // Start from current base state
  let newFirst: BaseRunner | null = state.runnerFirst;
  let newSecond: BaseRunner | null = state.runnerSecond;
  let newThird: BaseRunner | null = state.runnerThird;
  let runsScored = 0;

  // Step 1: Clear runners from their origin bases
  for (const advance of runnerAdvances) {
    if (advance.from === "third") newThird = null;
    else if (advance.from === "second") newSecond = null;
    else if (advance.from === "first") newFirst = null;
  }

  // Step 2: Place runners at their destinations (skip "out" and "home")
  for (const advance of runnerAdvances) {
    const runner = getRunnerByBase(state, advance.from);
    if (!runner) continue;

    if (advance.to === "home") {
      runsScored++;
    } else if (advance.to === "third") {
      newThird = runner;
    } else if (advance.to === "second") {
      newSecond = runner;
    } else if (advance.to === "first") {
      newFirst = runner;
    }
    // "out" — runner is already cleared from origin, not placed anywhere
  }

  // Step 3: Place batter based on result
  if (batterRunner) {
    if (BATTER_ON_FIRST.includes(result)) {
      newFirst = batterRunner;
    } else if (result === "2B") {
      newSecond = batterRunner;
    } else if (result === "3B") {
      newThird = batterRunner;
    } else if (result === "HR") {
      runsScored++; // batter scores
    }
    // Batter-out results: batter does not go on base
  }

  // Step 4: Count outs
  const outsRecorded = countOutsForResult(result, runnerAdvances);

  return { newFirst, newSecond, newThird, runsScored, outsRecorded };
}

export function recordAtBat(state: GameState, payload: RecordAtBatPayload): GameState {
  const batter = getCurrentBatter(state);
  const batterRunner: BaseRunner | null = batter
    ? { playerId: batter.playerId, opponentBatterId: null, playerName: batter.playerName }
    : null;

  const { newFirst, newSecond, newThird, runsScored, outsRecorded } = applyPlayResult(
    state, payload.result, payload.runnerAdvances, batterRunner, "ourScore"
  );

  const newState: GameState = {
    ...state,
    runnerFirst: newFirst,
    runnerSecond: newSecond,
    runnerThird: newThird,
    ourScore: state.ourScore + runsScored,
    outs: state.outs + outsRecorded,
    currentBatterIndex: (state.currentBatterIndex + 1) % state.lineup.length,
  };

  if (newState.outs >= 3) {
    return switchHalf(newState);
  }
  return newState;
}

function getRunnerByBase(
  state: GameState,
  base: "first" | "second" | "third" | "batter"
): BaseRunner | null {
  if (base === "first") return state.runnerFirst;
  if (base === "second") return state.runnerSecond;
  if (base === "third") return state.runnerThird;
  if (base === "batter") {
    if (state.currentHalf === "top") {
      return getCurrentOpponentBatter(state);
    }
    return getCurrentBatter(state);
  }
  return null;
}

export function recordOpponentAtBat(state: GameState, payload: RecordAtBatPayload): GameState {
  const batter = getCurrentOpponentBatter(state);
  const batterRunner: BaseRunner | null = batter
    ? { playerId: null, opponentBatterId: batter.opponentBatterId, playerName: batter.playerName }
    : null;

  const { newFirst, newSecond, newThird, runsScored, outsRecorded } = applyPlayResult(
    state, payload.result, payload.runnerAdvances, batterRunner, "opponentScore"
  );

  const newState: GameState = {
    ...state,
    runnerFirst: newFirst,
    runnerSecond: newSecond,
    runnerThird: newThird,
    opponentScore: state.opponentScore + runsScored,
    outs: state.outs + outsRecorded,
    opponentBatterIndex: state.opponentLineup.length > 0
      ? (state.opponentBatterIndex + 1) % state.opponentLineup.length
      : state.opponentBatterIndex + 1,
  };

  if (newState.outs >= 3) {
    return switchHalf(newState);
  }
  return newState;
}

function switchHalf(state: GameState): GameState {
  if (state.currentHalf === "top") {
    return {
      ...state,
      currentHalf: "bottom",
      outs: 0,
      runnerFirst: null,
      runnerSecond: null,
      runnerThird: null,
    };
  } else {
    return {
      ...state,
      currentInning: state.currentInning + 1,
      currentHalf: "top",
      outs: 0,
      runnerFirst: null,
      runnerSecond: null,
      runnerThird: null,
    };
  }
}
