"use client";

import { useEffect, useState } from "react";
import type { FarmProfile } from "@/lib/schemas/farm";
import type { PowerSummary } from "./power";
import { rangeFor } from "./range";

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

type Result = { key: string; summary?: ClimateSummary; error?: string };

export type ClimateState = {
  status: "idle" | "loading" | "error" | "done";
  summary: ClimateSummary | null;
  error: string | null;
};

/** One-year climate summary for the saved farm location. */
export function useClimate(farm: FarmProfile | null): ClimateState {
  const [result, setResult] = useState<Result | null>(null);
  const lat = farm?.latitude;
  const lng = farm?.longitude;
  const key = farm ? `${lat}|${lng}` : "";

  useEffect(() => {
    if (lat === undefined || lng === undefined) return;
    const controller = new AbortController();
    const { start, end } = rangeFor(1);

    fetch(`/api/nasa-power?lat=${lat}&lng=${lng}&start=${start}&end=${end}`, {
      signal: controller.signal,
    })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Request failed");
        const s = json.summary as PowerSummary;
        const precipDays = s.days - s.missingPrecipDays;
        setResult({
          key,
          summary: {
            meanTemp: s.meanTemp,
            annualPrecipMm:
              s.totalPrecip === null || precipDays <= 0
                ? null
                : (s.totalPrecip / precipDays) * 365,
            days: s.days,
            missingDays: Math.max(s.missingTempDays, s.missingPrecipDays),
            start: json.start,
            end: json.end,
            retrievedAt: json.retrievedAt,
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

  if (!farm) return { status: "idle", summary: null, error: null };
  const current = result && result.key === key ? result : null;
  if (!current) return { status: "loading", summary: null, error: null };
  if (current.error)
    return { status: "error", summary: null, error: current.error };
  return { status: "done", summary: current.summary ?? null, error: null };
}
