import type { PlateAppearanceResult, BaseRunner, GameLineup, Player } from "./types";
import type { BaseState } from "./baseball-rules";
import { getDefaultDoublePlayResult } from "./baseball-rules";

// Baseball position numbers (Retrosheet standard: 1=P through 9=RF)
export const POSITIONS: Record<number, string> = {
  1: "P",
  2: "C",
  3: "1B",
  4: "2B",
  5: "3B",
  6: "SS",
  7: "LF",
  8: "CF",
  9: "RF",
};

// Reverse lookup: position abbreviation → number
export const POSITION_NUMBERS: Record<string, number> = {
  P: 1, C: 2, "1B": 3, "2B": 4, "3B": 5, SS: 6, LF: 7, CF: 8, RF: 9,
};

// Aliases: positions in lineup_assignments that map to a standard position number
// LCF and RCF both count as CF (position 8) for fielding attribution
const POSITION_ALIASES: Record<string, string> = {
  LCF: "CF",
  RCF: "CF",
};

// Convert spray chart coordinates to fielding position number
// SVG viewBox is 0-300 x 0-300, home plate at (150, 280)
export function sprayToPosition(x: number, y: number): number {
  // Normalize to home plate origin
  const dx = x - 150;
  const dy = 280 - y; // flip Y so up is positive

  const distance = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(dx, dy) * (180 / Math.PI); // 0 = straight up (CF), negative = left, positive = right

  // Infield vs outfield threshold
  const isOutfield = distance > 130;

  if (isOutfield) {
    // Outfield zones by angle (CF split into LCF/RCF but both map to position 8)
    if (angle < -20) return 7; // LF
    if (angle > 20) return 9; // RF
    return 8; // CF (covers both LCF and RCF areas)
  } else {
    // Infield zones by angle
    if (distance < 40) return 1; // Pitcher area
    if (angle < -30) return 5; // 3B
    if (angle < -10) return 6; // SS
    if (angle > 30) return 3; // 1B
    if (angle > 10) return 4; // 2B
    return 1; // Up the middle near pitcher
  }
}

// Generate scorebook notation from result and field position
// Optional baseState enables context-aware DP notation via the rules engine
export function generateNotation(result: PlateAppearanceResult, fieldPosition: number | null, baseState?: BaseState): string {
  switch (result) {
    case "1B":
      return fieldPosition ? `1B-${fieldPosition}` : "1B";
    case "2B":
      return fieldPosition ? `2B-${fieldPosition}` : "2B";
    case "3B":
      return fieldPosition ? `3B-${fieldPosition}` : "3B";
    case "HR":
      return "HR";
    case "BB":
      return "BB";
    case "SO":
      return "K";
    case "HBP":
      return "HBP";
    case "SAC":
      return fieldPosition ? `SAC ${fieldPosition}-3` : "SAC";
    case "GO": {
      if (!fieldPosition) return "GO";
      // Ground out: fielder to first base (position 3)
      if (fieldPosition === 3) return "3U"; // Unassisted
      return `${fieldPosition}-3`;
    }
    case "FO":
      return fieldPosition ? `F${fieldPosition}` : "FO";
    case "DP": {
      // Use rules engine for context-aware DP notation when base state is available
      if (baseState) {
        const dpResult = getDefaultDoublePlayResult(baseState, fieldPosition);
        return dpResult.notation;
      }
      // Fallback: standard GDP notation by field position
      if (!fieldPosition) return "DP";
      if (fieldPosition === 6) return "6-4-3";
      if (fieldPosition === 4) return "4-6-3";
      if (fieldPosition === 5) return "5-4-3";
      if (fieldPosition === 3) return "3-6-3";
      if (fieldPosition === 1) return "1-6-3";
      return `DP ${fieldPosition}`;
    }
    case "FC":
      return fieldPosition ? `FC ${fieldPosition}` : "FC";
    case "E":
      return fieldPosition ? `E${fieldPosition}` : "E";
    case "ROE":
      return fieldPosition ? `E${fieldPosition}` : "ROE";
    default:
      return result;
  }
}

// === Fielding Play Generation ===

export interface GeneratedFieldingPlay {
  positionNumber: number;
  playType: "PO" | "A" | "E";
  description: string;
}

/**
 * Parse scorebook notation into fielding plays (putouts, assists, errors).
 *
 * Follows Retrosheet convention:
 *   - In a fielding sequence like "6-4-3", the LAST fielder gets the putout (PO),
 *     all preceding fielders get assists (A).
 *   - "3U" = unassisted putout by 1B (PO only, no assists)
 *   - "F8" = fly out caught by CF (PO to position 8)
 *   - "K" = strikeout (PO to catcher, position 2)
 *   - "E6" = error by SS (E to position 6)
 *   - "6-4-3" DP = SS assist, 2B putout+assist, 1B putout
 *     (two separate outs: 6→4 is first out, then 4→3 is second out)
 *
 * For double plays with a dash sequence like "6-4-3":
 *   First out (force at 2nd):  6=A, 4=PO
 *   Second out (batter at 1st): 4=A, 3=PO
 */
