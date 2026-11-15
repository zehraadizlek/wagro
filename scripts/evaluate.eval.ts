/**
 * Reproducible evaluation of the ML, statistics and optimization components.
 * Run with `npm run evaluate`; it rewrites docs/ml/evaluation.md.
 *
 * Synthetic weather is used only to test behaviour where no labels exist.
 * It is clearly marked and never used to train anything in the app.
 */
import { writeFileSync } from "node:fs";
import { it } from "vitest";
import { featureTable, type FeatureTable } from "@/lib/features/monthly";
import { checkCalendar, phenology } from "@/lib/features/phenology";
import type { NdviPoint } from "@/lib/features/ndvi";
import ndviFixture from "@/lib/features/__fixtures__/ndvi-39n-33e.json";
import realMonthly from "@/lib/ml/__fixtures__/monthly-features-39n-33e.json";
import { detectAnomalies, featureMatrix } from "@/lib/ml/anomaly";
import { mulberry32 } from "@/lib/ml/random";
import { computeIndicators } from "@/lib/nasa/indicators";
import { lastYearSummary } from "@/lib/nasa/scenario";
import { CROP_PARAMS } from "@/lib/rotation/crops";
import { evaluateStrategies } from "@/lib/rotation/engine";
import { optimizeRotation } from "@/lib/rotation/optimize";
import { scoringContext } from "@/lib/rotation/score";
import type { FarmProfile, Priority } from "@/lib/schemas/farm";
import { syntheticDaily } from "@/lib/testing/synthetic";

const f2 = (x: number) => x.toFixed(2);
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

// ---------- anomaly detection ----------

const syntheticTable = () => featureTable(syntheticDaily({ years: 30, startYear: 1996, seed: 4 }), 39, 1000);

function injectRun(seed: number, set: Record<string, number>) {
  const table = syntheticTable();
  const rand = mulberry32(seed);
  const injected = new Set<string>();
  while (injected.size < 10) {
    const r = table.rows[Math.floor(rand() * table.rows.length)];
    if (injected.has(r.ym)) continue;
    injected.add(r.ym);
    Object.assign(r.z, set);
  }
  const res = detectAnomalies(table, { seed });
  if (res.status !== "ok") throw new Error("anomaly run failed");
  const k = res.flagged.length;
  const { rows, matrix } = featureMatrix(table);
  const baseline = new Set(
    rows
      .map((row, i) => ({ ym: row.ym, s: Math.max(...matrix[i].map(Math.abs)) }))
      .sort((a, b) => b.s - a.s)
      .slice(0, k)
      .map((x) => x.ym),
  );
  const forest = new Set(res.flagged.map((m) => m.ym));
  const hits = (s: Set<string>) => [...injected].filter((ym) => s.has(ym)).length;
  return { forest: hits(forest), baseline: hits(baseline), flagged: k };
}

