"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import GrowingConditions from "@/components/climate/GrowingConditions";
import Glossary from "@/components/ui/Glossary";
import PageHeader from "@/components/ui/PageHeader";
import { computeIndicators } from "@/lib/nasa/indicators";
import type { DailyPoint, PowerSummary } from "@/lib/nasa/power";
import { rangeFor } from "@/lib/nasa/range";
import { computeTrend } from "@/lib/nasa/trend";
import { useFarm } from "@/lib/storage/use-farm";

type ApiData = {
  source: string;
  start: string;
  end: string;
  retrievedAt: string;
  points: DailyPoint[];
  summary: PowerSummary;
  elevationM: number | null;
};

type Result = { key: string; data?: ApiData; error?: string };

const RANGES = [
  { years: 1, label: "1 year" },
  { years: 2, label: "2 years" },
  { years: 3, label: "3 years" },
  { years: 10, label: "10 years" },
];

const fmt = (v: number | null, digits = 1) =>
  v === null ? "n/a" : v.toFixed(digits);

function Stat({
  title,
  value,
  unit,
  tone,
}: {
  title: string;
  value: string;
  unit: string;
  tone: string;
}) {
  return (
    <div className={`rounded-[24px] p-5 ${tone}`}>
      <div className="text-xs font-medium uppercase tracking-[0.14em] opacity-70">
        {title}
      </div>
      <div className="mt-2 font-display text-4xl leading-none">
        {value}
        <span className="ml-1 text-lg opacity-70">{unit}</span>
      </div>
    </div>
  );
}

