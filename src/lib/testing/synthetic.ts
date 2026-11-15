import type { DailyPoint } from "@/lib/nasa/power";

/**
 * Deterministic synthetic weather for tests only. It is NOT real data and must
 * never be used as model training data. It roughly mimics a semi-arid,
 * northern-hemisphere continental climate so the code paths run realistically.
 */

/** Small seeded generator (mulberry32) so tests are repeatable. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type SyntheticOptions = {
  startYear?: number;
  years?: number;
  /** Mean annual temperature, °C. */
  meanTemp?: number;
  /** Half of the summer–winter temperature swing, °C. */
  amplitude?: number;
  /** Rain on a wet day, mm. */
  wetDayRain?: number;
  /** Warming per year, °C (for trend tests). */
  warmingPerYear?: number;
  seed?: number;
};

export function syntheticDaily(opts: SyntheticOptions = {}): DailyPoint[] {
  const {
    startYear = 2000,
    years = 10,
    meanTemp = 12,
    amplitude = 12,
    wetDayRain = 6,
    warmingPerYear = 0,
    seed = 1,
  } = opts;
  const rand = seeded(seed);
  const out: DailyPoint[] = [];
  const start = Date.UTC(startYear, 0, 1);
  const end = Date.UTC(startYear + years, 0, 1);
  for (let t = start; t < end; t += 86400000) {
    const d = new Date(t);
    const doy = (t - Date.UTC(d.getUTCFullYear(), 0, 1)) / 86400000 + 1;
    const yearIndex = d.getUTCFullYear() - startYear;
    // Coldest around mid-January, warmest around mid-July.
    const season = -Math.cos((2 * Math.PI * (doy - 15)) / 365);
    const t2m = meanTemp + amplitude * season + warmingPerYear * yearIndex + (rand() - 0.5) * 4;
    // Wetter in winter, dry in summer.
    const wetChance = 0.12 + 0.18 * -season;
    const precip = rand() < wetChance ? wetDayRain * (0.5 + rand()) : 0;
    out.push({
      date: d.toISOString().slice(0, 10),
      t2m,
      tmax: t2m + 7,
      tmin: t2m - 7,
      precip,
      rh: 60 - 15 * season,
      wind: 2.5,
      solar: 15 + 10 * season,
      gwetTop: 0.5 - 0.15 * season,
      gwetRoot: 0.55 - 0.1 * season,
    });
  }
  return out;
}