function anomalySection(): string {
  const scenarios: [string, Record<string, number>][] = [
    ["Strong: rain −3.5, ET0 +3, soil wetness −3 SD", { precipMm: -3.5, et0Mm: 3, gwetRoot: -3 }],
    ["Moderate combined: 5 features at ±2.3 SD", { precipMm: -2.3, et0Mm: 2.3, gwetRoot: -2.3, tmean: 2.3, balanceMm: -2.3 }],
    ["Moderate combined: 5 features at ±2.0 SD", { precipMm: -2, et0Mm: 2, gwetRoot: -2, tmean: 2, balanceMm: -2 }],
    ["Weak combined: 5 features at ±1.5 SD", { precipMm: -1.5, et0Mm: 1.5, gwetRoot: -1.5, tmean: 1.5, balanceMm: -1.5 }],
  ];
  const seeds = [21, 22, 23, 24, 25];
  const rows = scenarios.map(([name, set]) => {
    const runs = seeds.map((s) => injectRun(s, set));
    const f = runs.reduce((a, r) => a + r.forest, 0);
    const b = runs.reduce((a, r) => a + r.baseline, 0);
    const flagged = runs[0].flagged;
    return `| ${name} | ${f}/50 (recall ${f2(f / 50)}, precision ${f2(f / (flagged * 5))}) | ${b}/50 |`;
  });

  const table = syntheticTable();
  const sets = [1, 2, 3, 4, 5].map((seed) => {
    const r = detectAnomalies(table, { seed });
    if (r.status !== "ok") throw new Error("anomaly run failed");
    return new Set(r.flagged.map((m) => m.ym));
  });
  const jac: number[] = [];
  for (let i = 0; i < sets.length; i++)
    for (let j = i + 1; j < sets.length; j++) {
      const inter = [...sets[i]].filter((x) => sets[j].has(x)).length;
      jac.push(inter / (sets[i].size + sets[j].size - inter));
    }

  const t0 = performance.now();
  for (let i = 0; i < 10; i++) detectAnomalies(table, { seed: i });
  const ms = (performance.now() - t0) / 10;

  const real = detectAnomalies(realMonthly as unknown as FeatureTable);
  const realRows =
    real.status === "ok"
      ? [...real.flagged]
          .sort((a, b) => b.score - a.score)
          .map((m) => `| ${m.ym} | ${m.score.toFixed(3)} | ${m.summary} |`)
          .join("\n")
      : "_insufficient data_";

  return `## 1. Unusual-month detection (Isolation Forest, ML unsupervised)

No labels exist, so accuracy cannot be measured. Injection tests check that
the method finds planted anomalies. 10 months are planted per run, 5 runs per
scenario, 360 synthetic months each; the model flags the top 5 % (18 months).
"Precision" is the share of flagged months that were planted. It cannot
exceed 10/18 = 0.56, because 18 months are always flagged and only 10 are
planted; the rest are the naturally most unusual synthetic months.

| Planted anomaly | Isolation Forest | Max-\\|z\\| rule (same number flagged) |
|---|---|---|
${rows.join("\n")}

- Stability across 5 seeds (Jaccard of flagged months): mean **${f2(mean(jac))}**, min ${f2(Math.min(...jac))}.
- Fit + score of 360 months: **${ms.toFixed(1)} ms** (Node ${process.version}).

**Reading:** both methods find single large deviations. Isolation Forest adds
value for months where several features are moderately off at once, which a
single-threshold rule misses. Weak combined anomalies (±1.5 SD) are mostly
not separable from normal variation by either method.

### Real record, lat 39.0, lon 33.0 (360 months, 1996-11 to 2026-10)
Plausibility only. "Unusual" includes wet as well as dry months.

| Month | Score | Main drivers |
|---|---|---|
${realRows}
`;
}

// ---------- optimizer ----------

