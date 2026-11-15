import { describe, expect, it } from "vitest";
import { computeIndicators } from "@/lib/nasa/indicators";
import { lastYearSummary } from "@/lib/nasa/scenario";
import type { FarmProfile } from "@/lib/schemas/farm";
import { syntheticDaily } from "@/lib/testing/synthetic";
import { CROP_PARAMS } from "./crops";
import { evaluateStrategies } from "./engine";
import { cycleKey, dominates, optimizeRotation, paretoFront, sequences } from "./optimize";
import { scoringContext, type CriterionResult } from "./score";

const farm: FarmProfile = {
  name: "Test",
  latitude: 39,
  longitude: 33,
  areaHa: 20,
  currentCrop: "wheat",
  previousCrops: ["wheat", "barley"],
  irrigation: "none",
  soilType: "loamy",
  soilPh: 7.2,
  priorities: ["water-efficiency", "soil-health"],
  marketCrops: [],
  hasRowPlanter: true,
  coverCropsOk: true,
};
const points = syntheticDaily({ years: 10 });
const summary = lastYearSummary(points, "2026-01-01T00:00:00Z");
const indicators = computeIndicators(points, 39, 1000);
const ctx = (f: FarmProfile) => scoringContext(f, summary, indicators, { meanSlopePct: 4 });

const crit = (...scores: (number | null)[]): CriterionResult[] =>
  scores.map((score, i) => ({ id: "water", label: String(i), score, weight: 1, explanation: "" }));

describe("search helpers", () => {
  it("enumerates every sequence with repetition", () => {
    const all = [...sequences(["wheat", "lentil", "barley"], 3)];
    expect(all).toHaveLength(27);
    expect(new Set(all.map((s) => s.join())).size).toBe(27);
  });

  it("treats rotations of the same cycle as one", () => {
    expect(cycleKey(["wheat", "lentil", "barley"], false)).toBe(cycleKey(["lentil", "barley", "wheat"], false));
    expect(cycleKey(["wheat", "lentil", "barley"], false)).not.toBe(cycleKey(["wheat", "barley", "lentil"], false));
    expect(cycleKey(["wheat", "lentil", "barley"], false)).not.toBe(cycleKey(["wheat", "lentil", "barley"], true));
  });

  it("defines dominance on the criteria both options scored", () => {
    expect(dominates(crit(5, 5), crit(5, 4))).toBe(true);
    expect(dominates(crit(5, 5), crit(5, 5))).toBe(false);
    expect(dominates(crit(6, 3), crit(5, 4))).toBe(false);
    expect(dominates(crit(5, null), crit(4, 9))).toBe(true);
  });

  it("computes the same Pareto front as brute force", () => {
    let seed = 7;
    const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
    const items = Array.from({ length: 300 }, (_, i) => ({
      i,
      criteria: crit(...Array.from({ length: 4 }, () => Math.round(rand() * 20))),
    }));
    const brute = items.filter((a) => !items.some((b) => b !== a && dominates(b.criteria, a.criteria)));
    const fast = paretoFront(items);
    expect(new Set(fast.map((x) => x.i))).toEqual(new Set(brute.map((x) => x.i)));
  });
});

describe("optimizeRotation", () => {
  const result = optimizeRotation(farm, ctx(farm));

  it("labels itself as optimization and reports the search size", () => {
    expect(result.method).toBe("optimization");
    expect(result.evaluated).toBeGreaterThan(300);
    expect(result.paretoSize).toBeGreaterThan(0);
    expect(result.options.length).toBeGreaterThanOrEqual(1);
    expect(result.options.length).toBeLessThanOrEqual(3);
  });

  it("returns only Pareto-optimal options, best first", () => {
    const [best, ...rest] = result.options;
    for (const r of rest) expect(best.overall).toBeGreaterThanOrEqual(r.overall);
  });

  it("returns clearly different alternatives", () => {
    const sets = result.options.map((o) => `${[...new Set(o.sequence)].sort().join()}|${o.coverCrops}`);
    expect(new Set(sets).size).toBe(sets.length);
  });

  it("never starts with the crop in the field now", () => {
    for (const o of result.options) expect(o.sequence[0]).not.toBe(farm.currentCrop);
  });

  it("scores at least as well as every hand-built strategy (same criteria)", () => {
    const strategies = evaluateStrategies(farm, summary, indicators, { meanSlopePct: 4 });
    const bestHand = Math.max(...strategies.filter((s) => s.id !== "current").map((s) => s.overall));
    expect(result.options[0].overall).toBeGreaterThanOrEqual(bestHand);
  });

  it("respects market, planter and cover-crop limits", () => {
    const limited: FarmProfile = {
      ...farm,
      marketCrops: ["wheat", "barley", "chickpea", "lentil", "corn"],
      hasRowPlanter: false,
      coverCropsOk: false,
    };
    const r = optimizeRotation(limited, ctx(limited));
    for (const o of r.options) {
      expect(o.coverCrops).toBe(false);
      for (const c of o.sequence) {
        expect(["wheat", "barley", "chickpea", "lentil"]).toContain(c);
        expect(CROP_PARAMS[c].needsRowPlanter).toBe(false);
      }
    }
    expect(r.constraintsRelaxed).toBe(false);
  });

  it("says when limits were too tight and had to be relaxed", () => {
    const tight: FarmProfile = { ...farm, marketCrops: ["wheat"] };
    expect(optimizeRotation(tight, ctx(tight)).constraintsRelaxed).toBe(true);
  });

  it("follows the farmer's priorities", () => {
    const water: FarmProfile = { ...farm, priorities: ["water-efficiency"] };
    const income: FarmProfile = { ...farm, priorities: ["extra-income", "animal-feed"] };
    const w = optimizeRotation(water, ctx(water)).options[0];
    const inc = optimizeRotation(income, ctx(income)).options[0];
    const score = (o: typeof w, id: string) => o.criteria.find((c) => c.id === id)!.score!;
    expect(score(w, "water")).toBeGreaterThanOrEqual(score(inc, "water"));
    expect(score(inc, "income")).toBeGreaterThanOrEqual(score(w, "income"));
  });

  it("is fast enough for 3 and 4 seasons", () => {
    const c = ctx(farm);
    let t0 = performance.now();
    const three = optimizeRotation(farm, c, { seasons: 3 });
    const ms3 = performance.now() - t0;
    t0 = performance.now();
    const four = optimizeRotation(farm, c, { seasons: 4 });
    const ms4 = performance.now() - t0;
    console.info(
      `[eval] optimizer: 3 seasons ${three.evaluated} candidates, front ${three.paretoSize}, ${ms3.toFixed(0)} ms; ` +
        `4 seasons ${four.evaluated} candidates, front ${four.paretoSize}, ${ms4.toFixed(0)} ms (Node)`,
    );
    expect(ms3).toBeLessThan(1000);
  });
});
