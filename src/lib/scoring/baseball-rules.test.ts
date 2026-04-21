import { describe, it, expect } from "vitest";
import {
  getForcedBases,
  isRunnerForced,
  getDefaultRunnerAdvances,
  getDefaultDoublePlayResult,
  canDoublePlay,
  canGroundBallDoublePlay,
  countRunners,
  describeBaseState,
  type BaseState,
} from "./baseball-rules";
import type { BaseRunner } from "./types";

const runner = (name: string): BaseRunner => ({
  playerId: null,
  opponentBatterId: null,
  playerName: name,
});

const empty: BaseState = { first: null, second: null, third: null };

describe("getForcedBases — the force chain starts at first and propagates", () => {
  it("no runners: no forces", () => {
    expect(getForcedBases(empty).size).toBe(0);
  });

  it("runner on 1st only: 1st is forced", () => {
    const forced = getForcedBases({ ...empty, first: runner("A") });
    expect([...forced]).toEqual(["first"]);
  });

  it("runners on 1st & 2nd: both forced", () => {
    const forced = getForcedBases({ ...empty, first: runner("A"), second: runner("B") });
    expect(forced.has("first")).toBe(true);
    expect(forced.has("second")).toBe(true);
    expect(forced.has("third")).toBe(false);
  });

  it("runner on 2nd only: nobody forced (chain breaks at empty 1st)", () => {
    expect(getForcedBases({ ...empty, second: runner("A") }).size).toBe(0);
  });

  it("runners on 1st & 3rd: only 1st forced", () => {
    const forced = getForcedBases({ ...empty, first: runner("A"), third: runner("C") });
    expect(forced.has("first")).toBe(true);
    expect(forced.has("third")).toBe(false);
  });

  it("bases loaded: all three forced", () => {
    const forced = getForcedBases({ first: runner("A"), second: runner("B"), third: runner("C") });
    expect(forced.size).toBe(3);
  });
});

describe("isRunnerForced", () => {
  it("runner on 3rd alone is not forced", () => {
    expect(isRunnerForced({ ...empty, third: runner("C") }, "third")).toBe(false);
  });
});

describe("getDefaultRunnerAdvances", () => {
  it("single with runner on 1st: 1st → 2nd", () => {
    const advances = getDefaultRunnerAdvances("1B", { ...empty, first: runner("A") });
    expect(advances).toEqual([{ from: "first", to: "second" }]);
  });

  it("double scores runners on 2nd and 3rd, advances 1st → 3rd", () => {
    const advances = getDefaultRunnerAdvances("2B", {
      first: runner("A"),
      second: runner("B"),
      third: runner("C"),
    });
    expect(advances).toContainEqual({ from: "third", to: "home" });
    expect(advances).toContainEqual({ from: "second", to: "home" });
    expect(advances).toContainEqual({ from: "first", to: "third" });
  });

  it("triple scores everyone", () => {
    const advances = getDefaultRunnerAdvances("3B", {
      first: runner("A"),
      second: runner("B"),
      third: runner("C"),
    });
    expect(advances.filter((a) => a.to === "home")).toHaveLength(3);
  });

  it("walk with runner on 2nd only: nobody advances (not forced)", () => {
    const advances = getDefaultRunnerAdvances("BB", { ...empty, second: runner("B") });
    expect(advances).toEqual([]);
  });

  it("walk with runner on 1st forces 1st → 2nd", () => {
    const advances = getDefaultRunnerAdvances("BB", { ...empty, first: runner("A") });
    expect(advances).toEqual([{ from: "first", to: "second" }]);
  });

  it("walk with bases loaded forces everyone up, 3rd scores", () => {
    const advances = getDefaultRunnerAdvances("BB", {
      first: runner("A"),
      second: runner("B"),
      third: runner("C"),
    });
    expect(advances).toContainEqual({ from: "third", to: "home" });
    expect(advances).toContainEqual({ from: "second", to: "third" });
    expect(advances).toContainEqual({ from: "first", to: "second" });
  });

  it("fly out with runner on 3rd: 3rd scores, others hold", () => {
    const advances = getDefaultRunnerAdvances("FO", {
      first: runner("A"),
      second: runner("B"),
      third: runner("C"),
    });
    expect(advances).toEqual([{ from: "third", to: "home" }]);
  });

  it("fielder's choice with runner on 1st only: 1st → out", () => {
    const advances = getDefaultRunnerAdvances("FC", { ...empty, first: runner("A") });
    expect(advances).toContainEqual({ from: "first", to: "out" });
  });

  it("strikeout never moves runners by default", () => {
    const advances = getDefaultRunnerAdvances("SO", {
      first: runner("A"),
      second: runner("B"),
      third: runner("C"),
    });
    expect(advances).toEqual([]);
  });

  it("sacrifice with runner on 2nd advances lead runner one base", () => {
    const advances = getDefaultRunnerAdvances("SAC", { ...empty, second: runner("B") });
    expect(advances).toEqual([{ from: "second", to: "third" }]);
  });
});

describe("getDefaultDoublePlayResult", () => {
  it("runner on 1st: 2 outs, runner and batter both out", () => {
    const dp = getDefaultDoublePlayResult({ ...empty, first: runner("A") }, 6);
    expect(dp.outsRecorded).toBe(2);
    expect(dp.runnerAdvances).toContainEqual({ from: "first", to: "out" });
    expect(dp.notation).toBe("6-4-3");
  });

  it("runners on 1st & 2nd: 1st is out, 2nd advances to 3rd", () => {
    const dp = getDefaultDoublePlayResult({ ...empty, first: runner("A"), second: runner("B") }, 6);
    expect(dp.runnerAdvances).toContainEqual({ from: "first", to: "out" });
    expect(dp.runnerAdvances).toContainEqual({ from: "second", to: "third" });
  });

  it("bases loaded: 3rd scores as forces release", () => {
    const dp = getDefaultDoublePlayResult(
      { first: runner("A"), second: runner("B"), third: runner("C") },
      6
    );
    expect(dp.runnerAdvances).toContainEqual({ from: "third", to: "home" });
  });

  it("runner on 3rd only (no force): LDP/FDP — lead runner doubled off", () => {
    const dp = getDefaultDoublePlayResult({ ...empty, third: runner("C") }, null);
    expect(dp.runnerAdvances).toContainEqual({ from: "third", to: "out" });
  });
});

describe("canDoublePlay / canGroundBallDoublePlay", () => {
  it("empty bases: neither possible", () => {
    expect(canDoublePlay(empty)).toBe(false);
    expect(canGroundBallDoublePlay(empty)).toBe(false);
  });

  it("any runner on base: DP possible", () => {
    expect(canDoublePlay({ ...empty, third: runner("C") })).toBe(true);
  });

  it("GDP requires a runner on 1st", () => {
    expect(canGroundBallDoublePlay({ ...empty, second: runner("B") })).toBe(false);
    expect(canGroundBallDoublePlay({ ...empty, first: runner("A") })).toBe(true);
  });
});

describe("countRunners / describeBaseState", () => {
  it("counts runners on base", () => {
    expect(countRunners(empty)).toBe(0);
    expect(
      countRunners({ first: runner("A"), second: runner("B"), third: runner("C") })
    ).toBe(3);
  });

  it("describes the base state in plain english", () => {
    expect(describeBaseState(empty)).toBe("Bases empty");
    expect(describeBaseState({ first: runner("A"), second: null, third: null })).toBe(
      "Runner(s) on 1st"
    );
    expect(
      describeBaseState({ first: runner("A"), second: runner("B"), third: runner("C") })
    ).toBe("Bases loaded");
  });
});
