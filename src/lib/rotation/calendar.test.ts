import { describe, expect, it } from "vitest";
import { computeIndicators } from "@/lib/nasa/indicators";
import type { FarmProfile } from "@/lib/schemas/farm";
import { syntheticDaily } from "@/lib/testing/synthetic";
import { buildSeasonPlan } from "./calendar";

const farm: FarmProfile = {
  name: "Test",
  latitude: 39,
  longitude: 33,
  areaHa: 20,
  currentCrop: "wheat",
  previousCrops: [],
  irrigation: "none",
  soilType: "loamy",
  soilPh: 7,
  priorities: [],
  marketCrops: [],
  hasRowPlanter: true,
  coverCropsOk: true,
};
const indicators = computeIndicators(syntheticDaily({ years: 10 }), 39, 1000);

describe("buildSeasonPlan", () => {
  it("places winter wheat Oct→Jul with a 2-month gap before the next Oct sowing", () => {
    const plan = buildSeasonPlan(["wheat", "wheat", "wheat"], indicators, farm);
    expect(plan.cells[0].month).toBe(10);
    expect(plan.cells[0].crop).toBe("wheat");
    expect(plan.cycleMonths).toBe(36);
    // Each wheat season is Oct–Jul (10 months); Aug and Sep are bare.
    expect(plan.bareMonths).toBe(6);
    expect(plan.gaps.every((g) => g.months === 2)).toBe(true);
  });

  it("finds a long bare gap between a winter and a spring crop", () => {
    const plan = buildSeasonPlan(["wheat", "chickpea", "wheat"], indicators, farm);
    const longest = Math.max(...plan.gaps.map((g) => g.months));
    expect(longest).toBeGreaterThanOrEqual(7);
  });

  it("fills gaps of 4+ months with a cover crop when asked", () => {
    const without = buildSeasonPlan(["wheat", "chickpea", "wheat"], indicators, farm);
    const withCover = buildSeasonPlan(["wheat", "chickpea", "wheat"], indicators, farm, { cover: true });
    expect(withCover.bareMonths).toBeLessThan(without.bareMonths);
    expect(withCover.cells.some((c) => c.cover)).toBe(true);
    // A month is either a crop, a cover crop or bare, never two at once.
    expect(withCover.cells.every((c) => !(c.cover && c.crop))).toBe(true);
  });

  it("never covers short gaps", () => {
    const plan = buildSeasonPlan(["wheat", "wheat", "wheat"], indicators, farm, { cover: true });
    expect(plan.cells.some((c) => c.cover)).toBe(false);
  });

  it("shifts the calendar by six months in the southern hemisphere", () => {
    const south = buildSeasonPlan(["wheat", "wheat", "wheat"], indicators, { ...farm, latitude: -33 });
    expect(south.cells[0].month).toBe(4);
  });

  it("flags frost for a frost-sensitive crop sown into cold months", () => {
    const plan = buildSeasonPlan(["chickpea", "chickpea", "chickpea"], indicators, farm);
    const march = plan.cells.find((c) => c.crop === "chickpea" && c.month === 3);
    expect(march?.flags).toContain("frost");
  });

  it("works without monthly climate (no flags)", () => {
    const plan = buildSeasonPlan(["wheat", "lentil", "barley"], null, farm);
    expect(plan.cells.every((c) => c.flags.length === 0)).toBe(true);
    expect(plan.exposedMonths).toBe(0);
  });
});
