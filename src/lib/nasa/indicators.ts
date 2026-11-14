import type { DailyPoint } from "./power";

/**
 * Agro-climate indicators derived from NASA POWER daily data.
 * Every value here is computed from gridded estimates for the cell around the
 * farm pin, so it describes the general area, not one field.
 */

export const HEAT_THRESHOLDS = [30, 32, 35] as const;
export type HeatThreshold = (typeof HEAT_THRESHOLDS)[number];

/** Days with at least this much rain count as heavy-rain days. */
export const HEAVY_RAIN_MM = 20;
/** Minimum temperature below this counts as a frost day. */
export const FROST_C = 0;
/** Minimum temperature below this counts as a hard frost day. */
export const HARD_FROST_C = -5;

export type MonthClimate = {
  /** 1 = January. */
  month: number;
  label: string;
  tmean: number | null;
  tmax: number | null;
  tmin: number | null;
  /** Typical precipitation in this month, mm. */
  precipMm: number | null;
  /** Typical reference evapotranspiration (FAO-56) in this month, mm. */
  et0Mm: number | null;
  /** precipMm minus et0Mm. Negative means the air demands more water than falls. */
  balanceMm: number | null;
  /** Typical number of days with minimum temperature below 0 °C. */
  frostDays: number | null;
  hardFrostDays: number | null;
  /** Typical number of days with maximum temperature at or above each threshold. */
  heatDays: Record<HeatThreshold, number | null>;
  heavyRainDays: number | null;
  /** Mean surface soil wetness, 0 to 1. */
  gwetTop: number | null;
  /** Mean root-zone soil wetness, 0 to 1. */
  gwetRoot: number | null;
};

export type FrostDates = {
  /** Typical (median) day of year of the last frost before summer. */
  lastSpringDoy: number | null;
  /** Latest last-spring frost seen in the record. */
  latestSpringDoy: number | null;
  /** Typical (median) day of year of the first frost after summer. */
  firstAutumnDoy: number | null;
  /** Earliest first-autumn frost seen in the record. */
  earliestAutumnDoy: number | null;
  /** Typical frost-free season length, days. */
  frostFreeDays: number | null;
  yearsChecked: number;
  yearsWithFrost: number;
};

export type SoilMoistureAnomaly = {
  /** Mean root-zone wetness over the last 30 days. */
  recent: number;
  /** Mean root-zone wetness over the same 30 calendar days in other years. */
  usual: number;
  /** (recent - usual) / usual, in percent. */
  pct: number;
  baselineYears: number;
};

export type AridityClass =
  | "hyper-arid"
  | "arid"
  | "semi-arid"
  | "dry sub-humid"
  | "humid";

export type AgroIndicators = {
  /** Number of years the climatology is based on (can be fractional). */
  years: number;
  months: MonthClimate[];
  annual: {
    precipMm: number | null;
    et0Mm: number | null;
    /** Precipitation divided by reference evapotranspiration. */
    aridityIndex: number | null;
    aridityClass: AridityClass | null;
    frostDays: number | null;
    hardFrostDays: number | null;
    heatDays35: number | null;
    heavyRainDays: number | null;
    /** Months where rain covers less than half of the evaporative demand. */
    dryMonths: number[];
  };
  frost: FrostDates;
  soilMoisture: SoilMoistureAnomaly | null;
  /** Share of days (0 to 1) where ET0 used the simpler temperature-only method. */
  et0FallbackShare: number;
};

export const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const DAYS_IN_MONTH = [31, 28.25, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

// ---------- dates ----------

function parts(date: string) {
  return {
    y: Number(date.slice(0, 4)),
    m: Number(date.slice(5, 7)),
    d: Number(date.slice(8, 10)),
  };
}

function dayOfYear(date: string): number {
  const { y, m, d } = parts(date);
  return (Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 1)) / 86400000 + 1;
}

