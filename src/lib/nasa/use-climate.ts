"use client";

import { useEffect, useState } from "react";
import type { FarmProfile } from "@/lib/schemas/farm";
import { computeIndicators, type AgroIndicators } from "./indicators";
import { summarize, type DailyPoint } from "./power";
import { rangeFor } from "./range";

/** Years of history used for the monthly climatology. */
export const CLIMATOLOGY_YEARS = 10;

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

type Payload = { summary: ClimateSummary; indicators: AgroIndicators };
type Result = { key: string; data?: Payload; error?: string };

export type ClimateState = {
  status: "idle" | "loading" | "error" | "done";
  /** Last 12 months, used by the scoring engine. */
  summary: ClimateSummary | null;
  /** Monthly climatology and indicators over the last 10 years. */
  indicators: AgroIndicators | null;
  error: string | null;
};

/**
 * Loads 10 years of NASA POWER data for the saved farm location. The last
 * 12 months feed the scoring engine; the full record feeds the indicators.
 */
export function useClimate(farm: FarmProfile | null): ClimateState {
  const [result, setResult] = useState<Result | null>(null);
  const lat = farm?.latitude;
  const lng = farm?.longitude;
  const key = farm ? `${lat}|${lng}` : "";

  useEffect(() => {
    if (lat === undefined || lng === undefined) return;
    const controller = new AbortController();
    const { start, end } = rangeFor(CLIMATOLOGY_YEARS);

    fetch(`/api/nasa-power?lat=${lat}&lng=${lng}&start=${start}&end=${end}`, {
      signal: controller.signal,
    })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Request failed");
        const points = json.points as DailyPoint[];
        const lastYear = points.slice(-365);
        const s = summarize(lastYear);
        const precipDays = s.days - s.missingPrecipDays;
        setResult({
          key,
          data: {
            summary: {
              meanTemp: s.meanTemp,
              annualPrecipMm:
                s.totalPrecip === null || precipDays <= 0
                  ? null
                  : (s.totalPrecip / precipDays) * 365,
              days: s.days,
              missingDays: Math.max(s.missingTempDays, s.missingPrecipDays),
              start: lastYear[0]?.date ?? json.start,
              end: lastYear[lastYear.length - 1]?.date ?? json.end,
              retrievedAt: json.retrievedAt,
            },
            indicators: computeIndicators(points, lat, json.elevationM ?? null),
          },
        });
      })
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setResult({
          key,
          error: e instanceof Error ? e.message : "Something went wrong",
        });
      });

    return () => controller.abort();
  }, [lat, lng, key]);

  const empty = { summary: null, indicators: null };
  if (!farm) return { status: "idle", ...empty, error: null };
  const current = result && result.key === key ? result : null;
  if (!current) return { status: "loading", ...empty, error: null };
  if (current.error || !current.data)
    return { status: "error", ...empty, error: current.error ?? "No data" };
  return {
    status: "done",
    summary: current.data.summary,
    indicators: current.data.indicators,
    error: null,
  };
}
