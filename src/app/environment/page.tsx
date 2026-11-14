"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
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
import PageHeader from "@/components/ui/PageHeader";
import type { DailyPoint, PowerSummary } from "@/lib/nasa/power";
import { rangeFor } from "@/lib/nasa/range";
import { useFarm } from "@/lib/storage/use-farm";

type ApiData = {
  source: string;
  start: string;
  end: string;
  retrievedAt: string;
  points: DailyPoint[];
  summary: PowerSummary;
};

type Result = { key: string; data?: ApiData; error?: string };

const RANGES = [
  { years: 1, label: "Last 1 year" },
  { years: 2, label: "Last 2 years" },
  { years: 3, label: "Last 3 years" },
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
      <div className="mt-2 font-display text-5xl leading-none">
        {value}
        <span className="ml-1 text-lg opacity-70">{unit}</span>
      </div>
    </div>
  );
}

export default function Page() {
  const { farm, ready } = useFarm();
  const [years, setYears] = useState(1);
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

  const tick = { fontSize: 12, fill: "#7a6352" };

  return (
    <>
      <PageHeader
        eyebrow="NASA POWER"
        title={
          <>
            Your <em className="text-terracotta">climate</em>
          </>
        }
        description="Daily temperature and precipitation for your farm location, straight from NASA POWER."
      />

      {ready && !farm && (
        <div className="rounded-[28px] border border-line bg-paper p-8">
          <p className="text-lg">
            Save your farm profile first so we know where to look.
          </p>
          <Link
            href="/farm"
            className="mt-5 inline-block rounded-full bg-terracotta px-6 py-3 text-sm font-semibold text-paper hover:bg-terracotta-dark"
          >
            Go to Farm profile
          </Link>
        </div>
      )}

      {farm && (
        <>
          <div className="mb-6 flex flex-wrap items-center gap-2">
            <span className="mr-2 text-sm text-muted">
              {farm.name} at {farm.latitude.toFixed(3)},{" "}
              {farm.longitude.toFixed(3)}
            </span>
            {RANGES.map((r) => (
              <button
                key={r.years}
                onClick={() => setYears(r.years)}
                className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${
                  years === r.years
                    ? "border-espresso bg-espresso text-paper"
                    : "border-line bg-paper text-muted hover:border-espresso hover:text-espresso"
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
            <div className="rounded-[24px] border border-terracotta/40 bg-paper p-6">
              <p className="font-medium text-terracotta">
                Could not load NASA POWER data
              </p>
              <p className="mt-1 text-sm text-muted">{current?.error}</p>
              <button
                onClick={() => setAttempt((a) => a + 1)}
                className="mt-4 rounded-full border border-espresso px-4 py-1.5 text-sm hover:bg-espresso hover:text-paper"
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
                  tone="bg-terracotta text-paper"
                />
                <Stat
                  title="Daily mean range"
                  value={`${fmt(data.summary.minTemp, 0)} to ${fmt(data.summary.maxTemp, 0)}`}
                  unit="°C"
                  tone="bg-sand"
                />
                <Stat
                  title="Total precipitation"
                  value={fmt(data.summary.totalPrecip, 0)}
                  unit="mm"
                  tone="bg-sage"
                />
                <Stat
                  title="Days with 1 mm or more"
                  value={String(data.summary.rainyDays)}
                  unit="days"
                  tone="bg-espresso text-paper"
                />
              </div>

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
                      <CartesianGrid stroke="#e6d8c3" vertical={false} />
                      <XAxis dataKey="date" tick={tick} minTickGap={48} />
                      <YAxis tick={tick} unit="°" width={40} />
                      <Tooltip />
                      <Line
                        type="monotone"
                        dataKey="t2m"
                        name="Temperature (°C)"
                        stroke="#b8481f"
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
                      <CartesianGrid stroke="#e6d8c3" vertical={false} />
                      <XAxis dataKey="date" tick={tick} minTickGap={48} />
                      <YAxis tick={tick} width={40} />
                      <Tooltip />
                      <Bar
                        dataKey="precip"
                        name="Precipitation (mm)"
                        fill="#55612f"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>

              <section className="rounded-[28px] border border-line bg-sand/60 p-6 text-sm text-muted">
                <h3 className="mb-2 font-medium text-espresso">
                  Data source and limitations
                </h3>
                <ul className="list-disc space-y-1 pl-5">
                  <li>Source: {data.source}. A NASA product.</li>
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
            </div>
          )}
        </>
      )}
    </>
  );
}
