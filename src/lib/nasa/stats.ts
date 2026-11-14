import type { DailyPoint } from "./power";
import { summarize } from "./power";
import type { ClimateSummary } from "./scenario";

/**
 * Simple, explainable statistics on the 10-year record:
 * - Mann-Kendall test: is there a steady rise or fall, or could it be chance?
 * - Sen's slope: how big the change is, robust to single odd years.
 * - k-means (k = 3) on yearly rain: groups years into dry, normal and wet.
 */

export type YearRecord = {
  /** First and last day of the 12-month period. */
  start: string;
  end: string;
  points: DailyPoint[];
  meanTemp: number | null;
  precipMm: number | null;
};

const MIN_VALID_DAYS = 300;

/** Consecutive 12-month periods counted back from the newest day. */
export function splitYears(points: DailyPoint[]): YearRecord[] {
  const out: YearRecord[] = [];
  const n = points.length;
  for (let b = Math.floor(n / 365) - 1; b >= 0; b--) {
    const hi = n - b * 365;
    const slice = points.slice(hi - 365, hi);
    const temps = slice.map((p) => p.t2m).filter((v): v is number => v !== null);
    const rains = slice.map((p) => p.precip).filter((v): v is number => v !== null);
    out.push({
      start: slice[0].date,
      end: slice[slice.length - 1].date,
      points: slice,
      meanTemp: temps.length >= MIN_VALID_DAYS ? temps.reduce((a, v) => a + v, 0) / temps.length : null,
      precipMm:
        rains.length >= MIN_VALID_DAYS ? (rains.reduce((a, v) => a + v, 0) / rains.length) * 365 : null,
    });
  }
  return out;
}

// ---------- trend tests ----------

export type TrendTest = {
  /** Sen's slope per decade (in the unit of the series). */
  perDecade: number;
  /** Two-sided p-value of the Mann-Kendall test. */
  p: number;
  /** p < 0.05: unlikely to be chance. */
  clear: boolean;
  n: number;
};

/** Standard normal cumulative distribution (Abramowitz–Stegun 26.2.17). */
function normCdf(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989422804014327 * Math.exp((-z * z) / 2);
  const p =
    d * t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return z > 0 ? 1 - p : p;
}

export function trendTest(values: (number | null)[]): TrendTest | null {
  const pts = values
    .map((v, i) => (v === null ? null : ([i, v] as const)))
    .filter((p): p is readonly [number, number] => p !== null);
  const n = pts.length;
  if (n < 8) return null;

  let s = 0;
  const slopes: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    for (let j = i + 1; j < n; j++) {
      const d = pts[j][1] - pts[i][1];
      s += Math.sign(d);
      slopes.push(d / (pts[j][0] - pts[i][0]));
    }
  }
  const variance = (n * (n - 1) * (2 * n + 5)) / 18;
  const z = s > 0 ? (s - 1) / Math.sqrt(variance) : s < 0 ? (s + 1) / Math.sqrt(variance) : 0;
  const p = 2 * (1 - normCdf(Math.abs(z)));

  slopes.sort((a, b) => a - b);
  const mid = Math.floor(slopes.length / 2);
  const sen = slopes.length % 2 ? slopes[mid] : (slopes[mid - 1] + slopes[mid]) / 2;

  return { perDecade: sen * 10, p, clear: p < 0.05, n };
}

// ---------- year types ----------

export type YearType = "dry" | "normal" | "wet";

export type YearGroups = {
  years: (YearRecord & { type: YearType })[];
  /** Average yearly rain of each group, mm. */
  centers: Record<YearType, number>;
};

/** k-means with k = 3 on yearly rain; starts from the driest, median and wettest year. */
export function groupYears(years: YearRecord[]): YearGroups | null {
  const valid = years.filter((y) => y.precipMm !== null);
  if (valid.length < 6) return null;
  const xs = valid.map((y) => y.precipMm!);
  const sorted = [...xs].sort((a, b) => a - b);
  let centers = [sorted[0], sorted[Math.floor(sorted.length / 2)], sorted[sorted.length - 1]];
  let assign: number[] = [];

  for (let iter = 0; iter < 50; iter++) {
    assign = xs.map((x) => {
      let best = 0;
      for (let k = 1; k < 3; k++) if (Math.abs(x - centers[k]) < Math.abs(x - centers[best])) best = k;
      return best;
    });
    const next = centers.map((c, k) => {
      const members = xs.filter((_, i) => assign[i] === k);
      return members.length ? members.reduce((a, v) => a + v, 0) / members.length : c;
    });
    if (next.every((c, k) => Math.abs(c - centers[k]) < 1e-6)) break;
    centers = next;
  }

  // Order clusters by rain so they can be named.
  const order = [0, 1, 2].sort((a, b) => centers[a] - centers[b]);
  const names: YearType[] = ["dry", "normal", "wet"];
  const nameOf = (k: number) => names[order.indexOf(k)];
  return {
    years: valid.map((y, i) => ({ ...y, type: nameOf(assign[i]) })),
    centers: {
      dry: centers[order[0]],
      normal: centers[order[1]],
      wet: centers[order[2]],
    },
  };
}

/** Climate summary over several years together (rain scaled to one year). */
export function pooledSummary(points: DailyPoint[], retrievedAt: string): ClimateSummary {
  const s = summarize(points);
  const precipDays = s.days - s.missingPrecipDays;
  return {
    meanTemp: s.meanTemp,
    annualPrecipMm:
      s.totalPrecip === null || precipDays <= 0 ? null : (s.totalPrecip / precipDays) * 365,
    days: s.days,
    missingDays: Math.max(s.missingTempDays, s.missingPrecipDays),
    start: points[0]?.date ?? "",
    end: points[points.length - 1]?.date ?? "",
    retrievedAt,
  };
}
