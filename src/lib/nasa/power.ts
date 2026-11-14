export type DailyPoint = {
  date: string;
  t2m: number | null;
  precip: number | null;
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
};

const BASE = "https://power.larc.nasa.gov/api/temporal/daily/point";

function clean(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) && v > -990 ? v : null;
}

function fmtDate(key: string): string {
  return `${key.slice(0, 4)}-${key.slice(4, 6)}-${key.slice(6, 8)}`;
}

function summarize(points: DailyPoint[]): PowerSummary {
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
  url.searchParams.set("parameters", "T2M,PRECTOTCORR");
  url.searchParams.set("community", "AG");
  url.searchParams.set("latitude", String(args.lat));
  url.searchParams.set("longitude", String(args.lng));
  url.searchParams.set("start", args.start);
  url.searchParams.set("end", args.end);
  url.searchParams.set("format", "JSON");

  const res = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(25000),
  });
  if (!res.ok) {
    throw new Error(`NASA POWER responded with status ${res.status}`);
  }

  const json = await res.json();
  const t2m = json?.properties?.parameter?.T2M as
    | Record<string, number>
    | undefined;
  const prec = json?.properties?.parameter?.PRECTOTCORR as
    | Record<string, number>
    | undefined;

  if (!t2m || !prec) {
    throw new Error("NASA POWER response did not contain the expected data");
  }

  const points: DailyPoint[] = Object.keys(t2m)
    .sort()
    .map((key) => ({
      date: fmtDate(key),
      t2m: clean(t2m[key]),
      precip: clean(prec[key]),
    }));

  return { points, summary: summarize(points) };
}