import { describe, expect, it } from "vitest";
import { syntheticDaily } from "@/lib/testing/synthetic";
import { groupYears, splitYears, trendTest, type YearRecord } from "./stats";

describe("trendTest (Mann-Kendall + Sen's slope)", () => {
  it("matches the textbook z for a strictly rising series of 10", () => {
    // S = 45, Var(S) = 125, z = (45 - 1) / sqrt(125) = 3.935, p ≈ 8.3e-5.
    const t = trendTest([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])!;
    expect(t.p).toBeLessThan(1e-4);
    expect(t.p).toBeGreaterThan(5e-5);
    expect(t.clear).toBe(true);
    expect(t.perDecade).toBeCloseTo(10, 6);
  });

  it("does not call a zig-zag series a trend", () => {
    const t = trendTest([5, 3, 6, 2, 5, 3, 6, 2, 5, 3])!;
    expect(t.clear).toBe(false);
  });

  it("is robust to one extreme year (Sen's slope)", () => {
    const t = trendTest([1, 2, 3, 4, 50, 6, 7, 8, 9, 10])!;
    expect(t.perDecade).toBeCloseTo(10, 6);
  });

  it("needs at least 8 values", () => {
    expect(trendTest([1, 2, 3, 4, 5, 6, 7])).toBeNull();
    expect(trendTest([1, null, 3, null, 5, 6, 7, 8, 9])).toBeNull();
  });
});

describe("splitYears", () => {
  it("cuts the record into 12-month periods from the newest day", () => {
    const years = splitYears(syntheticDaily({ years: 10 }));
    expect(years).toHaveLength(10);
    expect(years[0].points).toHaveLength(365);
    expect(years.every((y) => y.meanTemp !== null && y.precipMm !== null)).toBe(true);
  });

  it("detects synthetic warming", () => {
    const years = splitYears(syntheticDaily({ years: 10, warmingPerYear: 0.1 }));
    const t = trendTest(years.map((y) => y.meanTemp))!;
    expect(t.clear).toBe(true);
    expect(t.perDecade).toBeGreaterThan(0.6);
    expect(t.perDecade).toBeLessThan(1.4);
  });
});

describe("groupYears (k-means, k = 3)", () => {
  const year = (rain: number): YearRecord => ({
    start: "", end: "", points: [], meanTemp: 12, precipMm: rain,
  });

  it("separates clearly dry, normal and wet years", () => {
    const g = groupYears([280, 300, 310, 400, 410, 420, 430, 600, 620, 290].map(year))!;
    const typeOf = (rain: number) => g.years.find((y) => y.precipMm === rain)!.type;
    expect(typeOf(280)).toBe("dry");
    expect(typeOf(410)).toBe("normal");
    expect(typeOf(620)).toBe("wet");
    expect(g.centers.dry).toBeLessThan(g.centers.normal);
    expect(g.centers.normal).toBeLessThan(g.centers.wet);
  });

  it("is deterministic", () => {
    const rains = [280, 300, 310, 400, 410, 420, 430, 600, 620, 290].map(year);
    expect(groupYears(rains)).toEqual(groupYears(rains));
  });

  it("refuses fewer than 6 years", () => {
    expect(groupYears([300, 400, 500, 600, 700].map(year))).toBeNull();
  });
});
