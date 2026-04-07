// === Database entity types ===

export interface Player {
  id: number;
  first_name: string;
  last_name: string;
  number: string;
  position: string;
  bats: "Right" | "Left" | "Switch" | null;
  throws: "Right" | "Left" | null;
  photo_file: string | null;
  intro_file: string | null;
  song_file: string | null;
  combo_file: string | null;
  sort_order: number;
}

export interface Game {
  id: string;
  date: string;
  opponent: string;
  location: "home" | "away" | null;
  our_score: number;
  opponent_score: number;
  innings_played: number;
  status: "scheduled" | "in_progress" | "final" | null;
  notes: string | null;
  venue: string | null;
  venue_address: string | null;
  created_at: string;
  // Existing columns from original schema
  num_innings: number | null;
  completed_innings: number[] | null;
}

export interface GameLineup {
  id: string;
  game_id: string;
  player_id: number;
  batting_order: number;
  position: string;
}

export type PlateAppearanceResult =
  | "1B"
  | "2B"
  | "3B"
  | "HR"
  | "BB"
  | "SO"
  | "GO"
  | "FO"
  | "FC"
  | "DP"
  | "SAC"
  | "HBP"
  | "E"
  | "ROE";

export type HitType = "GB" | "FB" | "LD" | "PU";

export interface PlateAppearance {
  id: string;
  game_id: string;
  player_id: number | null;
  opponent_batter_id: string | null;
  team: "us" | "them";
  inning: number;
  batting_order: number;
  result: PlateAppearanceResult;
  scorebook_notation: string;
  spray_x: number | null;
  spray_y: number | null;
  hit_type: HitType | null;
  rbis: number;
  stolen_bases: number;
  is_at_bat: boolean;
  is_hit: boolean;
  total_bases: number;
  created_at: string;
}

export interface OpponentBatter {
  id: string;
  game_id: string;
  name: string;
  batting_order: number;
}

export interface FieldingPlay {
  id: string;
  game_id: string;
  player_id: number;
  inning: number;
  play_type: "PO" | "A" | "E";
  description: string | null;
}

// === Live scoring state types ===

export type BaseRunner = {
  playerId: number | null;
  opponentBatterId: string | null;
  playerName: string;
};

export interface GameState {
  gameId: string;
  currentInning: number;
  currentHalf: "top" | "bottom";
  outs: number;
  runnerFirst: BaseRunner | null;
  runnerSecond: BaseRunner | null;
  runnerThird: BaseRunner | null;
  currentBatterIndex: number;
  opponentBatterIndex: number;
  ourScore: number;
  opponentScore: number;
  lineup: GameLineup[];
  players: Player[];
  opponentLineup: OpponentBatter[];
}

export type GameAction =
  | { type: "RECORD_AT_BAT"; payload: RecordAtBatPayload }
  | { type: "RECORD_OPPONENT_AT_BAT"; payload: RecordAtBatPayload }
  | { type: "ADVANCE_RUNNER"; payload: { from: "first" | "second" | "third"; to: "second" | "third" | "home" } }
  | { type: "UNDO" };

export interface RecordAtBatPayload {
  result: PlateAppearanceResult;
  sprayX: number | null;
  sprayY: number | null;
  rbis: number;
  stolenBases: number;
  scorebookNotation: string;
  fieldingPlays: Omit<FieldingPlay, "id" | "game_id" | "inning">[];
  runnerAdvances: RunnerAdvance[];
}

export interface RunnerAdvance {
  from: "first" | "second" | "third" | "batter";
  to: "first" | "second" | "third" | "home" | "out";
}

// === Aggregated stat types ===

export interface BattingStats {
  player_id: number;
  player_name: string;
  games: number;
  plate_appearances: number;
  at_bats: number;
  hits: number;
  singles: number;
  doubles: number;
  triples: number;
  home_runs: number;
  rbis: number;
  walks: number;
  strikeouts: number;
  stolen_bases: number;
  hit_by_pitch: number;
  sacrifice: number;
  total_bases: number;
  avg: number;
  obp: number;
  slg: number;
  ops: number;
}

export interface FieldingStats {
  player_id: number;
  player_name: string;
  games: number;
  putouts: number;
  assists: number;
  errors: number;
  total_chances: number;
  fielding_pct: number;
}

export interface Practice {
  id: string;
  date: string;
  title: string;
  notes: string | null;
  venue: string | null;
  venue_address: string | null;
  created_at: string;
}

export interface PracticeNote {
  id: string;
  practice_id: string;
  player_id: number;
  note: string;
  focus_area: string | null;
  created_at: string;
}

export interface Drill {
  id: string;
  name: string;
  description: string;
  duration_minutes: number | null;
  category: string;
  created_at: string;
  updated_at: string;
}

export interface PracticePlanTemplate {
  id: string;
  name: string;
  created_at: string;
}

export interface PracticePlanTemplateItem {
  id: string;
  template_id: string;
  drill_id: string | null;
  label: string;
  duration_minutes: number;
  sort_order: number;
}

export interface PracticePlanItem {
  id: string;
  practice_id: string;
  drill_id: string | null;
  label: string;
  duration_minutes: number;
  sort_order: number;
  completed: boolean;
}

export interface ActionItem {
  id: string;
  practice_id: string | null;
  player_id: number | null;
  text: string;
  completed: boolean;
  created_at: string;
}

export interface PracticeAttendance {
  id: string;
  practice_id: string;
  player_id: number;
  present: boolean;
}

export interface Venue {
  id: string;
  name: string;
  address: string;
  created_at: string;
}

export interface ChainAward {
  id: string;
  player_id: number;
  award_type: "game_chain" | "hard_worker";
  source_type: "game" | "practice";
  source_id: string;
  date: string;
  created_at: string;
}