export default function Page() {
  const { farm, ready } = useFarm();
  const [years, setYears] = useState(10);
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<Result | null>(null);

  // Identifies the request that the current inputs would make.
  const key = farm
    ? `${farm.latitude}|${farm.longitude}|${years}|${attempt}`
    : "";

  useEffect(() => {
    if (!farm) return;
    const controller = new AbortController();
    const { start, end } = rangeFor(years);

    fetch(
      `/api/nasa-power?lat=${farm.latitude}&lng=${farm.longitude}&start=${start}&end=${end}`,
      { signal: controller.signal },
    )
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Request failed");
        setResult({ key, data: json as ApiData });
      })
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setResult({
          key,
          error: e instanceof Error ? e.message : "Something went wrong",
        });
      });

    return () => controller.abort();
  }, [farm, years, key]);

  const current = result && result.key === key ? result : null;
  const status = !farm
    ? "idle"
    : !current
      ? "loading"
      : current.error
        ? "error"
        : "done";
  const data = current?.data ?? null;

  const trend = useMemo(
    () => (data && data.points.length >= 365 * 8 ? computeTrend(data.points) : null),
    [data],
  );

  const indicators = useMemo(
    () =>
      data && farm
        ? computeIndicators(data.points, farm.latitude, data.elevationM)
        : null,
    [data, farm],
  );

  // Number of years the loaded data spans, used to show per-year values.
  const yearsCovered = data ? Math.max(1, data.summary.days / 365.25) : 1;

  const tick = { fontSize: 12, fill: "#6b665c" };

  return (
    <>
      <PageHeader
        eyebrow="NASA POWER"
        title={
          <>
            Your <em className="text-accent">climate</em>
          </>
        }
        description="Temperature, rain, evaporation, frost, heat and soil wetness for your farm location, from NASA POWER."
      />

      {ready && !farm && (
        <div className="rounded-[28px] border border-line bg-paper p-8">
          <p className="text-lg">
            Save your farm profile first so we know where to look.
          </p>
          <Link
            href="/farm"
            className="btn btn-primary mt-5"
          >
            Go to Farm profile
          </Link>
        </div>
      )}

      {farm && (
        <>
          <p className="mb-3 text-sm text-muted">
            {farm.name} · {farm.latitude.toFixed(3)}, {farm.longitude.toFixed(3)}
          </p>
          <div className="mb-8 grid max-w-xl grid-cols-4 gap-1 rounded-full border border-line bg-paper p-1">
            {RANGES.map((r) => (
              <button
                key={r.years}
                onClick={() => setYears(r.years)}
                className={`h-10 rounded-full text-sm transition-colors ${
                  years === r.years
                    ? "bg-sage font-medium text-espresso"
                    : "text-muted hover:text-espresso"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          {status === "loading" && (
            <div className="space-y-4">
              <div className="h-28 animate-pulse rounded-[24px] bg-sand" />
              <div className="h-72 animate-pulse rounded-[24px] bg-sand" />
            </div>
          )}

          {status === "error" && (
            <div className="rounded-[24px] border border-clay/40 bg-paper p-6">
              <p className="font-medium text-clay">
                Could not load NASA POWER data
              </p>
              <p className="mt-1 text-sm text-muted">{current?.error}</p>
              <button
                onClick={() => setAttempt((a) => a + 1)}
                className="btn btn-ghost mt-4"
              >
                Try again
              </button>
            </div>
          )}

          {status === "done" && data && (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-4">
                <Stat
                  title="Mean temperature"
                  value={fmt(data.summary.meanTemp)}
                  unit="°C"
                  tone="border border-line bg-paper"
                />
                <Stat
                  title="Coldest to warmest day"
                  value={`${fmt(data.summary.minTemp, 0)} to ${fmt(data.summary.maxTemp, 0)}`}
                  unit="°C"
                  tone="border border-line bg-paper"
                />
                <Stat
                  title={years > 1 ? "Precipitation per year" : "Total precipitation"}
                  value={fmt(
                    data.summary.totalPrecip === null
                      ? null
                      : data.summary.totalPrecip / yearsCovered,
                    0,
                  )}
                  unit="mm"
                  tone="border border-line bg-paper"
                />
                <Stat
                  title={years > 1 ? "Rainy days per year" : "Rainy days"}
                  value={String(Math.round(data.summary.rainyDays / yearsCovered))}
                  unit="days"
                  tone="border border-line bg-paper"
                />
              </div>

              {indicators && <GrowingConditions ind={indicators} />}

              <section className="rounded-[28px] border border-line bg-paper p-6">
                <h2 className="font-display text-3xl">
                  Daily temperature (T2M)
                </h2>
                <p className="mb-4 text-sm text-muted">
                  Mean air temperature at 2 m, in °C. Gaps mean no data.
                </p>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data.points}>
                      <CartesianGrid stroke="#e4ded2" vertical={false} />
                      <XAxis dataKey="date" tick={tick} minTickGap={48} />
                      <YAxis tick={tick} unit="°" width={40} />
                      <Tooltip />
                      <Line
                        type="monotone"
                        dataKey="t2m"
                        name="Temperature (°C)"
                        stroke="#8b7355"
                        strokeWidth={2}
                        dot={false}
                        connectNulls={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </section>

              <section className="rounded-[28px] border border-line bg-paper p-6">
                <h2 className="font-display text-3xl">
                  Daily precipitation (PRECTOTCORR)
                </h2>
                <p className="mb-4 text-sm text-muted">
                  Bias-corrected precipitation, in mm per day.
                </p>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.points}>
                      <CartesianGrid stroke="#e4ded2" vertical={false} />
                      <XAxis dataKey="date" tick={tick} minTickGap={48} />
                      <YAxis tick={tick} width={40} />
                      <Tooltip />
                      <Bar
                        dataKey="precip"
                        name="Precipitation (mm)"
                        fill="#7d8f69"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>

              {trend && (
                <section className="rounded-[28px] border border-line bg-paper p-6">
                  <h2 className="font-display text-3xl">
                    How your climate has shifted
                  </h2>
                  <p className="mb-4 text-sm text-muted">
                    Each bar or point is one 12-month period, counted back from
                    the latest available day.
                  </p>
                  <div className="mb-5 grid gap-3 md:grid-cols-2">
                    <div className="rounded-2xl bg-sand p-4 text-sm">
                      {trend.tempText}
                    </div>
                    <div className="rounded-2xl bg-sage p-4 text-sm">
                      {trend.precipText}
                    </div>
                  </div>
                  <div className="grid gap-6 md:grid-cols-2">
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={trend.buckets}>
                          <CartesianGrid stroke="#e4ded2" vertical={false} />
                          <XAxis dataKey="label" tick={tick} />
                          <YAxis tick={tick} unit="°" width={40} domain={["auto", "auto"]} />
                          <Tooltip />
                          <Line
                            dataKey="meanTemp"
                            name="Mean temperature (°C)"
                            stroke="#8b7355"
                            strokeWidth={2}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={trend.buckets}>
                          <CartesianGrid stroke="#e4ded2" vertical={false} />
                          <XAxis dataKey="label" tick={tick} />
                          <YAxis tick={tick} width={44} />
                          <Tooltip />
                          <Bar
                            dataKey="precipMm"
                            name="Precipitation (mm per year)"
                            fill="#7d8f69"
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                  <p className="mt-4 text-xs text-muted">
                    This is a straight-line fit through about 10 yearly values.
                    It describes this location and period only. Natural
                    year-to-year swings are large, so treat it as an indication,
                    not proof of long-term climate change.
                  </p>
                </section>
              )}

              <section className="rounded-[28px] border border-line bg-sand/60 p-6 text-sm text-muted">
                <h3 className="mb-2 font-medium text-espresso">
                  Data source and limitations
                </h3>
                <ul className="list-disc space-y-1 pl-5">
                  <li>
                    Source: {data.source}. A NASA product built from the
                    MERRA-2 reanalysis and CERES satellite data.
                  </li>
                  <li>
                    Evapotranspiration (ET0) is calculated by Wagro with the
                    FAO-56 Penman-Monteith method from POWER temperature,
                    humidity, wind and radiation.
                  </li>
                  <li>
                    Period: {data.start} to {data.end}. Retrieved on{" "}
                    {new Date(data.retrievedAt).toLocaleString()}.
                  </li>
                  <li>
                    POWER values are gridded estimates for the grid cell around
                    your pin, not measurements taken inside your field.
                  </li>
                  <li>
                    Missing days: {data.summary.missingTempDays} (temperature),{" "}
                    {data.summary.missingPrecipDays} (precipitation) out of{" "}
                    {data.summary.days}.
                  </li>
                  <li>
                    The most recent days are left out on purpose because POWER
                    publishes data with a delay of a few days.
                  </li>
                </ul>
              </section>

              <Glossary />
            </div>
          )}
        </>
      )}
    </>
  );
}
