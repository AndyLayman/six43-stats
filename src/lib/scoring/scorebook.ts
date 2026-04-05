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
// LC and RC both count as CF (position 8) for fielding attribution
const POSITION_ALIASES: Record<string, string> = {
  LC: "CF",
  RC: "CF",
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
    if (angle < -20) return 7; // LF
    if (angle > 20) return 9; // RF
    return 8; // CF (notation uses 8 for both LCF and RCF)
  } else {
    if (distance < 40) return 1; // Pitcher area
    if (angle < -30) return 5; // 3B
    if (angle < -10) return 6; // SS
    if (angle > 30) return 3; // 1B
    if (angle > 10) return 4; // 2B
    return 1; // Up the middle near pitcher
  }
}

// For CF plays, determine LC vs RC based on spray chart angle
// Returns the lineup_assignments position text to match against
export function sprayCfSide(x: number, y: number): "LC" | "RC" {
  const dx = x - 150;
  // Negative dx = left side of field = LC, positive = RC
  return dx <= 0 ? "LC" : "RC";
}

// Annotate position 8 with LC/RC suffix when CF side is known
function annotatePos(pos: number, cfSide?: "LC" | "RC"): string {
  if (pos === 8 && cfSide) {
    return `8${cfSide}`;
  }
  return String(pos);
}

// Generate scorebook notation from result and field position
// Optional baseState enables context-aware DP notation via the rules engine
// Optional cfSide annotates CF plays with LC/RC (e.g., F8LC, F8RC)
export function generateNotation(result: PlateAppearanceResult, fieldPosition: number | null, baseState?: BaseState, cfSide?: "LC" | "RC"): string {
  const fp = fieldPosition ? annotatePos(fieldPosition, cfSide) : null;
  switch (result) {
    case "1B":
      return fp ? `1B-${fp}` : "1B";
    case "2B":
      return fp ? `2B-${fp}` : "2B";
    case "3B":
      return fp ? `3B-${fp}` : "3B";
    case "HR":
      return "HR";
    case "BB":
      return "BB";
    case "SO":
      return "K";
    case "HBP":
      return "HBP";
    case "SAC":
      return fp ? `SAC ${fp}-3` : "SAC";
    case "GO": {
      if (!fp) return "GO";
      if (fieldPosition === 3) return "3U"; // Unassisted
      return `${fp}-3`;
    }
    case "FO":
      return fp ? `F${fp}` : "FO";
    case "DP": {
      // Use rules engine for context-aware DP notation when base state is available
      if (baseState) {
        const dpResult = getDefaultDoublePlayResult(baseState, fieldPosition);
        // Annotate the notation if it contains position 8
        if (cfSide) {
          return dpResult.notation.replace(/\b8\b/g, `8${cfSide}`);
        }
        return dpResult.notation;
      }
      // Fallback: standard GDP notation by field position
      if (!fieldPosition) return "DP";
      if (fieldPosition === 6) return "6-4-3";
      if (fieldPosition === 4) return "4-6-3";
      if (fieldPosition === 5) return "5-4-3";
      if (fieldPosition === 3) return "3-6-3";
      if (fieldPosition === 1) return "1-6-3";
      return `DP ${fp}`;
    }
    case "FC":
      return fp ? `FC ${fp}` : "FC";
    case "E":
      return fp ? `E${fp}` : "E";
    case "ROE":
      return fp ? `E${fp}` : "ROE";
    default:
      return result;
  }
}

// === Fielding Play Generation ===

export interface GeneratedFieldingPlay {
  positionNumber: number;
  playType: "PO" | "A" | "E";
  description: string;
  cfSide?: "LC" | "RC";
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

  // Extract CF side from notation (e.g., "8LC" or "8RC") and normalize to plain "8"
  let detectedCfSide: "LC" | "RC" | undefined;
  const cfMatch = notation.match(/8(LC|RC)/i);
  if (cfMatch) {
    detectedCfSide = cfMatch[1].toUpperCase() as "LC" | "RC";
  }
  // Normalize: strip LC/RC suffix so the rest of parsing works with plain position numbers
  const norm = notation.replace(/8(?:LC|RC)/gi, "8");

  function makPlay(positionNumber: number, playType: "PO" | "A" | "E"): GeneratedFieldingPlay {
    return {
      positionNumber,
      playType,
      description: notation, // keep original notation with LC/RC
      cfSide: positionNumber === 8 ? detectedCfSide : undefined,
    };
  }

  // Strikeout: catcher gets putout
  if (result === "SO" || norm === "K") {
    plays.push(makPlay(2, "PO"));
    return plays;
  }

  // Error: E followed by position number
  if (result === "E" || result === "ROE") {
    const match = norm.match(/E(\d)/);
    if (match) {
      plays.push(makPlay(parseInt(match[1]), "E"));
    }
    return plays;
  }

  // Fly out: F followed by position number
  if (result === "FO") {
    const match = norm.match(/F(\d)/);
    if (match) {
      plays.push(makPlay(parseInt(match[1]), "PO"));
    }
    return plays;
  }

