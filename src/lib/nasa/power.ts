export type DailyPoint = {
  date: string;
  /** Mean air temperature at 2 m, °C. */
  t2m: number | null;
  /** Daily maximum air temperature at 2 m, °C. */
  tmax: number | null;
  /** Daily minimum air temperature at 2 m, °C. */
  tmin: number | null;
  /** Bias-corrected precipitation, mm/day. */
  precip: number | null;
  /** Relative humidity at 2 m, %. */
  rh: number | null;
  /** Wind speed at 2 m, m/s. */
  wind: number | null;
  /** All-sky surface shortwave radiation, MJ/m²/day. */
  solar: number | null;
  /** Surface soil wetness, 0 (dry) to 1 (saturated). */
  gwetTop: number | null;
  /** Root-zone soil wetness, 0 (dry) to 1 (saturated). */
  gwetRoot: number | null;
};

export type PowerSummary = {
  days: number;
  missingTempDays: number;
  missingPrecipDays: number;
  meanTemp: number | null;
  minTemp: number | null;
  maxTemp: number | null;
  totalPrecip: number | null;
  rainyDays: number;
};

export type PowerData = {
  points: DailyPoint[];
  summary: PowerSummary;
  /** Grid-cell elevation reported by NASA POWER, in metres. */
  elevationM: number | null;
};

/** NASA POWER parameter code for each DailyPoint field. */
export const POWER_FIELDS = {
  t2m: "T2M",
  tmax: "T2M_MAX",
  tmin: "T2M_MIN",
  precip: "PRECTOTCORR",
  rh: "RH2M",
  wind: "WS2M",
  solar: "ALLSKY_SFC_SW_DWN",
  gwetTop: "GWETTOP",
  gwetRoot: "GWETROOT",
} as const satisfies Record<Exclude<keyof DailyPoint, "date">, string>;

export const POWER_PARAMS = Object.values(POWER_FIELDS);

const BASE = "https://power.larc.nasa.gov/api/temporal/daily/point";

function clean(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) && v > -990 ? v : null;
}

function fmtDate(key: string): string {
  return `${key.slice(0, 4)}-${key.slice(4, 6)}-${key.slice(6, 8)}`;
}

export function summarize(points: DailyPoint[]): PowerSummary {
  const temps = points.map((p) => p.t2m).filter((v): v is number => v !== null);
  const rains = points
    .map((p) => p.precip)
    .filter((v): v is number => v !== null);

  return {
    days: points.length,
    missingTempDays: points.length - temps.length,
    missingPrecipDays: points.length - rains.length,
    meanTemp: temps.length
      ? temps.reduce((a, b) => a + b, 0) / temps.length
      : null,
    minTemp: temps.length ? Math.min(...temps) : null,
    maxTemp: temps.length ? Math.max(...temps) : null,
    totalPrecip: rains.length ? rains.reduce((a, b) => a + b, 0) : null,
    rainyDays: rains.filter((v) => v >= 1).length,
  };
}

export async function fetchPower(args: {
  lat: number;
  lng: number;
  start: string;
  end: string;
}): Promise<PowerData> {
  const url = new URL(BASE);
  url.searchParams.set("parameters", POWER_PARAMS.join(","));
  url.searchParams.set("community", "AG");
  url.searchParams.set("latitude", String(args.lat));
  url.searchParams.set("longitude", String(args.lng));
  url.searchParams.set("start", args.start);
  url.searchParams.set("end", args.end);
  url.searchParams.set("format", "JSON");

  const res = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(45000),
  });
  if (!res.ok) {
    throw new Error(`NASA POWER responded with status ${res.status}`);
  }

  const json = await res.json();
  const param = json?.properties?.parameter as
    | Record<string, Record<string, number> | undefined>
    | undefined;
  const t2m = param?.T2M;
  const prec = param?.PRECTOTCORR;

  if (!param || !t2m || !prec) {
    throw new Error("NASA POWER response did not contain the expected data");
  }

  const series = (field: keyof typeof POWER_FIELDS, key: string) =>
    clean(param[POWER_FIELDS[field]]?.[key]);

  const points: DailyPoint[] = Object.keys(t2m)
    .sort()
    .map((key) => ({
      date: fmtDate(key),
      t2m: series("t2m", key),
      tmax: series("tmax", key),
      tmin: series("tmin", key),
      precip: series("precip", key),
      rh: series("rh", key),
      wind: series("wind", key),
      solar: series("solar", key),
      gwetTop: series("gwetTop", key),
      gwetRoot: series("gwetRoot", key),
    }));

  const elev = json?.geometry?.coordinates?.[2];

  return {
    points,
    summary: summarize(points),
    elevationM: typeof elev === "number" && Number.isFinite(elev) ? elev : null,
  };
}
