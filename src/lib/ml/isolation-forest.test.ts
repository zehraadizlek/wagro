import { describe, expect, it } from "vitest";
import { anomalyScore, averagePathLength, fitIsolationForest } from "./isolation-forest";
import { mulberry32 } from "./random";

/** Gaussian noise from a seeded generator (Box–Muller). */
function gaussRows(n: number, d: number, seed: number): number[][] {
  const r = mulberry32(seed);
  const g = () => Math.sqrt(-2 * Math.log(r() || 1e-12)) * Math.cos(2 * Math.PI * r());
  return Array.from({ length: n }, () => Array.from({ length: d }, g));
}

describe("averagePathLength", () => {
  it("matches the definition c(n) = 2H(n−1) − 2(n−1)/n", () => {
    expect(averagePathLength(1)).toBe(0);
    expect(averagePathLength(2)).toBe(1);
    // c(256) ≈ 10.24 (value commonly quoted for ψ = 256)
    expect(averagePathLength(256)).toBeCloseTo(10.24, 1);
  });
});

describe("Isolation Forest", () => {
  const normal = gaussRows(300, 5, 1);

  it("scores a far outlier higher than typical points", () => {
    const f = fitIsolationForest(normal, { seed: 7 });
    const typical = anomalyScore(f, [0, 0, 0, 0, 0]);
    const outlier = anomalyScore(f, [6, -6, 5, 0, 0]);
    expect(outlier).toBeGreaterThan(0.6);
    expect(typical).toBeLessThan(0.5);
    expect(outlier).toBeGreaterThan(typical + 0.15);
  });

  it("ranks injected outliers at the top", () => {
    const rows = gaussRows(300, 5, 2);
    const injected = [10, 50, 90, 150, 210, 270];
    for (const i of injected) rows[i] = rows[i].map((v, k) => (k < 2 ? v + 6 : v));
    const f = fitIsolationForest(rows, { seed: 3 });
    const ranked = rows.map((r, i) => ({ i, s: anomalyScore(f, r) })).sort((a, b) => b.s - a.s);
    const top = new Set(ranked.slice(0, 15).map((x) => x.i));
    expect(injected.filter((i) => top.has(i)).length).toBeGreaterThanOrEqual(5);
  });

  it("is deterministic for a seed", () => {
    const a = fitIsolationForest(normal, { seed: 11 });
    const b = fitIsolationForest(normal, { seed: 11 });
    expect(anomalyScore(a, [3, 3, 0, 0, 0])).toBe(anomalyScore(b, [3, 3, 0, 0, 0]));
  });

  it("handles constant features and small samples", () => {
    const rows = gaussRows(20, 3, 5).map((r) => [...r, 1]);
    const f = fitIsolationForest(rows, { seed: 1 });
    expect(f.sampleSize).toBe(20);
    const s = anomalyScore(f, [0, 0, 0, 1]);
    expect(s).toBeGreaterThan(0);
    expect(s).toBeLessThanOrEqual(1);
  });

  it("rejects bad input", () => {
    expect(() => fitIsolationForest([[1, 2]])).toThrow();
    expect(() => fitIsolationForest([[1, 2], [1, Number.NaN]])).toThrow();
    const f = fitIsolationForest(normal);
    expect(() => anomalyScore(f, [1, 2])).toThrow();
  });
});
