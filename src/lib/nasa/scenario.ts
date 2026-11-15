import { computeIndicators, type AgroIndicators } from "./indicators";
import { summarize, type DailyPoint } from "./power";
import { splitYears } from "./stats";

/**
 * "What if" scenarios using the delta method: every day of the historical
 * record is shifted by the same amount (temperature) or scaled by the same
 * factor (rain). It keeps the real day-to-day pattern of the last years and
 * only changes the level. It is a sensitivity test, not a forecast.
 */

export type Scenario = {
  /** Change in air temperature, °C. */
  tempC: number;
  /** Change in rain, as a fraction (-0.2 = 20% less). */
  rain: number;
};

export const NO_CHANGE: Scenario = { tempC: 0, rain: 0 };

export const SCENARIO_NOTE =
  "Every day of the last 10 years is shifted by the same amount. This is a stress test, not a forecast.";

export type ClimateSummary = {
  meanTemp: number | null;
  /** Total precipitation scaled to a full year, using only days with data. */
  annualPrecipMm: number | null;
  days: number;
  missingDays: number;
  start: string;
  end: string;
  retrievedAt: string;
  /** Complete 12-month periods behind the values (climatology only). */
  years?: number;
};

/** Fewest complete years accepted for a long-term climate summary. */
export const MIN_CLIMATOLOGY_YEARS = 5;

/**
 * Long-term climate for the scoring engine: the mean temperature and the
 * mean yearly rain over every complete 12-month period in the record
 * (normally 10). A period counts for a value only when it has at least 300
 * days of that value. With fewer than MIN_CLIMATOLOGY_YEARS usable periods
 * the value is null and the engine leaves it out; nothing is filled in.
 */
export function climatologySummary(points: DailyPoint[], retrievedAt: string): ClimateSummary {
  const years = splitYears(points);
  const mean = (xs: (number | null)[]) => {
    const v = xs.filter((x): x is number => x !== null);
    return v.length >= MIN_CLIMATOLOGY_YEARS ? v.reduce((a, b) => a + b, 0) / v.length : null;
  };
  const used = points.slice(points.length - years.length * 365);
  const s = summarize(used);
  return {
    meanTemp: mean(years.map((y) => y.meanTemp)),
    annualPrecipMm: mean(years.map((y) => y.precipMm)),
    days: s.days,
    missingDays: Math.max(s.missingTempDays, s.missingPrecipDays),
    start: used[0]?.date ?? "",
    end: used[used.length - 1]?.date ?? "",
    retrievedAt,
    years: years.length,
  };
}

/** Summary of the last 12 months: recent-year context, not used for scoring. */
export function lastYearSummary(points: DailyPoint[], retrievedAt: string): ClimateSummary {
  const lastYear = points.slice(-365);
  const s = summarize(lastYear);
  const precipDays = s.days - s.missingPrecipDays;
  return {
    meanTemp: s.meanTemp,
    annualPrecipMm:
      s.totalPrecip === null || precipDays <= 0
        ? null
        : (s.totalPrecip / precipDays) * 365,
    days: s.days,
    missingDays: Math.max(s.missingTempDays, s.missingPrecipDays),
    start: lastYear[0]?.date ?? "",
    end: lastYear[lastYear.length - 1]?.date ?? "",
    retrievedAt,
  };
}

export function isNoChange(s: Scenario): boolean {
  return s.tempC === 0 && s.rain === 0;
}

export function applyScenario(points: DailyPoint[], s: Scenario): DailyPoint[] {
  if (isNoChange(s)) return points;
  const shift = (v: number | null) => (v === null ? null : v + s.tempC);
  const scale = (v: number | null) => (v === null ? null : Math.max(0, v * (1 + s.rain)));
  return points.map((p) => ({
    ...p,
    t2m: shift(p.t2m),
    tmax: shift(p.tmax),
    tmin: shift(p.tmin),
    precip: scale(p.precip),
  }));
}

/** Summary and indicators for a scenario, from the same daily record. */
export function scenarioClimate(
  points: DailyPoint[],
  s: Scenario,
  latDeg: number,
  elevationM: number | null,
  retrievedAt: string,
): { climatology: ClimateSummary; indicators: AgroIndicators } {
  const shifted = applyScenario(points, s);
  return {
    climatology: climatologySummary(shifted, retrievedAt),
    indicators: computeIndicators(shifted, latDeg, elevationM),
  };
}