export function parseNotationToFieldingPlays(
  notation: string,
  result: PlateAppearanceResult
): GeneratedFieldingPlay[] {
  const plays: GeneratedFieldingPlay[] = [];

  // Strikeout: catcher gets putout
  if (result === "SO" || notation === "K") {
    plays.push({ positionNumber: 2, playType: "PO", description: notation });
    return plays;
  }

  // Error: E followed by position number
  if (result === "E" || result === "ROE") {
    const match = notation.match(/E(\d)/);
    if (match) {
      plays.push({ positionNumber: parseInt(match[1]), playType: "E", description: notation });
    }
    return plays;
  }

  // Fly out: F followed by position number
  if (result === "FO") {
    const match = notation.match(/F(\d)/);
    if (match) {
      plays.push({ positionNumber: parseInt(match[1]), playType: "PO", description: notation });
    }
    return plays;
  }

  // Ground out or DP: parse dash-separated fielding sequence
  if (result === "GO" || result === "DP" || result === "FC" || result === "SAC") {
    // Extract the fielding sequence — strip prefixes like "SAC ", "FC ", "DP ", "L"-DP
    let sequence = notation
      .replace(/^(SAC|FC|DP|LDP|FDP)\s*/i, "")
      .replace(/^L\d+-DP$/i, "")  // Line drive DP like "L6-DP"
      .replace(/-DP$/i, "");       // trailing -DP

    // Line drive DP: "L6-DP" → outfielder gets PO (catch), runner doubled off
    if (notation.match(/^L(\d)-DP$/)) {
      const pos = parseInt(notation.match(/^L(\d)/)?.[1] ?? "0");
      if (pos >= 1 && pos <= 9) {
        plays.push({ positionNumber: pos, playType: "PO", description: notation });
        // The doubling-off throw goes back to the base — but we don't know who caught it
        // without more info, so just credit the catch
      }
      return plays;
    }

    // Fly DP: "F8-DP" → outfielder catches, throw to base
    if (notation.match(/^F(\d)-DP$/)) {
      const pos = parseInt(notation.match(/^F(\d)/)?.[1] ?? "0");
      if (pos >= 1 && pos <= 9) {
        plays.push({ positionNumber: pos, playType: "PO", description: notation });
      }
      return plays;
    }

    // Unassisted: "3U"
    if (sequence.match(/^(\d)U$/)) {
      const pos = parseInt(sequence[0]);
      plays.push({ positionNumber: pos, playType: "PO", description: notation });
      return plays;
    }

    // Standard dash sequence: "6-4-3", "5-4-3", "4-3", "1-3", etc.
    const fielders = sequence.split("-").map((s) => parseInt(s.trim())).filter((n) => n >= 1 && n <= 9);

    if (fielders.length === 0) return plays;

    if (result === "DP" && fielders.length >= 3) {
      // Double play: two separate outs within the sequence
      // e.g., "6-4-3": first out = 6(A), 4(PO); second out = 4(A), 3(PO)
      // Split at the middle fielder who gets both a PO and an A
      const mid = Math.floor(fielders.length / 2);

      // First out: fielders[0..mid] — last one gets PO, rest get A
      for (let i = 0; i < mid; i++) {
        plays.push({ positionNumber: fielders[i], playType: "A", description: notation });
      }
      plays.push({ positionNumber: fielders[mid], playType: "PO", description: notation });

      // Second out: fielders[mid..end] — last one gets PO, rest get A
      plays.push({ positionNumber: fielders[mid], playType: "A", description: notation });
      for (let i = mid + 1; i < fielders.length - 1; i++) {
        plays.push({ positionNumber: fielders[i], playType: "A", description: notation });
      }
      plays.push({ positionNumber: fielders[fielders.length - 1], playType: "PO", description: notation });
    } else {
      // Single out: last fielder gets PO, all others get A
      for (let i = 0; i < fielders.length - 1; i++) {
        plays.push({ positionNumber: fielders[i], playType: "A", description: notation });
      }
      plays.push({ positionNumber: fielders[fielders.length - 1], playType: "PO", description: notation });
    }

    return plays;
  }

  // Hits (1B, 2B, 3B, HR), BB, HBP — no fielding plays
  return plays;
}

/**
 * Resolve a fielding position number to a player ID.
 *
 * Priority: 1) lineup_assignments (per-inning), 2) game_lineup, 3) player default
 *
 * Position number mapping (Retrosheet standard):
 *   1=P, 2=C, 3=1B, 4=2B, 5=3B, 6=SS, 7=LF, 8=CF, 9=RF
 */
export function resolvePositionToPlayerId(
  positionNumber: number,
  lineup: GameLineup[],
  players: Player[],
  inningPositions?: { player_id: number; position: string }[]
): number | null {
  const posAbbrev = POSITIONS[positionNumber];
  if (!posAbbrev) return null;

  // Check if a stored position matches the target (handles aliases like LCF/RCF → CF)
  function matchesPosition(storedPos: string): boolean {
    const upper = storedPos.toUpperCase();
    if (upper === posAbbrev) return true;
    const alias = POSITION_ALIASES[upper];
    return alias === posAbbrev;
  }

  // Highest priority: per-inning lineup assignments
  if (inningPositions && inningPositions.length > 0) {
    for (const entry of inningPositions) {
      if (matchesPosition(entry.position)) {
        return entry.player_id;
      }
    }
  }

  // Second: game_lineup positions
  for (const entry of lineup) {
    if (matchesPosition(entry.position)) {
      return entry.player_id;
    }
  }

  // Fall back to player's default position from the players table
  for (const entry of lineup) {
    const player = players.find((p) => p.id === entry.player_id);
    if (player && matchesPosition(player.position ?? "")) {
      return player.id;
    }
  }

  return null;
}

// Get a color for spray chart markers based on result
export function getResultColor(result: PlateAppearanceResult): string {
  switch (result) {
    case "1B": return "#22c55e"; // green
    case "2B": return "#3b82f6"; // blue
    case "3B": return "#f59e0b"; // amber
    case "HR": return "#ef4444"; // red
    case "BB":
    case "HBP": return "#8b5cf6"; // purple
    case "SO": return "#6b7280"; // gray
    case "GO":
    case "FO":
    case "FC":
    case "DP":
    case "SAC": return "#9ca3af"; // light gray
    case "E":
    case "ROE": return "#f97316"; // orange
    default: return "#6b7280";
  }
}
