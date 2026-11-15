import { describe, expect, it } from "vitest";
import { syntheticDaily } from "@/lib/testing/synthetic";
import { computeIndicators, doyLabel, referenceEt0 } from "./indicators";

describe("referenceEt0 (FAO-56 Penman-Monteith)", () => {
  it("reproduces FAO-56 Example 18 (Uccle, 6 July) within 0.1 mm/day", () => {
    // FAO Irrigation and Drainage Paper 56, Example 18: ET0 = 3.9 mm/day.
    // Inputs: lat 50°48'N, 100 m, Tmax 21.5, Tmin 12.3 °C, u2 2.078 m/s,
    // Rs 22.07 MJ/m²/day, ea 1.409 kPa (here given as mean RH = ea / es).
    const es = (0.6108 * Math.exp((17.27 * 21.5) / (21.5 + 237.3)) +
      0.6108 * Math.exp((17.27 * 12.3) / (12.3 + 237.3))) / 2;
    const r = referenceEt0(
      { date: "2001-07-06", t2m: null, tmax: 21.5, tmin: 12.3, precip: 0,
        rh: (1.409 / es) * 100, wind: 2.078, solar: 22.07, gwetTop: null, gwetRoot: null },
      50.8,
      100,
    );
    expect(r.fallback).toBe(false);
    expect(r.et0).not.toBeNull();
    expect(Math.abs(r.et0! - 3.9)).toBeLessThan(0.1);
  });

  it("falls back to Hargreaves when humidity, wind or sun is missing", () => {
    const r = referenceEt0(
      { date: "2001-07-06", t2m: null, tmax: 30, tmin: 15, precip: 0,
        rh: null, wind: null, solar: null, gwetTop: null, gwetRoot: null },
      39,
      1000,
    );
    expect(r.fallback).toBe(true);
    expect(r.et0!).toBeGreaterThan(3);
    expect(r.et0!).toBeLessThan(9);
  });

  it("returns null without temperature", () => {
    const r = referenceEt0(
      { date: "2001-07-06", t2m: null, tmax: null, tmin: null, precip: 0,
        rh: 50, wind: 2, solar: 20, gwetTop: null, gwetRoot: null },
      39,
      1000,
    );
    expect(r.et0).toBeNull();
  });
});

describe("computeIndicators", () => {
  const points = syntheticDaily({ years: 10, meanTemp: 12, amplitude: 12 });
  const ind = computeIndicators(points, 39, 1000);

  it("covers 12 months and about 10 years", () => {
    expect(ind.months).toHaveLength(12);
    expect(ind.years).toBeCloseTo(10, 0);
  });

  it("puts frost in winter and none in summer", () => {
    expect(ind.months[0].frostDays!).toBeGreaterThan(10);
    expect(ind.months[6].frostDays!).toBe(0);
  });

  it("finds a last spring frost before summer and a first autumn frost after", () => {
    expect(ind.frost.lastSpringDoy).not.toBeNull();
    expect(ind.frost.firstAutumnDoy).not.toBeNull();
    expect(ind.frost.lastSpringDoy!).toBeLessThan(182);
    expect(ind.frost.firstAutumnDoy!).toBeGreaterThan(182);
    expect(ind.frost.yearsChecked).toBeGreaterThanOrEqual(9);
  });

  it("marks dry summer months and a semi-arid or drier class", () => {
    expect(ind.annual.dryMonths).toContain(7);
    expect(ind.annual.aridityIndex!).toBeLessThan(0.65);
    expect(ind.et0FallbackShare).toBe(0);
  });

  it("formats day of year", () => {
    expect(doyLabel(1)).toBe("1 Jan");
    expect(doyLabel(60)).toBe("1 Mar");
  });
});
