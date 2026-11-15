import { describe, expect, it } from "vitest";
import type { DailyPoint } from "@/lib/nasa/power";
import { syntheticDaily } from "@/lib/testing/synthetic";
import { FEATURE_KEYS, featureTable, monthlyRows, withAnomalies } from "./monthly";

describe("monthlyRows", () => {
  const points = syntheticDaily({ years: 6, startYear: 2010 });
  const rows = monthlyRows(points, 39, 1000);

  it("makes one row per year-month in order", () => {
    expect(rows).toHaveLength(72);
    expect(rows[0].ym).toBe("2010-01");
    expect(rows.at(-1)!.ym).toBe("2015-12");
  });

  it("totals rain over the month", () => {
    const jan = points.filter((p) => p.date.startsWith("2010-01"));
    const sum = jan.reduce((a, p) => a + (p.precip ?? 0), 0);
    expect(rows[0].values.precipMm!).toBeCloseTo(sum, 0);
  });

  it("counts hot days and frost nights in the right seasons", () => {
    // Warmer variant: July daily maxima around 35 °C, January minima below 0.
    const warm = monthlyRows(syntheticDaily({ years: 6, startYear: 2010, meanTemp: 16 }), 39, 1000);
    const july = warm.find((r) => r.ym === "2012-07")!;
    const jan = warm.find((r) => r.ym === "2012-01")!;
    expect(july.values.hotDays!).toBeGreaterThan(10);
    expect(july.values.frostNights!).toBe(0);
    expect(jan.values.frostNights!).toBeGreaterThan(10);
  });

  it("computes the water balance as rain minus ET0", () => {
    const r = rows[30];
    expect(r.values.balanceMm!).toBeCloseTo(r.values.precipMm! - r.values.et0Mm!, 0);
  });

  it("leaves a month empty when it has too few days of data", () => {
    const gappy: DailyPoint[] = points.map((p) =>
      p.date.startsWith("2011-03") && Number(p.date.slice(8)) > 10 ? { ...p, t2m: null } : p,
    );
    const r = monthlyRows(gappy, 39, 1000).find((x) => x.ym === "2011-03")!;
    expect(r.days).toBe(10);
    expect(r.values.tmean).toBeNull();
    expect(r.values.precipMm).toBeNull();
  });
});

describe("withAnomalies", () => {
  it("gives z = 0 on average and flags an injected extreme month", () => {
    const rows = monthlyRows(syntheticDaily({ years: 20, startYear: 2000 }), 39, 1000);
    const target = rows.find((r) => r.ym === "2010-04")!;
    target.values.precipMm = 400; // far above any April in the record
    const table = withAnomalies(rows);
    const aprilZ = table.rows.filter((r) => r.month === 4 && r.ym !== "2010-04").map((r) => r.z.precipMm!);
    expect(Math.abs(aprilZ.reduce((a, b) => a + b, 0) / aprilZ.length)).toBeLessThan(0.5);
    expect(table.rows.find((r) => r.ym === "2010-04")!.z.precipMm!).toBeGreaterThan(3);
  });

  it("returns null z where a feature never varies (no frost in July)", () => {
    const table = featureTable(syntheticDaily({ years: 10 }), 39, 1000);
    const july = table.rows.find((r) => r.month === 7)!;
    expect(july.z.frostNights).toBeNull();
    expect(table.climatology).toHaveLength(12);
    expect(Object.keys(table.climatology[0]).sort()).toEqual([...FEATURE_KEYS].sort());
  });

  it("needs at least 5 years per calendar month", () => {
    const table = featureTable(syntheticDaily({ years: 4 }), 39, 1000);
    expect(table.rows.every((r) => FEATURE_KEYS.every((k) => r.z[k] === null))).toBe(true);
  });
});
