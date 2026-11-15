import { CROP_PARAMS } from "@/lib/rotation/crops";
import type { Crop } from "@/lib/schemas/farm";
import { LOW_COVER_NDVI, type NdviPoint } from "./ndvi";

/**
 * Plant-cover seasons from the MODIS NDVI series (Statistics, not ML).
 *
 * For each calendar year with at least 10 months of data:
 * - peak: the greenest month;
 * - green-up: the first month before the peak where NDVI rises above
 *   min + 20 % of the year's range (amplitude);
 * - decline: the first month after the peak where NDVI falls below
 *   min + 50 % of the range.
 * These are the usual amplitude-threshold rules (as in tools such as
 * TIMESAT), applied to coarse monthly data, so timing is ± one month.
 *
 * It describes the land around the pin (~1 km). It cannot tell which crop
 * is growing.
 */

export const GREEN_UP_SHARE = 0.2;
export const DECLINE_SHARE = 0.5;
/** A year needs this much NDVI range to have a meaningful season. */
export const MIN_AMPLITUDE = 0.08;

export type SeasonYear = {
  year: number;
  peakMonth: number;
  /** Null when the land was already green at the start of the year (winter crops). */
  greenUpMonth: number | null;
  /** True when the green period runs back into January, so it began the year before. */
  greenFromYearStart: boolean;
  declineMonth: number | null;
  peakNdvi: number;
  amplitude: number;
};

export type Phenology = {
  years: SeasonYear[];
  /** Median over years, or null when no year qualified. */
  typical: {
    peakMonth: number;
    greenUpMonth: number | null;
    declineMonth: number | null;
    /** Most years were already green in January. */
    greenFromYearStart: boolean;
  } | null;
  /** Calendar months with mean NDVI below the low-cover threshold. */
  lowCoverMonths: number[];
};

const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
};

export function phenology(points: NdviPoint[]): Phenology {
  const byYear = new Map<number, (number | null)[]>();
  for (const p of points) {
    const y = Number(p.month.slice(0, 4));
    const m = Number(p.month.slice(5, 7));
    if (!byYear.has(y)) byYear.set(y, Array(12).fill(null));
    byYear.get(y)![m - 1] = p.ndvi;
  }

  const years: SeasonYear[] = [];
  for (const [year, vals] of [...byYear].sort(([a], [b]) => a - b)) {
    const valid = vals.filter((v): v is number => v !== null);
    if (valid.length < 10) continue;
    const min = Math.min(...valid);
    const max = Math.max(...valid);
    const amplitude = max - min;
    if (amplitude < MIN_AMPLITUDE) continue;
    const peakIdx = vals.indexOf(max);
    let greenUp: number | null = null;
    for (let i = peakIdx; i >= 0; i--) {
      const v = vals[i];
      if (v === null) continue;
      if (v > min + GREEN_UP_SHARE * amplitude) greenUp = i + 1;
      else break;
    }
    let decline: number | null = null;
    for (let i = peakIdx + 1; i < 12; i++) {
      const v = vals[i];
      if (v !== null && v < min + DECLINE_SHARE * amplitude) {
        decline = i + 1;
        break;
      }
    }
    // Reaching January means the season started the previous year; the
    // calendar-year window cannot see when, so no green-up month is given.
    const fromStart = greenUp === 1;
    years.push({
      year,
      peakMonth: peakIdx + 1,
      greenUpMonth: fromStart ? null : greenUp,
      greenFromYearStart: fromStart,
      declineMonth: decline,
      peakNdvi: Math.round(max * 100) / 100,
      amplitude: Math.round(amplitude * 100) / 100,
    });
  }

  const typicalPeak = median(years.map((y) => y.peakMonth));
  const means = Array.from({ length: 12 }, (_, m) => {
    const v = points
      .filter((p) => Number(p.month.slice(5, 7)) === m + 1 && p.ndvi !== null)
      .map((p) => p.ndvi!);
    return v.length >= 2 ? v.reduce((a, b) => a + b, 0) / v.length : null;
  });

  return {
    years,
    typical:
      typicalPeak === null
        ? null
        : {
            peakMonth: typicalPeak,
            greenUpMonth: median(years.map((y) => y.greenUpMonth).filter((m): m is number => m !== null)),
            declineMonth: median(years.map((y) => y.declineMonth).filter((m): m is number => m !== null)),
            greenFromYearStart: years.filter((y) => y.greenFromYearStart).length * 2 > years.length,
          },
    lowCoverMonths: means
      .map((v, i) => (v !== null && v < LOW_COVER_NDVI ? i + 1 : null))
      .filter((m): m is number => m !== null),
  };
}

/**
 * Month when the calendar assumes a crop is greenest: about two months before
 * harvest (flowering and grain fill). Shifted six months in the south.
 */
export function expectedPeakMonth(crop: Crop, latitude: number): number {
  const harvest = CROP_PARAMS[crop].calendar.harvestMonth;
  const north = ((harvest - 2 - 1 + 12) % 12) + 1;
  return latitude < 0 ? ((north - 1 + 6) % 12) + 1 : north;
}

export type CalendarCheck = {
  crop: Crop;
  expectedPeak: number;
  observedPeak: number;
  /** Months between them, −6 to +6 (positive: satellite peak is later). */
  offset: number;
  agrees: boolean;
};

/**
 * Compares the satellite's typical peak with the peak the calendar assumes for
 * the crop in the field now. Agreement within one month supports the
 * calendar; a larger gap means the local calendar (or the land around the
 * pin) differs and the timing advice should be checked locally.
 */
export function checkCalendar(p: Phenology, crop: Crop, latitude: number): CalendarCheck | null {
  if (!p.typical) return null;
  const expected = expectedPeakMonth(crop, latitude);
  let offset = p.typical.peakMonth - expected;
  if (offset > 6) offset -= 12;
  if (offset < -6) offset += 12;
  return { crop, expectedPeak: expected, observedPeak: p.typical.peakMonth, offset, agrees: Math.abs(offset) <= 1 };
}