/** Formats a day of year as "23 Mar" (non-leap calendar). */
export function doyLabel(doy: number): string {
  const d = new Date(Date.UTC(2001, 0, Math.round(doy)));
  return `${d.getUTCDate()} ${MONTH_LABELS[d.getUTCMonth()]}`;
}

function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

const mean = (xs: number[]) =>
  xs.length ? xs.reduce((a, v) => a + v, 0) / xs.length : null;

// ---------- reference evapotranspiration (FAO-56) ----------

const satVp = (t: number) => 0.6108 * Math.exp((17.27 * t) / (t + 237.3));

/** Extraterrestrial radiation, MJ/m²/day (FAO-56 eq. 21). */
function extraterrestrialRadiation(latDeg: number, doy: number): number {
  const phi = (latDeg * Math.PI) / 180;
  const dr = 1 + 0.033 * Math.cos((2 * Math.PI * doy) / 365);
  const decl = 0.409 * Math.sin((2 * Math.PI * doy) / 365 - 1.39);
  const ws = Math.acos(Math.max(-1, Math.min(1, -Math.tan(phi) * Math.tan(decl))));
  return (
    ((24 * 60) / Math.PI) *
    0.082 *
    dr *
    (ws * Math.sin(phi) * Math.sin(decl) +
      Math.cos(phi) * Math.cos(decl) * Math.sin(ws))
  );
}

/**
 * Daily reference evapotranspiration in mm. Uses FAO-56 Penman-Monteith when
 * humidity, wind and radiation are available, otherwise Hargreaves.
 */
export function referenceEt0(
  p: DailyPoint,
  latDeg: number,
  elevationM: number,
): { et0: number | null; fallback: boolean } {
  if (p.tmax === null || p.tmin === null) return { et0: null, fallback: false };
  const doy = dayOfYear(p.date);
  const ra = extraterrestrialRadiation(latDeg, doy);
  const tmean = (p.tmax + p.tmin) / 2;

  if (p.rh === null || p.wind === null || p.solar === null) {
    const range = Math.max(0, p.tmax - p.tmin);
    const et0 = 0.0023 * (tmean + 17.8) * Math.sqrt(range) * 0.408 * ra;
    return { et0: Math.max(0, et0), fallback: true };
  }

  const pressure = 101.3 * ((293 - 0.0065 * elevationM) / 293) ** 5.26;
  const gamma = 0.000665 * pressure;
  const delta = (4098 * satVp(tmean)) / (tmean + 237.3) ** 2;
  const es = (satVp(p.tmax) + satVp(p.tmin)) / 2;
  const ea = (Math.min(100, Math.max(0, p.rh)) / 100) * es;

  const rso = (0.75 + 2e-5 * elevationM) * ra;
  const rns = 0.77 * p.solar;
  const ratio = rso > 0 ? Math.min(1, p.solar / rso) : 0.5;
  const sigma = 4.903e-9;
  const tk4 = ((p.tmax + 273.16) ** 4 + (p.tmin + 273.16) ** 4) / 2;
  const rnl =
    sigma * tk4 * (0.34 - 0.14 * Math.sqrt(ea)) * (1.35 * ratio - 0.35);
  const rn = rns - rnl;
  const u2 = Math.max(0, p.wind);

  const et0 =
    (0.408 * delta * rn + gamma * (900 / (tmean + 273)) * u2 * (es - ea)) /
    (delta + gamma * (1 + 0.34 * u2));
  return { et0: Math.max(0, et0), fallback: false };
}

// ---------- climatology ----------

type Acc = { sum: number; n: number };
const acc = (): Acc => ({ sum: 0, n: 0 });
const add = (a: Acc, v: number | null) => {
  if (v !== null) {
    a.sum += v;
    a.n += 1;
  }
};
const avgOf = (a: Acc) => (a.n ? a.sum / a.n : null);

