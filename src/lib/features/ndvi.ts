import { GIBS_LAYERS, loadColormap, monthBefore, sampleLayer } from "@/lib/nasa/gibs";

/**
 * MODIS NDVI monthly series at a point, read from NASA GIBS tiles through the
 * published colormap (about 1 km footprint, steps of about 0.01).
 * Loading needs a browser (canvas); the statistics below are pure functions.
 */

export type NdviPoint = { month: string; ndvi: number | null };

/** NDVI below this usually means bare soil, stubble or snow. */
export const LOW_COVER_NDVI = 0.2;

const layer = () => GIBS_LAYERS.find((l) => l.id === "ndvi")!;

/** The last `months` months ending at the newest GIBS month, oldest first. */
export function ndviMonths(months: number): string[] {
  const l = layer();
  return Array.from({ length: months }, (_, i) => monthBefore(l.latest, months - 1 - i));
}

/**
 * Browser only. Fetches tiles 6 at a time. A month that comes back empty is
 * tried once more, because a single failed tile request would otherwise be
 * indistinguishable from a real data gap (such as 2025-04) and could change
 * the season summary. Months still empty after the retry stay null.
 */
export async function loadNdviSeries(
  lat: number,
  lng: number,
  months: number,
  signal: AbortSignal,
): Promise<NdviPoint[]> {
  const l = layer();
  const colormap = await loadColormap(l.colormap, signal);
  const list = ndviMonths(months);
  const out: NdviPoint[] = list.map((month) => ({ month, ndvi: null }));
  let next = 0;
  async function worker() {
    while (next < list.length) {
      const i = next++;
      let v = await sampleLayer(l, colormap, list[i], lat, lng, signal);
      if (v === null) v = await sampleLayer(l, colormap, list[i], lat, lng, signal);
      out[i].ndvi = v;
    }
  }
  await Promise.all(Array.from({ length: 6 }, worker));
  return out;
}

/** Calendar months need at least this many years of values to be summarized. */
export const MIN_YEARS_PER_MONTH = 2;

/**
 * Mean NDVI per calendar month (index 0 = January). Null when fewer than
 * `minValues` years have data for that month, so one odd year cannot decide it.
 */
export function monthlyMeans(points: NdviPoint[], minValues = MIN_YEARS_PER_MONTH): (number | null)[] {
  const byMonth = Array.from({ length: 12 }, () => [] as number[]);
  for (const p of points) {
    if (p.ndvi !== null) byMonth[Number(p.month.slice(5)) - 1].push(p.ndvi);
  }
  return byMonth.map((v) => (v.length >= minValues ? v.reduce((a, b) => a + b, 0) / v.length : null));
}

/** Greenest calendar month (1–12), months with low plant cover, and how many months had no data. */
export function seasonSummary(points: NdviPoint[]): {
  peakMonth: number | null;
  lowMonths: number[];
  missing: number;
} {
  const avg = monthlyMeans(points);
  const valid = avg.filter((v): v is number => v !== null);
  return {
    peakMonth: valid.length ? avg.indexOf(Math.max(...valid)) + 1 : null,
    lowMonths: avg
      .map((v, i) => (v !== null && v < LOW_COVER_NDVI ? i + 1 : null))
      .filter((m): m is number => m !== null),
    missing: points.filter((p) => p.ndvi === null).length,
  };
}

/**
 * NDVI anomaly per month: z-score against the same calendar month in the
 * other years of the series. Null when fewer than 3 values exist for that
 * calendar month or the spread is zero.
 */
export function ndviAnomalies(points: NdviPoint[]): (NdviPoint & { z: number | null })[] {
  const byMonth = new Map<number, number[]>();
  for (const p of points) {
    if (p.ndvi === null) continue;
    const m = Number(p.month.slice(5));
    if (!byMonth.has(m)) byMonth.set(m, []);
    byMonth.get(m)!.push(p.ndvi);
  }
  return points.map((p) => {
    const vals = byMonth.get(Number(p.month.slice(5))) ?? [];
    if (p.ndvi === null || vals.length < 3) return { ...p, z: null };
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const sd = Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / (vals.length - 1));
    return { ...p, z: sd > 1e-9 ? Math.round(((p.ndvi - mean) / sd) * 100) / 100 : null };
  });
}