function optimizerSection(): string {
  const points = syntheticDaily({ years: 10 });
  const summary = lastYearSummary(points, "2026-01-01T00:00:00Z");
  const indicators = computeIndicators(points, 39, 1000);
  const base: FarmProfile = {
    name: "Eval", latitude: 39, longitude: 33, areaHa: 20, currentCrop: "wheat",
    previousCrops: ["wheat", "barley"], irrigation: "none", soilType: "loamy", soilPh: 7.2,
    priorities: [], marketCrops: [], hasRowPlanter: true, coverCropsOk: true,
  };
  const prioritySets: Priority[][] = [
    [], ["water-efficiency"], ["soil-health"], ["extra-income", "animal-feed"],
    ["erosion-control"], ["nitrogen-management", "crop-diversity"],
  ];
  const variants: FarmProfile[] = [];
  for (const priorities of prioritySets)
    for (const irrigation of ["none", "full"] as const)
      for (const coverCropsOk of [true, false])
        for (const currentCrop of ["wheat", "corn", "chickpea"] as const)
          variants.push({ ...base, priorities, irrigation, coverCropsOk, currentCrop });

  let atLeast = 0;
  let violations = 0;
  const gains: number[] = [];
  for (const farm of variants) {
    const ctx = scoringContext(farm, summary, indicators, { meanSlopePct: 4 });
    const opt = optimizeRotation(farm, ctx);
    const hand = evaluateStrategies(farm, summary, indicators, { meanSlopePct: 4 }, { optimize: false });
    const bestHand = Math.max(...hand.filter((s) => s.id !== "current").map((s) => s.overall));
    const best = opt.options[0];
    if (!best) continue;
    if (best.overall >= bestHand) atLeast++;
    gains.push(best.overall - bestHand);
    for (const o of opt.options) {
      for (let i = 0; i < o.sequence.length; i++) {
        if (CROP_PARAMS[o.sequence[i]].family === CROP_PARAMS[o.sequence[(i + 1) % o.sequence.length]].family) violations++;
      }
      if (!farm.coverCropsOk && o.coverCrops) violations++;
      if (o.sequence[0] === farm.currentCrop) violations++;
    }
  }

  const ctx = scoringContext(base, summary, indicators, { meanSlopePct: 4 });
  const time = (seasons: 3 | 4) => {
    const t0 = performance.now();
    const r = optimizeRotation(base, ctx, { seasons });
    return { r, ms: performance.now() - t0 };
  };
  const t3 = time(3);
  const t4 = time(4);

  return `## 2. Rotation optimization (exhaustive search, Optimization — not ML)

Synthetic 10-year weather; ${variants.length} farm variants
(6 priority sets × irrigation none/full × cover crops yes/no × current crop wheat/corn/chickpea).

- Best searched option scores at least as high as the best hand-built strategy in **${atLeast} of ${variants.length}** variants; mean gain **${f2(mean(gains))}** points, max ${Math.max(...gains)}.
- Constraint violations in returned options (same family back to back, cover crops when refused, repeating the current crop first): **${violations}**.
- 3 seasons: ${t3.r.evaluated} candidates, Pareto front ${t3.r.paretoSize}, ${t3.ms.toFixed(1)} ms. 4 seasons: ${t4.r.evaluated} candidates, front ${t4.r.paretoSize}, ${t4.ms.toFixed(1)} ms (Node ${process.version}).

**Reading:** the gain is measured on the same rule-based criteria the search
optimizes, so it shows the search works, not that the rotations are better in
the field. The rules and crop values remain prototype estimates.
`;
}

// ---------- phenology ----------

function phenologySection(): string {
  const { points } = ndviFixture as { points: NdviPoint[] };
  const p = phenology(points);
  const rows = p.years
    .map((y) => `| ${y.year} | ${y.greenFromYearStart ? "green from January" : y.greenUpMonth ?? "–"} | ${y.peakMonth} | ${y.declineMonth ?? "–"} | ${y.peakNdvi} | ${y.amplitude} |`)
    .join("\n");
  const check = checkCalendar(p, "wheat", 39);
  return `## 3. Plant-cover seasons (NDVI phenology, Statistics)

Real MODIS NDVI at lat 39, lon 33, decoded from NASA GIBS (36 months; 2025-04 missing in GIBS).

| Year | Green-up month | Peak month | Fade month | Peak NDVI | Range |
|---|---|---|---|---|---|
${rows}

- Typical peak: month ${p.typical?.peakMonth}; calendar for winter wheat expects month ${check?.expectedPeak} → ${check?.agrees ? "**agrees**" : "**differs**"}.
- No ground truth for season timing exists here, so this is a consistency check, not an accuracy measure.
`;
}

it("writes docs/ml/evaluation.md", () => {
  const md = `# WAGRO — Evaluation results

Generated by \`npm run evaluate\` on ${new Date().toISOString().slice(0, 10)}. Do not edit by hand.

Crop suitability / yield prediction is **not evaluated: no model exists** (no
verified training labels; see dataset-audit.md).

${anomalySection()}
${optimizerSection()}
${phenologySection()}`;
  writeFileSync(new URL("../docs/ml/evaluation.md", import.meta.url), md);
  console.info(md);
});