function monthlyClimate(
  points: DailyPoint[],
  et0: (number | null)[],
): MonthClimate[] {
  const buckets = Array.from({ length: 12 }, () => ({
    t: acc(), tx: acc(), tn: acc(), p: acc(), e: acc(),
    frost: acc(), hard: acc(), heavy: acc(), top: acc(), root: acc(),
    heat: { 30: acc(), 32: acc(), 35: acc() } as Record<HeatThreshold, Acc>,
  }));

  points.forEach((pt, i) => {
    const b = buckets[parts(pt.date).m - 1];
    add(b.t, pt.t2m);
    add(b.tx, pt.tmax);
    add(b.tn, pt.tmin);
    add(b.p, pt.precip);
    add(b.e, et0[i]);
    add(b.top, pt.gwetTop);
    add(b.root, pt.gwetRoot);
    if (pt.tmin !== null) {
      add(b.frost, pt.tmin < FROST_C ? 1 : 0);
      add(b.hard, pt.tmin < HARD_FROST_C ? 1 : 0);
    }
    if (pt.precip !== null) add(b.heavy, pt.precip >= HEAVY_RAIN_MM ? 1 : 0);
    if (pt.tmax !== null) {
      for (const th of HEAT_THRESHOLDS) add(b.heat[th], pt.tmax >= th ? 1 : 0);
    }
  });

  return buckets.map((b, i) => {
    const dim = DAYS_IN_MONTH[i];
    const perMonth = (a: Acc) => {
      const v = avgOf(a);
      return v === null ? null : v * dim;
    };
    const precipMm = perMonth(b.p);
    const et0Mm = perMonth(b.e);
    return {
      month: i + 1,
      label: MONTH_LABELS[i],
      tmean: avgOf(b.t),
      tmax: avgOf(b.tx),
      tmin: avgOf(b.tn),
      precipMm,
      et0Mm,
      balanceMm:
        precipMm === null || et0Mm === null ? null : precipMm - et0Mm,
      frostDays: perMonth(b.frost),
      hardFrostDays: perMonth(b.hard),
      heatDays: {
        30: perMonth(b.heat[30]),
        32: perMonth(b.heat[32]),
        35: perMonth(b.heat[35]),
      },
      heavyRainDays: perMonth(b.heavy),
      gwetTop: avgOf(b.top),
      gwetRoot: avgOf(b.root),
    };
  });
}

function sumMonths(
  months: MonthClimate[],
  pick: (m: MonthClimate) => number | null,
): number | null {
  const vals = months.map(pick);
  return vals.every((v) => v !== null)
    ? (vals as number[]).reduce((a, v) => a + v, 0)
    : null;
}

function aridityClass(ai: number): AridityClass {
  if (ai < 0.05) return "hyper-arid";
  if (ai < 0.2) return "arid";
  if (ai < 0.5) return "semi-arid";
  if (ai < 0.65) return "dry sub-humid";
  return "humid";
}

// ---------- frost dates ----------

/**
 * For each year, finds the last frost of the cool-season's end ("spring") and
 * the first frost of the next cool season ("autumn"). In the southern
 * hemisphere the halves of the year are swapped.
 */
