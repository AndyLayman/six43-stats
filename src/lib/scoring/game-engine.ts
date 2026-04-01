import type { GameState, RecordAtBatPayload, RunnerAdvance, BaseRunner, OpponentBatter } from "./types";
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
    players: players.map((p) => ({ ...p, number: "", photo_file: null, intro_file: null, song_file: null, combo_file: null, sort_order: 0 })),
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
  // If index is beyond known lineup, return null to prompt adding a new batter
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

export function recordAtBat(state: GameState, payload: RecordAtBatPayload): GameState {
  const newState = { ...state };
  const result = payload.result;

  // Process runner advances
  let runsScored = 0;
  for (const advance of payload.runnerAdvances) {
    if (advance.to === "home") {
      runsScored++;
    }
  }
  newState.ourScore = state.ourScore + runsScored;

  // Apply runner advances (process from third base back to avoid conflicts)
  let newFirst: BaseRunner | null = state.runnerFirst;
  let newSecond: BaseRunner | null = state.runnerSecond;
  let newThird: BaseRunner | null = state.runnerThird;

  // Clear runners that advanced
  for (const advance of payload.runnerAdvances) {
    if (advance.from === "third") newThird = null;
    else if (advance.from === "second") newSecond = null;
    else if (advance.from === "first") newFirst = null;
  }

  // Place runners at destinations
  for (const advance of payload.runnerAdvances) {
    if (advance.to === "third") {
      const runner = getRunnerByBase(state, advance.from);
      if (runner) newThird = runner;
    } else if (advance.to === "second") {
      const runner = getRunnerByBase(state, advance.from);
      if (runner) newSecond = runner;
    } else if (advance.to === "first") {
      const runner = getRunnerByBase(state, advance.from);
      if (runner) newFirst = runner;
    }
  }

  // Place batter based on result
  const batter = getCurrentBatter(state);
  if (batter) {
    const batterRunner: BaseRunner = { playerId: batter.playerId, opponentBatterId: null, playerName: batter.playerName };
    if (result === "1B" || result === "BB" || result === "HBP" || result === "E" || result === "ROE" || result === "FC") {
      newFirst = batterRunner;
    } else if (result === "2B") {
      newSecond = batterRunner;
    } else if (result === "3B") {
      newThird = batterRunner;
    }
    // HR: batter scores (already counted in runsScored from runnerAdvances typically, but add 1 for the batter)
    if (result === "HR") {
      newState.ourScore += 1; // batter scores
    }
  }

  // Check for outs
  const isOut = ["GO", "FO", "FC", "SAC", "DP"].includes(result) || result === "SO";
  let outs = state.outs;
  if (isOut) {
    outs += result === "DP" ? 2 : 1;
    // On an out, batter doesn't go to base (except FC where they do - already handled above)
    if (result !== "FC") {
      // Don't place batter on base
      // Revert the batter placement for non-FC outs
      if (result === "GO" || result === "FO" || result === "SAC" || result === "SO" || result === "DP") {
        // Batter is out, not on base
        newFirst = state.runnerFirst;
        newSecond = state.runnerSecond;
        newThird = state.runnerThird;
        // DP: runner on 1st is forced out at 2nd
        if (result === "DP") {
          newFirst = null;
        }
        // Re-apply runner advances only
        for (const advance of payload.runnerAdvances) {
          if (advance.from === "third") newThird = null;
          else if (advance.from === "second") newSecond = null;
          else if (advance.from === "first") newFirst = null;
        }
        for (const advance of payload.runnerAdvances) {
          if (advance.to === "third") {
            const runner = getRunnerByBase(state, advance.from);
            if (runner) newThird = runner;
          } else if (advance.to === "second") {
            const runner = getRunnerByBase(state, advance.from);
            if (runner) newSecond = runner;
          } else if (advance.to === "first") {
            const runner = getRunnerByBase(state, advance.from);
            if (runner) newFirst = runner;
          }
        }
      }
    }
  }

  newState.runnerFirst = newFirst;
  newState.runnerSecond = newSecond;
  newState.runnerThird = newThird;
  newState.outs = outs;

  // Advance to next batter
  newState.currentBatterIndex = (state.currentBatterIndex + 1) % state.lineup.length;

  // Check for 3 outs -> switch half
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
  const newState = { ...state };
  const result = payload.result;

  // Process runner advances
  let runsScored = 0;
  for (const advance of payload.runnerAdvances) {
    if (advance.to === "home") {
      runsScored++;
    }
  }
  newState.opponentScore = state.opponentScore + runsScored;

  // Apply runner advances (process from third base back to avoid conflicts)
  let newFirst: BaseRunner | null = state.runnerFirst;
  let newSecond: BaseRunner | null = state.runnerSecond;
  let newThird: BaseRunner | null = state.runnerThird;

  // Clear runners that advanced
  for (const advance of payload.runnerAdvances) {
    if (advance.from === "third") newThird = null;
    else if (advance.from === "second") newSecond = null;
    else if (advance.from === "first") newFirst = null;
  }

  // Place runners at destinations
  for (const advance of payload.runnerAdvances) {
    if (advance.to === "third") {
      const runner = getRunnerByBase(state, advance.from);
      if (runner) newThird = runner;
    } else if (advance.to === "second") {
      const runner = getRunnerByBase(state, advance.from);
      if (runner) newSecond = runner;
    } else if (advance.to === "first") {
      const runner = getRunnerByBase(state, advance.from);
      if (runner) newFirst = runner;
    }
  }

  // Place batter based on result
  const batter = getCurrentOpponentBatter(state);
  if (batter) {
    const batterRunner: BaseRunner = { playerId: null, opponentBatterId: batter.opponentBatterId, playerName: batter.playerName };
    if (result === "1B" || result === "BB" || result === "HBP" || result === "E" || result === "ROE" || result === "FC") {
      newFirst = batterRunner;
    } else if (result === "2B") {
      newSecond = batterRunner;
    } else if (result === "3B") {
      newThird = batterRunner;
    }
    if (result === "HR") {
      newState.opponentScore += 1;
    }
  }

  // Check for outs
  const isOut = ["GO", "FO", "FC", "SAC", "DP"].includes(result) || result === "SO";
  let outs = state.outs;
  if (isOut) {
    outs += result === "DP" ? 2 : 1;
    if (result !== "FC") {
      if (result === "GO" || result === "FO" || result === "SAC" || result === "SO" || result === "DP") {
        newFirst = state.runnerFirst;
        newSecond = state.runnerSecond;
        newThird = state.runnerThird;
        // DP: runner on 1st is forced out at 2nd
        if (result === "DP") {
          newFirst = null;
        }
        for (const advance of payload.runnerAdvances) {
          if (advance.from === "third") newThird = null;
          else if (advance.from === "second") newSecond = null;
          else if (advance.from === "first") newFirst = null;
        }
        for (const advance of payload.runnerAdvances) {
          if (advance.to === "third") {
            const runner = getRunnerByBase(state, advance.from);
            if (runner) newThird = runner;
          } else if (advance.to === "second") {
            const runner = getRunnerByBase(state, advance.from);
            if (runner) newSecond = runner;
          } else if (advance.to === "first") {
            const runner = getRunnerByBase(state, advance.from);
            if (runner) newFirst = runner;
          }
        }
      }
    }
  }

  newState.runnerFirst = newFirst;
  newState.runnerSecond = newSecond;
  newState.runnerThird = newThird;
  newState.outs = outs;

  // Advance to next opponent batter (don't wrap — let UI prompt for new batters on first cycle)
  newState.opponentBatterIndex = state.opponentBatterIndex + 1;

  // Check for 3 outs -> switch half
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
