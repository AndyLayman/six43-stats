import type { PlateAppearance, FieldingPlay, BattingStats, FieldingStats } from "@/lib/scoring/types";

// Whether a result counts as an official at-bat
export function isAtBat(result: string): boolean {
  return !["BB", "HBP", "SAC"].includes(result);
}

// Whether a result counts as a hit
export function isHit(result: string): boolean {
  return ["1B", "2B", "3B", "HR"].includes(result);
}

// Total bases for a hit result
export function totalBases(result: string): number {
  switch (result) {
    case "1B": return 1;
    case "2B": return 2;
    case "3B": return 3;
    case "HR": return 4;
    default: return 0;
  }
}

// Batting average: H / AB
export function battingAverage(hits: number, atBats: number): number {
  return atBats === 0 ? 0 : hits / atBats;
}

// On-base percentage: (H + BB + HBP) / (AB + BB + HBP + SAC)
export function onBasePercentage(
  hits: number,
  walks: number,
  hitByPitch: number,
  atBats: number,
  sacrifice: number
): number {
  const denom = atBats + walks + hitByPitch + sacrifice;
  return denom === 0 ? 0 : (hits + walks + hitByPitch) / denom;
}

// Slugging percentage: TB / AB
export function sluggingPercentage(totalBasesCount: number, atBats: number): number {
  return atBats === 0 ? 0 : totalBasesCount / atBats;
}

// OPS: OBP + SLG
export function ops(obp: number, slg: number): number {
  return obp + slg;
}

// Fielding percentage: (PO + A) / (PO + A + E)
export function fieldingPercentage(putouts: number, assists: number, errors: number): number {
  const total = putouts + assists + errors;
  return total === 0 ? 0 : (putouts + assists) / total;
}

// Format stat to 3 decimal places (baseball convention: .333 not 0.333)
export function formatAvg(value: number): string {
  return value.toFixed(3).replace(/^0/, "");
}

// Format stat to standard display
export function formatStat(value: number, decimals: number = 0): string {
  return decimals === 0 ? value.toString() : value.toFixed(decimals);
}

// Aggregate plate appearances into batting stats for a single player
export function aggregateBattingStats(
  playerId: number,
  playerName: string,
  appearances: PlateAppearance[]
): BattingStats {
  const playerPAs = appearances.filter((pa) => pa.player_id === playerId);
  const gameIds = new Set(playerPAs.map((pa) => pa.game_id));

  const atBats = playerPAs.filter((pa) => pa.is_at_bat).length;
  const hits = playerPAs.filter((pa) => pa.is_hit).length;
  const singles = playerPAs.filter((pa) => pa.result === "1B").length;
  const doubles = playerPAs.filter((pa) => pa.result === "2B").length;
  const triples = playerPAs.filter((pa) => pa.result === "3B").length;
  const homeRuns = playerPAs.filter((pa) => pa.result === "HR").length;
  const walks = playerPAs.filter((pa) => pa.result === "BB").length;
  const strikeouts = playerPAs.filter((pa) => pa.result === "SO").length;
  const hitByPitch = playerPAs.filter((pa) => pa.result === "HBP").length;
  const sacrifice = playerPAs.filter((pa) => pa.result === "SAC").length;
  const rbis = playerPAs.reduce((sum, pa) => sum + pa.rbis, 0);
  const stolenBases = playerPAs.reduce((sum, pa) => sum + pa.stolen_bases, 0);
  const tb = playerPAs.reduce((sum, pa) => sum + pa.total_bases, 0);

  const avg = battingAverage(hits, atBats);
  const obpVal = onBasePercentage(hits, walks, hitByPitch, atBats, sacrifice);
  const slgVal = sluggingPercentage(tb, atBats);

  return {
    player_id: playerId,
    player_name: playerName,
    games: gameIds.size,
    plate_appearances: playerPAs.length,
    at_bats: atBats,
    hits,
    singles,
    doubles,
    triples,
    home_runs: homeRuns,
    rbis,
    walks,
    strikeouts,
    stolen_bases: stolenBases,
    hit_by_pitch: hitByPitch,
    sacrifice,
    total_bases: tb,
    avg,
    obp: obpVal,
    slg: slgVal,
    ops: ops(obpVal, slgVal),
  };
}

// Aggregate fielding plays into fielding stats for a single player
export function aggregateFieldingStats(
  playerId: number,
  playerName: string,
  plays: FieldingPlay[]
): FieldingStats {
  const playerPlays = plays.filter((p) => p.player_id === playerId);
  const gameIds = new Set(playerPlays.map((p) => p.game_id));

  const putouts = playerPlays.filter((p) => p.play_type === "PO").length;
  const assists = playerPlays.filter((p) => p.play_type === "A").length;
  const errors = playerPlays.filter((p) => p.play_type === "E").length;

  return {
    player_id: playerId,
    player_name: playerName,
    games: gameIds.size,
    putouts,
    assists,
    errors,
    total_chances: putouts + assists + errors,
    fielding_pct: fieldingPercentage(putouts, assists, errors),
  };
}
