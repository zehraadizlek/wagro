import { FEATURE_KEYS, type FeatureKey, type FeatureTable } from "@/lib/features/monthly";
import { anomalyScore, fitIsolationForest } from "./isolation-forest";

/**
 * Environmental anomaly detection for one location.
 *
 * What it does: learns what a normal month looks like at this location from
 * its own 20–30-year record of monthly anomalies (z-scores), and flags the
 * months whose combination is most unusual.
 *
 * What it does NOT do: it does not detect crop disease, pests or confirmed
 * crop damage, and it does not forecast. A flagged month is a prompt to look
 * closer, nothing more.
 *
 * Method label: ML (unsupervised).
 */

export const ANOMALY_METHOD = "ml-unsupervised" as const;
export const ANOMALY_MODEL_VERSION = "anomaly-iforest-1";

export type AnomalyOptions = {
  /** Share of months flagged (default 0.05 = the most unusual 5 %). */
  contamination?: number;
  trees?: number;
  seed?: number;
  /** Minimum months of record to run at all (default 120 = 10 years). */
  minMonths?: number;
};

export type Driver = { feature: FeatureKey; z: number; text: string };

export type MonthAnomaly = {
  ym: string;
  score: number;
  flagged: boolean;
  /** Features with |z| ≥ 1.5, strongest first. */
  drivers: Driver[];
  /** Plain-language reason. */
  summary: string;
};

export type AnomalyResult =
  | {
      status: "ok";
      method: typeof ANOMALY_METHOD;
      model: {
        version: string;
        trees: number;
        sampleSize: number;
        seed: number;
        contamination: number;
        threshold: number;
        trainedOn: { months: number; start: string; end: string; features: FeatureKey[] };
      };
      months: MonthAnomaly[];
      flagged: MonthAnomaly[];
    }
  | { status: "insufficient-data"; method: typeof ANOMALY_METHOD; months: number; needed: number };

const DRIVER_Z = 1.5;

/** [above usual, below usual, word used when strong (|z| ≥ 2.5)] */
const DIRECTION: Record<FeatureKey, [string, string, string]> = {
  tmean: ["warmer", "colder", "much"],
  precipMm: ["wetter", "drier", "much"],
  et0Mm: ["higher water demand", "lower water demand", "much"],
  balanceMm: ["more water left after evaporation", "less water left after evaporation", "much"],
  gwetRoot: ["wetter soil", "drier soil", "much"],
  hotDays: ["more hot days", "fewer hot days", "far"],
  frostNights: ["more frost nights", "fewer frost nights", "far"],
};

function describe(feature: FeatureKey, z: number): string {
  const [up, down, strong] = DIRECTION[feature];
  return `${Math.abs(z) >= 2.5 ? `${strong} ` : ""}${z > 0 ? up : down} than usual`;
}

/** Turns the drivers of one month into a short sentence. */
export function explain(drivers: Driver[]): string {
  if (!drivers.length) return "An unusual combination, without one standout factor.";
  return drivers
    .slice(0, 3)
    .map((d) => d.text)
    .join(", ")
    .replace(/^./, (c) => c.toUpperCase()) + ".";
}

/**
 * Builds the feature matrix. Missing z-scores become 0 (= the usual value):
 * they are missing because a feature never varies in that calendar month
 * (for example no frost in July), so "usual" is the honest reading.
 * Months with no z-scores at all are skipped.
 */
export function featureMatrix(table: FeatureTable, keys: readonly FeatureKey[] = FEATURE_KEYS) {
  const rows = table.rows.filter((r) => keys.some((k) => r.z[k] !== null));
  return {
    rows,
    matrix: rows.map((r) => keys.map((k) => r.z[k] ?? 0)),
  };
}

export function detectAnomalies(table: FeatureTable, opts: AnomalyOptions = {}): AnomalyResult {
  const contamination = opts.contamination ?? 0.05;
  const seed = opts.seed ?? 42;
  const trees = opts.trees ?? 100;
  const needed = opts.minMonths ?? 120;
  const { rows, matrix } = featureMatrix(table);
  if (rows.length < needed) {
    return { status: "insufficient-data", method: ANOMALY_METHOD, months: rows.length, needed };
  }

  const forest = fitIsolationForest(matrix, { trees, seed });
  const scores = matrix.map((x) => anomalyScore(forest, x));
  const sorted = [...scores].sort((a, b) => b - a);
  const k = Math.max(1, Math.round(contamination * scores.length));
  const threshold = sorted[k - 1];

  const months: MonthAnomaly[] = rows.map((r, i) => {
    const drivers: Driver[] = FEATURE_KEYS.map((f) => ({ f, z: r.z[f] }))
      .filter((d): d is { f: FeatureKey; z: number } => d.z !== null && Math.abs(d.z) >= DRIVER_Z)
      .sort((a, b) => Math.abs(b.z) - Math.abs(a.z))
      .map((d) => ({ feature: d.f, z: d.z, text: describe(d.f, d.z) }));
    return {
      ym: r.ym,
      score: Math.round(scores[i] * 1000) / 1000,
      flagged: scores[i] >= threshold,
      drivers,
      summary: explain(drivers),
    };
  });

  return {
    status: "ok",
    method: ANOMALY_METHOD,
    model: {
      version: ANOMALY_MODEL_VERSION,
      trees,
      sampleSize: forest.sampleSize,
      seed,
      contamination,
      threshold: Math.round(threshold * 1000) / 1000,
      trainedOn: {
        months: rows.length,
        start: rows[0].ym,
        end: rows[rows.length - 1].ym,
        features: [...FEATURE_KEYS],
      },
    },
    months,
    flagged: months.filter((m) => m.flagged),
  };
}