  // Ground out or DP: parse dash-separated fielding sequence
  if (result === "GO" || result === "DP" || result === "FC" || result === "SAC") {
    // Extract the fielding sequence — strip prefixes like "SAC ", "FC ", "DP ", "L"-DP
    let sequence = norm
      .replace(/^(SAC|FC|DP|LDP|FDP)\s*/i, "")
      .replace(/^L\d+-DP$/i, "")  // Line drive DP like "L6-DP"
      .replace(/-DP$/i, "");       // trailing -DP

    // Line drive DP: "L6-DP" → outfielder gets PO (catch), runner doubled off
    if (norm.match(/^L(\d)-DP$/)) {
      const pos = parseInt(norm.match(/^L(\d)/)?.[1] ?? "0");
      if (pos >= 1 && pos <= 9) {
        plays.push(makPlay(pos, "PO"));
      }
      return plays;
    }

    // Fly DP: "F8-DP" → outfielder catches, throw to base
    if (norm.match(/^F(\d)-DP$/)) {
      const pos = parseInt(norm.match(/^F(\d)/)?.[1] ?? "0");
      if (pos >= 1 && pos <= 9) {
        plays.push(makPlay(pos, "PO"));
      }
      return plays;
    }

    // Unassisted: "3U"
    if (sequence.match(/^(\d)U$/)) {
      const pos = parseInt(sequence[0]);
      plays.push(makPlay(pos, "PO"));
      return plays;
    }

    // Standard dash sequence: "6-4-3", "5-4-3", "4-3", "1-3", etc.
    const fielders = sequence.split("-").map((s) => parseInt(s.trim())).filter((n) => n >= 1 && n <= 9);

    if (fielders.length === 0) return plays;

    if (result === "DP" && fielders.length >= 3) {
      // Double play: two separate outs within the sequence
      // e.g., "6-4-3": first out = 6(A), 4(PO); second out = 4(A), 3(PO)
      const mid = Math.floor(fielders.length / 2);

      for (let i = 0; i < mid; i++) {
        plays.push(makPlay(fielders[i], "A"));
      }
      plays.push(makPlay(fielders[mid], "PO"));

      plays.push(makPlay(fielders[mid], "A"));
      for (let i = mid + 1; i < fielders.length - 1; i++) {
        plays.push(makPlay(fielders[i], "A"));
      }
      plays.push(makPlay(fielders[fielders.length - 1], "PO"));
    } else {
      // Single out: last fielder gets PO, all others get A
      for (let i = 0; i < fielders.length - 1; i++) {
        plays.push(makPlay(fielders[i], "A"));
      }
      plays.push(makPlay(fielders[fielders.length - 1], "PO"));
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
  inningPositions?: { player_id: number; position: string }[],
  cfSide?: "LC" | "RC"
): number | null {
  const posAbbrev = POSITIONS[positionNumber];
  if (!posAbbrev) return null;

  // For CF (position 8), prefer the specific side if provided
  function matchesPosition(storedPos: string): boolean {
    const upper = storedPos.toUpperCase();
    if (upper === posAbbrev) return true;
    const alias = POSITION_ALIASES[upper];
    return alias === posAbbrev;
  }

  function preferredCfMatch(storedPos: string): boolean {
    return cfSide !== undefined && storedPos.toUpperCase() === cfSide;
  }

  // Highest priority: per-inning lineup assignments
  if (inningPositions && inningPositions.length > 0) {
    // If CF with a side hint, try exact match first (LCF or RCF)
    if (posAbbrev === "CF" && cfSide) {
      for (const entry of inningPositions) {
        if (preferredCfMatch(entry.position)) {
          return entry.player_id;
        }
      }
    }
    for (const entry of inningPositions) {
      if (matchesPosition(entry.position)) {
        return entry.player_id;
      }
    }
  }

  // Second: game_lineup positions
  if (posAbbrev === "CF" && cfSide) {
    for (const entry of lineup) {
      if (preferredCfMatch(entry.position)) {
        return entry.player_id;
      }
    }
  }
  for (const entry of lineup) {
    if (matchesPosition(entry.position)) {
      return entry.player_id;
    }
  }

  // Fall back to player's default position from the players table
  if (posAbbrev === "CF" && cfSide) {
    for (const entry of lineup) {
      const player = players.find((p) => p.id === entry.player_id);
      if (player && preferredCfMatch(player.position ?? "")) {
        return player.id;
      }
    }
  }
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
    case "1B": return "#83DD68"; // green (design system)
    case "2B": return "#08DDC8"; // teal (design system)
    case "3B": return "#f59e0b"; // amber
    case "HR": return "#FF6161"; // danger (design system)
    case "BB":
    case "HBP": return "#CF59F3"; // purple (design system)
    case "SO": return "#5A5A5A"; // gray-600 (design system)
    case "GO":
    case "FO":
    case "FC":
    case "DP":
    case "SAC": return "#8A8A8A"; // gray-400 (design system)
    case "E":
    case "ROE": return "#f97316"; // orange
    default: return "#5A5A5A";
  }
}
