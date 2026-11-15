import { describe, expect, it } from "vitest";
import { FEATURE_KEYS, featureTable, type FeatureTable } from "@/lib/features/monthly";
import { syntheticDaily } from "@/lib/testing/synthetic";
import realFixture from "./__fixtures__/monthly-features-39n-33e.json";
import { detectAnomalies, explain, featureMatrix } from "./anomaly";
import { mulberry32 } from "./random";

// Synthetic weather (NOT real data) for 30 years, used to test behaviour.
const synthetic = () => featureTable(syntheticDaily({ years: 30, startYear: 1996, seed: 4 }), 39, 1000);

/** Pushes chosen months far from normal on 2–3 features at once. */
function inject(table: FeatureTable, count: number, seed: number): Set<string> {
  const rand = mulberry32(seed);
  const picked = new Set<string>();
  while (picked.size < count) {
    const r = table.rows[Math.floor(rand() * table.rows.length)];
    if (picked.has(r.ym)) continue;
    picked.add(r.ym);
    const sign = rand() < 0.5 ? -1 : 1;
    // A dry, hot month: less rain, more demand, drier soil.
    r.z.precipMm = -3.5 * sign;
    r.z.et0Mm = 3 * sign;
    r.z.gwetRoot = -3 * sign;
  }
  return picked;
}

describe("detectAnomalies", () => {
  it("refuses to run on short records", () => {
    const short = featureTable(syntheticDaily({ years: 6 }), 39, 1000);
    const r = detectAnomalies(short);
    expect(r.status).toBe("insufficient-data");
  });

  it("flags about 5 % of months and labels the method", () => {
    const r = detectAnomalies(synthetic());
    expect(r.status).toBe("ok");
    if (r.status !== "ok") return;
    expect(r.method).toBe("ml-unsupervised");
    expect(r.flagged.length).toBeGreaterThanOrEqual(Math.floor(0.05 * r.months.length));
    expect(r.flagged.length).toBeLessThanOrEqual(Math.ceil(0.05 * r.months.length) + 2);
    expect(r.model.trainedOn.features).toEqual([...FEATURE_KEYS]);
  });

  it("explains a flagged month by its strongest features", () => {
    expect(
      explain([
        { feature: "precipMm", z: -3, text: "much drier than usual" },
        { feature: "tmean", z: 2, text: "warmer than usual" },
      ]),
    ).toBe("Much drier than usual, warmer than usual.");
    expect(explain([])).toMatch(/unusual combination/);
  });

  it("replaces missing z-scores with 0 (the usual value)", () => {
    const { matrix } = featureMatrix(synthetic());
    expect(matrix.every((row) => row.every((v) => Number.isFinite(v)))).toBe(true);
  });
});

