import { referenceEt0 } from "@/lib/nasa/indicators";
import type { DailyPoint } from "@/lib/nasa/power";

/**
 * Monthly feature table for one location: one row per calendar month of the
 * record (not a climatology), plus standardized anomalies against the same
 * calendar month across all years. This is the input for anomaly detection.
 * Pure functions; safe on the server and in the browser.
 */

export const FEATURE_KEYS = [
  "tmean",
  "precipMm",
  "et0Mm",
  "balanceMm",
  "gwetRoot",
  "hotDays",
  "frostNights",
] as const;
export type FeatureKey = (typeof FEATURE_KEYS)[number];

export const FEATURE_LABELS: Record<FeatureKey, string> = {
  tmean: "temperature",
  precipMm: "rain",
  et0Mm: "water demand (ET0)",
  balanceMm: "water balance (rain − ET0)",
  gwetRoot: "root-zone soil wetness",
  hotDays: "hot days (32 °C or more)",
  frostNights: "frost nights",
};

/** Threshold for a hot day, °C (daily maximum). */
export const HOT_DAY_C = 32;
/** A month needs at least this many days with data to be used. */
export const MIN_DAYS = 25;

export type MonthRow = {
  /** YYYY-MM */
  ym: string;
  year: number;
  month: number;
  /** Days in the month that had temperature and rain data. */
  days: number;
  values: Record<FeatureKey, number | null>;
};

export type MonthStats = { mean: number; sd: number; n: number };

export type FeatureTable = {
  rows: (MonthRow & { z: Record<FeatureKey, number | null> })[];
  /** Per calendar month (index 0 = January) and feature. */
  climatology: Record<FeatureKey, MonthStats | null>[];
};

const round = (v: number | null, d = 2) => (v === null ? null : Math.round(v * 10 ** d) / 10 ** d);

/** Aggregates daily points into one row per year-month. */
export function monthlyRows(points: DailyPoint[], latDeg: number, elevationM: number | null): MonthRow[] {
  const groups = new Map<string, DailyPoint[]>();
  for (const p of points) {
    const ym = p.date.slice(0, 7);
    if (!groups.has(ym)) groups.set(ym, []);
    groups.get(ym)!.push(p);
  }

  const rows: MonthRow[] = [];
  for (const [ym, days] of [...groups].sort(([a], [b]) => a.localeCompare(b))) {
    const year = Number(ym.slice(0, 4));
    const month = Number(ym.slice(5, 7));
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const usable = days.filter((d) => d.t2m !== null && d.precip !== null);
    const ok = usable.length >= MIN_DAYS;

    const mean = (xs: (number | null)[]) => {
      const v = xs.filter((x): x is number => x !== null);
      return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
    };
    /** Monthly total, scaled up to the full month when a few days are missing. */
    const total = (xs: (number | null)[]) => {
      const v = xs.filter((x): x is number => x !== null);
      return v.length ? (v.reduce((a, b) => a + b, 0) / v.length) * daysInMonth : null;
    };
    const share = (pred: (d: DailyPoint) => boolean | null) => {
      const v = days.map(pred).filter((x): x is boolean => x !== null);
      return v.length ? (v.filter(Boolean).length / v.length) * daysInMonth : null;
    };

    const precipMm = ok ? total(days.map((d) => d.precip)) : null;
    const et0Mm = ok ? total(days.map((d) => referenceEt0(d, latDeg, elevationM ?? 0).et0)) : null;

    rows.push({
      ym,
      year,
      month,
      days: usable.length,
      values: {
        tmean: ok ? round(mean(days.map((d) => d.t2m))) : null,
        precipMm: round(precipMm, 1),
        et0Mm: round(et0Mm, 1),
        balanceMm: precipMm !== null && et0Mm !== null ? round(precipMm - et0Mm, 1) : null,
        gwetRoot: ok ? round(mean(days.map((d) => d.gwetRoot)), 3) : null,
        hotDays: ok ? round(share((d) => (d.tmax === null ? null : d.tmax >= HOT_DAY_C)), 1) : null,
        frostNights: ok ? round(share((d) => (d.tmin === null ? null : d.tmin < 0)), 1) : null,
      },
    });
  }
  return rows;
}

/**
 * Adds z-scores against the same calendar month across all years.
 * A z-score is null when fewer than 5 years exist for that month or the
 * spread is zero (for example no frost ever in July).
 */
export function withAnomalies(rows: MonthRow[]): FeatureTable {
  const climatology = Array.from({ length: 12 }, (_, m) => {
    const out = {} as Record<FeatureKey, MonthStats | null>;
    for (const k of FEATURE_KEYS) {
      const v = rows
        .filter((r) => r.month === m + 1)
        .map((r) => r.values[k])
        .filter((x): x is number => x !== null);
      if (v.length < 5) {
        out[k] = null;
        continue;
      }
      const mean = v.reduce((a, b) => a + b, 0) / v.length;
      const sd = Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / (v.length - 1));
      out[k] = { mean: round(mean, 3)!, sd: round(sd, 3)!, n: v.length };
    }
    return out;
  });

  return {
    climatology,
    rows: rows.map((r) => {
      const z = {} as Record<FeatureKey, number | null>;
      for (const k of FEATURE_KEYS) {
        const s = climatology[r.month - 1][k];
        const v = r.values[k];
        z[k] = s && v !== null && s.sd > 1e-9 ? round((v - s.mean) / s.sd, 2) : null;
      }
      return { ...r, z };
    }),
  };
}

export function featureTable(points: DailyPoint[], latDeg: number, elevationM: number | null): FeatureTable {
  return withAnomalies(monthlyRows(points, latDeg, elevationM));
}
