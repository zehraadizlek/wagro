import { describe, expect, it } from "vitest";
import { syntheticDaily } from "@/lib/testing/synthetic";
import { cropClimateFit } from "@/lib/rotation/score";
import { applyScenario, climatologySummary, lastYearSummary, scenarioClimate } from "./scenario";
import type { DailyPoint } from "./power";

const AT = "2026-01-01T00:00:00Z";
const points = syntheticDaily({ years: 10 });

describe("climatologySummary", () => {
  it("averages every complete year of the record", () => {
    const c = climatologySummary(points, AT);
    expect(c.years).toBe(10);
    expect(c.meanTemp).not.toBeNull();
    expect(c.annualPrecipMm).not.toBeNull();
  });

  it("is barely moved by one extreme last year, unlike the last-12-months summary", () => {
    // Make the newest year bone dry.
    const dry: DailyPoint[] = points.map((p, i) =>
      i >= points.length - 365 ? { ...p, precip: 0 } : p,
    );
    const before = climatologySummary(points, AT).annualPrecipMm!;
    const after = climatologySummary(dry, AT).annualPrecipMm!;
    expect(lastYearSummary(dry, AT).annualPrecipMm).toBe(0);
    // One of ten years is gone, so the mean drops by about a tenth.
    expect(after).toBeGreaterThan(before * 0.8);
    expect(after).toBeLessThan(before);
  });

  it("returns null values instead of guessing when fewer than 5 complete years exist", () => {
    const short = climatologySummary(syntheticDaily({ years: 3 }), AT);
    expect(short.years).toBe(3);
    expect(short.meanTemp).toBeNull();
    expect(short.annualPrecipMm).toBeNull();
  });

  it("skips years with too many missing days", () => {
    const gappy: DailyPoint[] = points.map((p, i) =>
      i < 365 * 6 ? { ...p, precip: null, t2m: null } : p,
    );
    const c = climatologySummary(gappy, AT);
    expect(c.meanTemp).toBeNull();
    expect(c.annualPrecipMm).toBeNull();
  });
});

describe("what-if scenarios use the same climatology", () => {
  it("shifts the long-term mean temperature and scales the long-term rain", () => {
    const base = climatologySummary(points, AT);
    const { climatology } = scenarioClimate(points, { tempC: 2, rain: -0.2 }, 39, 1000, AT);
    expect(climatology.meanTemp! - base.meanTemp!).toBeCloseTo(2, 5);
    expect(climatology.annualPrecipMm! / base.annualPrecipMm!).toBeCloseTo(0.8, 5);
    expect(climatologySummary(applyScenario(points, { tempC: 0, rain: 0 }), AT)).toEqual(base);
  });
});

describe("cropClimateFit rain bounds", () => {
  // Wheat: prototype rain range 300–600 mm, temperature 8–22 °C.
  const inRangeTemp = 15;
  const fit = (rain: number, irrigation: "none" | "limited" | "full" = "none") =>
    cropClimateFit("wheat", { meanTemp: inRangeTemp, annualPrecipMm: rain }, irrigation)!;

  it("scores full fit inside the range", () => {
    expect(fit(450)).toBe(100);
  });

  it("penalises rain below the lower bound, and irrigation offsets it", () => {
    expect(fit(150)).toBeLessThan(100);
    expect(fit(150, "full")).toBe(100);
  });

  it("penalises rain above the upper bound, which irrigation cannot offset", () => {
    expect(fit(1200)).toBeLessThan(100);
    expect(fit(1200, "full")).toBe(fit(1200));
    expect(fit(1200)).toBeLessThan(fit(700));
  });
});