describe("evaluation on synthetic injected anomalies", () => {
  // Recall@5%: share of 10 injected months that land in the flagged 5 %.
  const recalls = [11, 12, 13, 14, 15].map((seed) => {
    const table = synthetic();
    const injected = inject(table, 10, seed);
    const r = detectAnomalies(table, { seed });
    if (r.status !== "ok") throw new Error("expected ok");
    const flagged = new Set(r.flagged.map((m) => m.ym));
    return [...injected].filter((ym) => flagged.has(ym)).length / injected.size;
  });

  it("finds most injected months (mean recall@5% ≥ 0.8)", () => {
    const mean = recalls.reduce((a, b) => a + b, 0) / recalls.length;
    console.info(`[eval] recall@5% per run: ${recalls.join(", ")}; mean ${mean.toFixed(2)}`);
    expect(mean).toBeGreaterThanOrEqual(0.8);
  });

  it("gives stable flags across seeds (mean Jaccard ≥ 0.6)", () => {
    const table = synthetic();
    const sets = [1, 2, 3, 4, 5].map((seed) => {
      const r = detectAnomalies(table, { seed });
      if (r.status !== "ok") throw new Error("expected ok");
      return new Set(r.flagged.map((m) => m.ym));
    });
    const pairs: number[] = [];
    for (let i = 0; i < sets.length; i++)
      for (let j = i + 1; j < sets.length; j++) {
        const inter = [...sets[i]].filter((x) => sets[j].has(x)).length;
        pairs.push(inter / (sets[i].size + sets[j].size - inter));
      }
    const mean = pairs.reduce((a, b) => a + b, 0) / pairs.length;
    console.info(`[eval] seed stability (Jaccard) mean ${mean.toFixed(2)}, min ${Math.min(...pairs).toFixed(2)}`);
    expect(mean).toBeGreaterThanOrEqual(0.6);
  });

  it("does at least as well as a simple max-|z| rule on combined anomalies", () => {
    const table = synthetic();
    const injected = inject(table, 10, 99);
    const r = detectAnomalies(table, { seed: 99 });
    if (r.status !== "ok") throw new Error("expected ok");
    const k = r.flagged.length;
    const { rows, matrix } = featureMatrix(table);
    const baseline = new Set(
      rows
        .map((row, i) => ({ ym: row.ym, s: Math.max(...matrix[i].map(Math.abs)) }))
        .sort((a, b) => b.s - a.s)
        .slice(0, k)
        .map((x) => x.ym),
    );
    const forest = new Set(r.flagged.map((m) => m.ym));
    const hit = (s: Set<string>) => [...injected].filter((ym) => s.has(ym)).length;
    console.info(`[eval] injected found — forest ${hit(forest)}/10, max-|z| ${hit(baseline)}/10`);
    expect(hit(forest)).toBeGreaterThanOrEqual(hit(baseline) - 1);
  });

  it("finds moderate combined anomalies that a max-|z| rule misses", () => {
    // Each of 5 features is only 2 SD off, so no single value stands out,
    // but the combination is rare. This is where Isolation Forest adds value.
    let forestHits = 0;
    let baselineHits = 0;
    for (const seed of [21, 22, 23, 24, 25]) {
      const table = synthetic();
      const rand = mulberry32(seed);
      const injected = new Set<string>();
      while (injected.size < 10) {
        const r = table.rows[Math.floor(rand() * table.rows.length)];
        if (injected.has(r.ym)) continue;
        injected.add(r.ym);
        Object.assign(r.z, { precipMm: -2, et0Mm: 2, gwetRoot: -2, tmean: 2, balanceMm: -2 });
      }
      const res = detectAnomalies(table, { seed });
      if (res.status !== "ok") throw new Error("expected ok");
      const { rows, matrix } = featureMatrix(table);
      const baseline = new Set(
        rows
          .map((row, i) => ({ ym: row.ym, s: Math.max(...matrix[i].map(Math.abs)) }))
          .sort((a, b) => b.s - a.s)
          .slice(0, res.flagged.length)
          .map((x) => x.ym),
      );
      const forest = new Set(res.flagged.map((m) => m.ym));
      forestHits += [...injected].filter((ym) => forest.has(ym)).length;
      baselineHits += [...injected].filter((ym) => baseline.has(ym)).length;
    }
    console.info(`[eval] moderate combined anomalies — forest ${forestHits}/50, max-|z| ${baselineHits}/50`);
    expect(forestHits).toBeGreaterThanOrEqual(20);
    expect(forestHits).toBeGreaterThan(3 * baselineHits);
  });

  it("fits and scores 30 years quickly", () => {
    const table = synthetic();
    const t0 = performance.now();
    detectAnomalies(table);
    const ms = performance.now() - t0;
    console.info(`[eval] fit + score 30 years: ${ms.toFixed(1)} ms (Node)`);
    expect(ms).toBeLessThan(500);
  });
});

describe("real NASA POWER record (lat 39, lon 33)", () => {
  // Real data saved from /api/nasa-power/monthly on 2026-11-15. Used for a
  // plausibility check only; there are no labels to measure accuracy against.
  const table = realFixture as unknown as FeatureTable;
  const r = detectAnomalies(table);

  it("runs on the full 30-year record", () => {
    expect(r.status).toBe("ok");
    if (r.status !== "ok") return;
    expect(r.model.trainedOn.months).toBe(360);
    expect(r.flagged.length).toBe(18);
  });

  it("explains every flagged month", () => {
    if (r.status !== "ok") return;
    for (const m of r.flagged) expect(m.summary.length).toBeGreaterThan(10);
    console.info(
      "[eval] flagged months (real data):\n" +
        r.flagged.map((m) => `  ${m.ym}  score ${m.score.toFixed(3)}  ${m.summary}`).join("\n"),
    );
  });
});