function frostDates(points: DailyPoint[], latDeg: number): FrostDates {
  const south = latDeg < 0;
  const byYear = new Map<number, DailyPoint[]>();
  for (const p of points) {
    const y = parts(p.date).y;
    if (!byYear.has(y)) byYear.set(y, []);
    byYear.get(y)!.push(p);
  }

  const springHalf = (m: number) => (south ? m >= 7 : m <= 6);
  const springs: number[] = [];
  const autumns: number[] = [];
  let yearsChecked = 0;
  let yearsWithFrost = 0;

  for (const days of byYear.values()) {
    const spring = days.filter((p) => springHalf(parts(p.date).m) && p.tmin !== null);
    const autumn = days.filter((p) => !springHalf(parts(p.date).m) && p.tmin !== null);
    // Only judge halves that are almost complete.
    const springOk = spring.length >= 170;
    const autumnOk = autumn.length >= 170;
    if (!springOk && !autumnOk) continue;
    yearsChecked += 1;
    let frosty = false;

    if (springOk) {
      const frosts = spring.filter((p) => p.tmin! < FROST_C);
      if (frosts.length) {
        frosty = true;
        springs.push(dayOfYear(frosts[frosts.length - 1].date));
      }
    }
    if (autumnOk) {
      const frosts = autumn.filter((p) => p.tmin! < FROST_C);
      if (frosts.length) {
        frosty = true;
        autumns.push(dayOfYear(frosts[0].date));
      }
    }
    if (frosty) yearsWithFrost += 1;
  }

  const lastSpringDoy = median(springs);
  const firstAutumnDoy = median(autumns);
  return {
    lastSpringDoy,
    latestSpringDoy: springs.length ? Math.max(...springs) : null,
    firstAutumnDoy,
    earliestAutumnDoy: autumns.length ? Math.min(...autumns) : null,
    frostFreeDays:
      lastSpringDoy === null || firstAutumnDoy === null
        ? null
        : Math.round((firstAutumnDoy - lastSpringDoy + 365) % 365),
    yearsChecked,
    yearsWithFrost,
  };
}

// ---------- soil moisture anomaly ----------

function soilMoistureAnomaly(points: DailyPoint[]): SoilMoistureAnomaly | null {
  const recentPts = points.slice(-30).filter((p) => p.gwetRoot !== null);
  if (recentPts.length < 20) return null;
  const recent = mean(recentPts.map((p) => p.gwetRoot!))!;

  const lastYear = parts(points[points.length - 1].date).y;
  const doys = new Set(points.slice(-30).map((p) => dayOfYear(p.date)));
  const earlier = points.slice(0, -30);

  const baseline: number[] = [];
  const years = new Set<number>();
  for (const p of earlier) {
    if (p.gwetRoot === null || !doys.has(dayOfYear(p.date))) continue;
    // Skip the stretch right before the recent window in the same year.
    const y = parts(p.date).y;
    if (y === lastYear) continue;
    baseline.push(p.gwetRoot);
    years.add(y);
  }
  if (years.size < 2) return null;
  const usual = mean(baseline)!;
  if (usual <= 0) return null;
  return {
    recent,
    usual,
    pct: ((recent - usual) / usual) * 100,
    baselineYears: years.size,
  };
}

// ---------- entry point ----------

export function computeIndicators(
  points: DailyPoint[],
  latDeg: number,
  elevationM: number | null,
): AgroIndicators {
  let fallbackDays = 0;
  const et0 = points.map((p) => {
    const r = referenceEt0(p, latDeg, elevationM ?? 0);
    if (r.fallback) fallbackDays += 1;
    return r.et0;
  });

  const months = monthlyClimate(points, et0);
  const precipMm = sumMonths(months, (m) => m.precipMm);
  const et0Mm = sumMonths(months, (m) => m.et0Mm);
  const aridityIndex =
    precipMm !== null && et0Mm !== null && et0Mm > 0 ? precipMm / et0Mm : null;

  return {
    years: points.length / 365.25,
    months,
    annual: {
      precipMm,
      et0Mm,
      aridityIndex,
      aridityClass: aridityIndex === null ? null : aridityClass(aridityIndex),
      frostDays: sumMonths(months, (m) => m.frostDays),
      hardFrostDays: sumMonths(months, (m) => m.hardFrostDays),
      heatDays35: sumMonths(months, (m) => m.heatDays[35]),
      heavyRainDays: sumMonths(months, (m) => m.heavyRainDays),
      dryMonths: months
        .filter(
          (m) =>
            m.precipMm !== null &&
            m.et0Mm !== null &&
            m.et0Mm >= 30 &&
            m.precipMm < 0.5 * m.et0Mm,
        )
        .map((m) => m.month),
    },
    frost: frostDates(points, latDeg),
    soilMoisture: soilMoistureAnomaly(points),
    et0FallbackShare: points.length ? fallbackDays / points.length : 0,
  };
}
