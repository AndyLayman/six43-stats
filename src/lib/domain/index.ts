/**
 * Domain barrel — the portable surface area.
 *
 * Everything re-exported from this file is pure domain logic with
 * no Next.js, no browser, no Node, no Supabase runtime dependencies.
 * This is the exact set of code that copies 1-to-1 into the React Native
 * port. If you add a module here, it must stay dependency-clean.
 *
 * Not exported (on purpose):
 *   - `league-config.ts` — the DB read/write helpers import Supabase.
 *     The `LeagueConfig` type and defaults are portable, but the file
 *     as a whole is not. See PORTING.md for how to split during port.
 *   - Any UI components, hooks, or Next.js route handlers.
 */

// --- Types (pure, no runtime) ---
export type {
  Player,
  Game,
  GameLineup,
  PlateAppearanceResult,
  HitType,
  PlateAppearance,
  OpponentBatter,
  FieldingPlay,
  BaseRunner,
  GameState,
  GameAction,
  RecordAtBatPayload,
  RunnerAdvance,
  BattingStats,
  FieldingStats,
} from "@/lib/scoring/types";

// --- Baseball rules engine (forced runners, default advances, DPs) ---
export {
  getForcedBases,
  isRunnerForced,
  getDoublePlayScenarios,
  getDefaultDoublePlayResult,
  getDefaultRunnerAdvances,
  canDoublePlay,
  canGroundBallDoublePlay,
  countRunners,
  describeBaseState,
} from "@/lib/scoring/baseball-rules";
export type { BaseState, DoublePlayType, DoublePlayResult } from "@/lib/scoring/baseball-rules";

// --- Game state engine (record at-bat, half-inning, batter rotation) ---
export {
  createInitialGameState,
  getCurrentBatter,
  getCurrentOpponentBatter,
  addOpponentBatter,
  recordAtBat,
  recordOpponentAtBat,
} from "@/lib/scoring/game-engine";

// --- Scorebook notation + spray chart geometry + fielding plays ---
export {
  POSITIONS,
  POSITION_NUMBERS,
  sprayToPosition,
  sprayCfSide,
  generateNotation,
  parseNotationToFieldingPlays,
  resolvePositionToPlayerId,
  getResultColor,
} from "@/lib/scoring/scorebook";
export type { GeneratedFieldingPlay } from "@/lib/scoring/scorebook";

// --- Stat formulas (AVG / OBP / SLG / OPS / fielding pct + aggregation) ---
export {
  isAtBat,
  isHit,
  totalBases,
  battingAverage,
  onBasePercentage,
  sluggingPercentage,
  ops,
  fieldingPercentage,
  formatAvg,
  formatTime12,
  formatStat,
  aggregateBattingStats,
  aggregateFieldingStats,
} from "@/lib/stats/calculations";

// --- Player name formatters ---
export { fullName, shortName, firstName, lastFirst } from "@/lib/player-name";
