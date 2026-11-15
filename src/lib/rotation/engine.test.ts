import { describe, expect, it } from "vitest";
import { computeIndicators } from "@/lib/nasa/indicators";
import { lastYearSummary } from "@/lib/nasa/scenario";
import type { FarmProfile } from "@/lib/schemas/farm";
import { syntheticDaily } from "@/lib/testing/synthetic";
import { CROP_PARAMS } from "./crops";
import { buildRecommendation, evaluateStrategies } from "./engine";

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

/** The parts of a result that the UI shows and the optimizer will depend on. */
const shape = (rs: ReturnType<typeof evaluateStrategies>) =>
  rs.map((r) => ({
    id: r.id,
    sequence: r.sequence,
    coverCrops: r.coverCrops,
    overall: r.overall,
    criteria: Object.fromEntries(r.criteria.map((c) => [c.id, c.score])),
  }));

describe("evaluateStrategies", () => {
  const results = evaluateStrategies(farm, summary, indicators, { meanSlopePct: 4 });

  it("matches the recorded output (guards the Phase 4 refactor)", () => {
    expect(shape(results)).toMatchSnapshot();
  });

  it("always includes the current rotation first", () => {
    expect(results[0].id).toBe("current");
    expect(results[0].sequence).toEqual(["wheat", "barley", "wheat"]);
  });

  it("keeps every score between 0 and 100", () => {
    for (const r of results) {
      expect(r.overall).toBeGreaterThanOrEqual(0);
      expect(r.overall).toBeLessThanOrEqual(100);
      for (const c of r.criteria) if (c.score !== null) {
        expect(c.score).toBeGreaterThanOrEqual(0);
        expect(c.score).toBeLessThanOrEqual(100);
      }
    }
  });

  it("explains every option", () => {
    for (const r of results) {
      expect(r.why.length).toBeGreaterThan(10);
      expect(r.evidence.length).toBeGreaterThan(0);
      expect(r.gaps.length).toBeGreaterThan(0);
    }
  });

  it("never suggests crops outside the market list or without a planter", () => {
    const limited = evaluateStrategies(
      { ...farm, marketCrops: ["wheat", "barley", "chickpea", "lentil", "corn"], hasRowPlanter: false },
      summary,
      indicators,
    );
    for (const r of limited.filter((x) => x.id !== "current")) {
      for (const c of r.sequence) {
        expect(["wheat", "barley", "chickpea", "lentil"]).toContain(c);
        expect(CROP_PARAMS[c].needsRowPlanter).toBe(false);
      }
    }
  });

  it("relaxes limits that leave fewer than two crops, and says so", () => {
    const tiny = evaluateStrategies({ ...farm, marketCrops: ["wheat"] }, summary, indicators);
    const alt = tiny.find((r) => r.id !== "current")!;
    expect(alt.gaps.join(" ")).toMatch(/too few crops/);
  });

  it("drops an option identical to an earlier one", () => {
    const noCover = evaluateStrategies({ ...farm, coverCropsOk: false }, summary, indicators);
    const keys = noCover.map((r) => `${r.sequence.join(">")}|${r.coverCrops}`);
    expect(new Set(keys.slice(1)).size).toBe(keys.length - 1);
  });

  it("scores slope into erosion: steeper means lower erosion score", () => {
    const flat = evaluateStrategies(farm, summary, indicators, { meanSlopePct: 1 });
    const steep = evaluateStrategies(farm, summary, indicators, { meanSlopePct: 20 });
    const ero = (rs: typeof flat) => rs[0].criteria.find((c) => c.id === "erosion")!.score!;
    expect(ero(steep)).toBeLessThan(ero(flat));
  });

  it("still works without any climate data", () => {
    const bare = evaluateStrategies(farm, null, null);
    expect(bare[0].criteria.find((c) => c.id === "climate")!.score).toBeNull();
    expect(bare[0].confidence.level).toBe("low");
  });
});

describe("method labels and the optimizer option", () => {
  const results = evaluateStrategies(farm, summary, indicators, { meanSlopePct: 4 });

  it("labels hand-built strategies rule-based and the search result optimization", () => {
    for (const r of results) {
      expect(r.method).toBe(r.id === "optimized" ? "optimization" : "rule-based");
      expect(r.sources).toContain("farmer");
      expect(r.sources).toContain("crop-estimates");
    }
  });

  it("adds the search result when it is a new rotation, and explains it", () => {
    const opt = results.find((r) => r.id === "optimized");
    expect(opt).toBeDefined();
    expect(opt!.why).toMatch(/We scored all \d+ rotations/);
  });

  it("can switch the search off", () => {
    const plain = evaluateStrategies(farm, summary, indicators, null, { optimize: false });
    expect(plain.some((r) => r.id === "optimized")).toBe(false);
  });

  it("never claims ML for any strategy", () => {
    expect(results.every((r) => r.method !== ("ml-trained" as string))).toBe(true);
  });
});

describe("buildRecommendation", () => {
  it("names the top option and compares it with the current rotation", () => {
    const results = evaluateStrategies(farm, summary, indicators);
    const rec = buildRecommendation(farm, results);
    const best = [...results].sort((a, b) => b.overall - a.overall)[0];
    expect(rec.bestId).toBe(best.id);
    expect(rec.reasons.length).toBeGreaterThan(0);
    expect(rec.discuss.length).toBe(3);
  });

  it("adds an information-only note about recent unusual months", () => {
    const results = evaluateStrategies(farm, summary, indicators);
    const without = buildRecommendation(farm, results);
    const withNote = buildRecommendation(farm, results, {
      unusualMonths: [{ ym: "2026-06", summary: "Far more hot days than usual." }],
    });
    expect(withNote.cautions.length).toBe(without.cautions.length + 1);
    expect(withNote.cautions.join(" ")).toMatch(/2026-06: far more hot days than usual\)/);
    expect(withNote.cautions.join(" ")).toMatch(/do not include them/);
    // Scores are untouched.
    expect(withNote.bestId).toBe(without.bestId);
  });
});
