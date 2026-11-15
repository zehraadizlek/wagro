import { describe, expect, it } from "vitest";
import type { NdviPoint } from "./ndvi";
import { checkCalendar, expectedPeakMonth, phenology } from "./phenology";

/** Synthetic seasonal curve (NOT real data): low in autumn, peak in May. */
const SHAPE = [0.18, 0.2, 0.28, 0.4, 0.5, 0.42, 0.25, 0.15, 0.14, 0.14, 0.15, 0.17];

function series(years: number[], shape = SHAPE): NdviPoint[] {
  return years.flatMap((y) =>
    shape.map((v, m) => ({ month: `${y}-${String(m + 1).padStart(2, "0")}`, ndvi: v })),
  );
}

describe("phenology", () => {
  const p = phenology(series([2023, 2024, 2025]));

  it("finds peak, green-up and decline per year", () => {
    expect(p.years).toHaveLength(3);
    const y = p.years[0];
    expect(y.peakMonth).toBe(5);
    // min 0.14, max 0.5, range 0.36 → green-up above 0.212 (March), decline below 0.32 (July)
    expect(y.greenUpMonth).toBe(3);
    expect(y.declineMonth).toBe(7);
    expect(y.amplitude).toBeCloseTo(0.36, 2);
  });

  it("summarizes a typical season and low-cover months", () => {
    expect(p.typical).toEqual({ peakMonth: 5, greenUpMonth: 3, declineMonth: 7, greenFromYearStart: false });
    expect(p.lowCoverMonths).toEqual([1, 8, 9, 10, 11, 12]);
  });

  it("skips years with too little data or no clear season", () => {
    const gappy = series([2024]).map((x, i) => (i < 4 ? { ...x, ndvi: null } : x));
    expect(phenology(gappy).years).toHaveLength(0);
    const flat = series([2024], Array(12).fill(0.3));
    expect(phenology(flat).typical).toBeNull();
  });
});

describe("calendar check", () => {
  it("expects winter wheat to peak about two months before its July harvest", () => {
    expect(expectedPeakMonth("wheat", 39)).toBe(5);
    expect(expectedPeakMonth("wheat", -33)).toBe(11);
  });

  it("agrees when the satellite peak is within one month", () => {
    const c = checkCalendar(phenology(series([2023, 2024, 2025])), "wheat", 39)!;
    expect(c.offset).toBe(0);
    expect(c.agrees).toBe(true);
  });

  it("flags a clear mismatch (summer crop calendar vs a spring peak)", () => {
    const c = checkCalendar(phenology(series([2023, 2024, 2025])), "corn", 39)!;
    // Corn harvest in October → expected peak August; observed peak May.
    expect(c.expectedPeak).toBe(8);
    expect(c.offset).toBe(-3);
    expect(c.agrees).toBe(false);
  });
});

describe("real NDVI series (lat 39, lon 33) — plausibility only", () => {
  // Values decoded from NASA GIBS on 2026-11-15; see the fixture note.
  it("finds a spring peak that fits a winter cereal calendar", async () => {
    const { points } = (await import("./__fixtures__/ndvi-39n-33e.json")).default as { points: NdviPoint[] };
    const p = phenology(points);
    expect(p.years.map((y) => y.year)).toEqual([2024, 2025, 2026]);
    expect(p.typical!.peakMonth).toBeGreaterThanOrEqual(4);
    expect(p.typical!.peakMonth).toBeLessThanOrEqual(6);
    expect(checkCalendar(p, "wheat", 39)!.agrees).toBe(true);
    // Most years were already green in January (a winter crop), so no green-up month is claimed.
    expect(p.typical!.greenFromYearStart).toBe(true);
    // 2025 had a much weaker season than 2024 and 2026.
    const amp = Object.fromEntries(p.years.map((y) => [y.year, y.amplitude]));
    expect(amp[2025]).toBeLessThan(amp[2024] / 2);
  });
});
