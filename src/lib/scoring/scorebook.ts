import type { PlateAppearanceResult } from "./types";

// Baseball position numbers
const POSITIONS: Record<number, string> = {
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
    // Outfield zones by angle
    if (angle < -20) return 7; // LF
    if (angle > 20) return 9; // RF
    return 8; // CF
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
export function generateNotation(result: PlateAppearanceResult, fieldPosition: number | null): string {
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
    case "SAC": return "#9ca3af"; // light gray
    case "E":
    case "ROE": return "#f97316"; // orange
    default: return "#6b7280";
  }
}
