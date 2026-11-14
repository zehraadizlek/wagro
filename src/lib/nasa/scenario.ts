import { computeIndicators, type AgroIndicators } from "./indicators";
import { summarize, type DailyPoint } from "./power";

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
  "Scenarios shift every day of the last 10 years by the same amount (the delta method). Humidity, wind, sunshine and soil wetness stay as they were. This tests how sensitive each option is; it is not a forecast.";

export type ClimateSummary = {
  meanTemp: number | null;
  /** Total precipitation scaled to a full year, using only days with data. */
  annualPrecipMm: number | null;
  days: number;
  missingDays: number;
  start: string;
  end: string;
  retrievedAt: string;
};

/** Summary of the last 12 months, used by the scoring engine. */
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
): { summary: ClimateSummary; indicators: AgroIndicators } {
  const shifted = applyScenario(points, s);
  return {
    summary: lastYearSummary(shifted, retrievedAt),
    indicators: computeIndicators(shifted, latDeg, elevationM),
  };
}
