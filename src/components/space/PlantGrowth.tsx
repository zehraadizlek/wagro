"use client";

import { useEffect, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { MONTH_LABELS } from "@/lib/nasa/indicators";
import { loadNdviSeries, seasonSummary, type NdviPoint } from "@/lib/features/ndvi";

const MONTHS = 36;

type Point = NdviPoint;
type Result = { key: string; points?: Point[]; error?: string };

// Survives page switches, so the 36 tiles are fetched once per field.
const cache = new Map<string, Point[]>();

function monthList(ms: number[]): string {
  return ms.map((m) => MONTH_LABELS[m - 1]).join(", ");
}

/** What the satellite saw on and around the field over the last 3 years. */
export default function PlantGrowth({ lat, lng }: { lat: number; lng: number }) {
  const key = `${lat}|${lng}`;
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    if (cache.has(key)) return;
    const controller = new AbortController();
    loadNdviSeries(lat, lng, MONTHS, controller.signal)
      .then((points) => {
        cache.set(key, points);
        setResult({ key, points });
      })
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setResult({ key, error: "Satellite data could not be loaded." });
      });
    return () => controller.abort();
  }, [key, lat, lng]);

  const points = cache.get(key) ?? (result?.key === key ? result.points : undefined);
  const error = result?.key === key ? result.error : undefined;

  const { peakMonth: peak, lowMonths: bare, missing } = seasonSummary(points ?? []);

  const chart = points?.map((p) => ({
    label: `${MONTH_LABELS[Number(p.month.slice(5)) - 1]} ${p.month.slice(2, 4)}`,
    ndvi: p.ndvi === null ? null : Math.round(p.ndvi * 100) / 100,
  }));

  return (
    <section className="rounded-[28px] border border-line bg-paper p-6">
      <h2 className="font-display text-3xl">Plant cover on your field</h2>
      <p className="mt-1 text-sm text-muted">
        How green the land was each month, seen by NASA&apos;s MODIS satellite.
      </p>

      {!points && !error && (
        <div className="mt-4 h-48 animate-pulse rounded-2xl bg-sand" />
      )}
      {error && <p className="mt-4 text-sm text-clay">{error}</p>}

      {points && chart && (
        <>
          <ul className="mt-4 space-y-1 text-sm">
            {peak && <li>Greenest in {MONTH_LABELS[peak - 1]}.</li>}
            <li>
              {bare.length
                ? `Little plant cover in ${monthList(bare)} (bare soil, stubble or snow). That is when soil is most exposed.`
                : "Rarely looks bare: something is growing most of the year."}
            </li>
          </ul>
          <div className="mt-4 h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chart}>
                <CartesianGrid stroke="#e4ded2" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#6b665c" }} interval={5} />
                <YAxis domain={[0, 1]} tick={{ fontSize: 11, fill: "#6b665c" }} width={32} />
                <Tooltip />
                <Line dataKey="ndvi" name="Plant cover (NDVI)" stroke="#5f7052" strokeWidth={2} dot={false} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-xs text-muted">
            0 is bare soil, 1 is dense green plants. Each value covers about 1 km
            around your pin, so nearby fields count too.
            {missing > 0 && ` ${missing} of ${points.length} months had no satellite data.`}
          </p>
        </>
      )}
    </section>
  );
}
