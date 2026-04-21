import { describe, it, expect } from "vitest";
import {
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
} from "./calculations";

describe("isAtBat", () => {
  it.each([
    ["1B", true],
    ["2B", true],
    ["3B", true],
    ["HR", true],
    ["SO", true],
    ["GO", true],
    ["FO", true],
    ["E", true],
    ["BB", false],
    ["HBP", false],
    ["SAC", false],
  ])("%s counts as at-bat? %s", (result, expected) => {
    expect(isAtBat(result)).toBe(expected);
  });
});

describe("isHit", () => {
  it.each([
    ["1B", true],
    ["2B", true],
    ["3B", true],
    ["HR", true],
    ["BB", false],
    ["SO", false],
    ["E", false],
    ["FC", false],
  ])("%s counts as hit? %s", (result, expected) => {
    expect(isHit(result)).toBe(expected);
  });
});

describe("totalBases", () => {
  it("returns 1 for 1B, 2 for 2B, 3 for 3B, 4 for HR", () => {
    expect(totalBases("1B")).toBe(1);
    expect(totalBases("2B")).toBe(2);
    expect(totalBases("3B")).toBe(3);
    expect(totalBases("HR")).toBe(4);
  });

  it("returns 0 for non-hit results", () => {
    expect(totalBases("BB")).toBe(0);
    expect(totalBases("SO")).toBe(0);
    expect(totalBases("E")).toBe(0);
  });
});

describe("battingAverage", () => {
  it("returns hits / at-bats", () => {
    expect(battingAverage(1, 3)).toBeCloseTo(0.333, 3);
    expect(battingAverage(2, 4)).toBe(0.5);
  });

  it("returns 0 when there are no at-bats (no division by zero)", () => {
    expect(battingAverage(0, 0)).toBe(0);
  });
});

describe("onBasePercentage", () => {
  it("counts walks and HBP but not sacrifices in reaching base", () => {
    // 2 hits + 1 walk + 1 HBP in 6 AB + 1 walk + 1 HBP + 1 SAC = 9 denom
    const obp = onBasePercentage(2, 1, 1, 6, 1);
    expect(obp).toBeCloseTo((2 + 1 + 1) / (6 + 1 + 1 + 1), 3);
  });

  it("returns 0 when the denominator is 0", () => {
    expect(onBasePercentage(0, 0, 0, 0, 0)).toBe(0);
  });
});

describe("sluggingPercentage", () => {
  it("returns total bases / at-bats", () => {
    // 1 single, 1 double, 1 HR in 4 AB = (1+2+4)/4 = 1.75
    expect(sluggingPercentage(7, 4)).toBeCloseTo(1.75, 2);
  });

  it("returns 0 when there are no at-bats", () => {
    expect(sluggingPercentage(0, 0)).toBe(0);
  });
});

describe("ops", () => {
  it("is the sum of OBP and SLG", () => {
    expect(ops(0.333, 0.5)).toBeCloseTo(0.833, 3);
  });
});

describe("fieldingPercentage", () => {
  it("returns (PO + A) / (PO + A + E)", () => {
    expect(fieldingPercentage(5, 3, 2)).toBeCloseTo(8 / 10, 3);
  });

  it("returns 0 when there are no chances", () => {
    expect(fieldingPercentage(0, 0, 0)).toBe(0);
  });
});

describe("formatAvg", () => {
  it("drops the leading zero — baseball convention is .333, not 0.333", () => {
    expect(formatAvg(0.333)).toBe(".333");
    expect(formatAvg(0.5)).toBe(".500");
    expect(formatAvg(0)).toBe(".000");
  });

  it("keeps the leading digit for values >= 1.0", () => {
    expect(formatAvg(1.234)).toBe("1.234");
  });
});

describe("formatTime12", () => {
  it("returns 'Not set' for null", () => {
    expect(formatTime12(null)).toBe("Not set");
  });

  it("converts 24h to 12h with AM/PM", () => {
    expect(formatTime12("09:00")).toBe("9:00 AM");
    expect(formatTime12("13:05")).toBe("1:05 PM");
    expect(formatTime12("00:30")).toBe("12:30 AM");
    expect(formatTime12("12:00")).toBe("12:00 PM");
  });
});
