import { describe, expect, it } from "vitest";
import { monthlyMeans, ndviAnomalies, seasonSummary, type NdviPoint } from "./ndvi";

/** Three years with a May peak and low winter values. */
function series(): NdviPoint[] {
  const shape = [0.15, 0.16, 0.25, 0.4, 0.5, 0.35, 0.25, 0.22, 0.21, 0.2, 0.18, 0.15];
  const out: NdviPoint[] = [];
  for (const [i, y] of [2023, 2024, 2025].entries()) {
    shape.forEach((v, m) =>
      out.push({ month: `${y}-${String(m + 1).padStart(2, "0")}`, ndvi: v + i * 0.01 }),
    );
  }
  return out;
}

describe("NDVI statistics", () => {
  it("averages by calendar month", () => {
    const avg = monthlyMeans(series());
    expect(avg[4]).toBeCloseTo(0.51, 6);
  });

  it("finds the greenest month and the low-cover months", () => {
    const s = seasonSummary(series());
    expect(s.peakMonth).toBe(5);
    expect(s.lowMonths).toEqual([1, 2, 11, 12]);
  });

  it("ignores missing months and counts them", () => {
    const pts = series().map((p) => (p.month.endsWith("-05") ? { ...p, ndvi: null } : p));
    expect(seasonSummary(pts).peakMonth).toBe(4);
    expect(seasonSummary(pts).missing).toBe(3);
    expect(seasonSummary([]).peakMonth).toBeNull();
  });

  it("does not let a single year decide a calendar month", () => {
    // May has data in only one year: it must not become the peak.
    const pts = series().map((p) =>
      p.month.endsWith("-05") && !p.month.startsWith("2025") ? { ...p, ndvi: null } : p,
    );
    expect(monthlyMeans(pts)[4]).toBeNull();
    // The next greenest month in the synthetic shape is April (0.40).
    expect(seasonSummary(pts).peakMonth).toBe(4);
  });

  it("flags a month far below its usual value", () => {
    const pts = [2020, 2021, 2022, 2023, 2024].map((y) => ({ month: `${y}-05`, ndvi: 0.5 + (y % 2) * 0.02 }));
    pts.push({ month: "2025-05", ndvi: 0.2 });
    const z = ndviAnomalies(pts);
    expect(z.at(-1)!.z!).toBeLessThan(-1.5);
  });

  it("needs at least 3 values per calendar month for an anomaly", () => {
    const z = ndviAnomalies([
      { month: "2024-05", ndvi: 0.5 },
      { month: "2025-05", ndvi: 0.4 },
    ]);
    expect(z.every((p) => p.z === null)).toBe(true);
  });
});
