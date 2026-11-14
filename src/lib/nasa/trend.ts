import type { DailyPoint } from "./power";

export type YearBucket = {
  /** Last day of the 12-month period, YYYY-MM. */
  label: string;
  meanTemp: number | null;
  precipMm: number | null;
};

export type Trend = {
  buckets: YearBucket[];
  /** Change per decade from a straight-line fit, or null if too few periods. */
  tempPerDecade: number | null;
  /** Change per decade as a percentage of the average, or null. */
  precipPctPerDecade: number | null;
  tempText: string;
  precipText: string;
};

const MIN_VALID_DAYS = 300;
const MIN_PERIODS = 8;

function slope(ys: (number | null)[]): number | null {
  const pts = ys
    .map((y, x) => (y === null ? null : ([x, y] as const)))
    .filter((p): p is readonly [number, number] => p !== null);
  if (pts.length < MIN_PERIODS) return null;
  const n = pts.length;
  const mx = pts.reduce((a, p) => a + p[0], 0) / n;
  const my = pts.reduce((a, p) => a + p[1], 0) / n;
  const num = pts.reduce((a, p) => a + (p[0] - mx) * (p[1] - my), 0);
  const den = pts.reduce((a, p) => a + (p[0] - mx) ** 2, 0);
  return den === 0 ? null : num / den;
}

/**
 * Splits daily data into consecutive 12-month periods counted back from the
 * newest day, then fits a straight line through the period values.
 * A period is used only if it has at least 300 valid days.
 */
export function computeTrend(points: DailyPoint[]): Trend {
  const n = points.length;
  const periods = Math.floor(n / 365);
  const buckets: YearBucket[] = [];

  for (let b = periods - 1; b >= 0; b--) {
    const hi = n - b * 365;
    const slice = points.slice(hi - 365, hi);
    const temps = slice.map((p) => p.t2m).filter((v): v is number => v !== null);
    const rains = slice
      .map((p) => p.precip)
      .filter((v): v is number => v !== null);
    buckets.push({
      label: slice[slice.length - 1].date.slice(0, 7),
      meanTemp:
        temps.length >= MIN_VALID_DAYS
          ? temps.reduce((a, v) => a + v, 0) / temps.length
          : null,
      precipMm:
        rains.length >= MIN_VALID_DAYS
          ? (rains.reduce((a, v) => a + v, 0) / rains.length) * 365
          : null,
    });
  }

  const tSlope = slope(buckets.map((b) => b.meanTemp));
  const pSlope = slope(buckets.map((b) => b.precipMm));
  const pVals = buckets
    .map((b) => b.precipMm)
    .filter((v): v is number => v !== null);
  const pMean = pVals.length
    ? pVals.reduce((a, v) => a + v, 0) / pVals.length
    : null;

  const tempPerDecade = tSlope === null ? null : tSlope * 10;
  const precipPctPerDecade =
    pSlope === null || !pMean ? null : ((pSlope * 10) / pMean) * 100;

  const tempText =
    tempPerDecade === null
      ? "Not enough complete years to estimate a temperature trend. Choose the 10-year range."
      : Math.abs(tempPerDecade) < 0.2
        ? "Average temperature shows no clear change over this period."
        : `Average temperature moved ${tempPerDecade > 0 ? "up" : "down"} by about ${Math.abs(tempPerDecade).toFixed(1)} °C per decade in this period.`;

  const precipText =
    precipPctPerDecade === null
      ? "Not enough complete years to estimate a rainfall trend. Choose the 10-year range."
      : Math.abs(precipPctPerDecade) < 5
        ? "Yearly rainfall shows no clear change over this period."
        : `Yearly rainfall moved ${precipPctPerDecade > 0 ? "up" : "down"} by about ${Math.abs(precipPctPerDecade).toFixed(0)}% per decade in this period.`;

  return { buckets, tempPerDecade, precipPctPerDecade, tempText, precipText };
}
