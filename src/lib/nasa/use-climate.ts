"use client";

import { useEffect, useState } from "react";
import type { FarmProfile } from "@/lib/schemas/farm";
import { computeIndicators, type AgroIndicators } from "./indicators";
import type { DailyPoint } from "./power";
import { rangeFor } from "./range";
import { climatologySummary, lastYearSummary, type ClimateSummary } from "./scenario";

export type { ClimateSummary } from "./scenario";

/** Years of history used for the monthly climatology. */
export const CLIMATOLOGY_YEARS = 10;

/** The daily record behind the summary, kept for scenarios. */
export type ClimateRecord = {
  points: DailyPoint[];
  elevationM: number | null;
  retrievedAt: string;
};

type Payload = {
  summary: ClimateSummary;
  climatology: ClimateSummary;
  indicators: AgroIndicators;
  record: ClimateRecord;
};
type Result = { key: string; data?: Payload; error?: string };

export type ClimateState = {
  status: "idle" | "loading" | "error" | "done";
  /** Last 12 months: recent-year context only, not used for scoring. */
  summary: ClimateSummary | null;
  /** Long-term means over the 10-year record, used by the scoring engine. */
  climatology: ClimateSummary | null;
  /** Monthly climatology and indicators over the last 10 years. */
  indicators: AgroIndicators | null;
  /** Daily record, for "what if" scenarios. */
  record: ClimateRecord | null;
  error: string | null;
};

/**
 * Loads 10 years of NASA POWER data for the saved farm location. The
 * 10-year means feed the scoring engine and the indicators; the last 12
 * months are kept as recent-year context.
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
        const elevationM = (json.elevationM as number | null) ?? null;
        setResult({
          key,
          data: {
            summary: lastYearSummary(points, json.retrievedAt),
            climatology: climatologySummary(points, json.retrievedAt),
            indicators: computeIndicators(points, lat, elevationM),
            record: { points, elevationM, retrievedAt: json.retrievedAt },
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

  const empty = { summary: null, climatology: null, indicators: null, record: null };
  if (!farm) return { status: "idle", ...empty, error: null };
  const current = result && result.key === key ? result : null;
  if (!current) return { status: "loading", ...empty, error: null };
  if (current.error || !current.data)
    return { status: "error", ...empty, error: current.error ?? "No data" };
  return {
    status: "done",
    summary: current.data.summary,
    climatology: current.data.climatology,
    indicators: current.data.indicators,
    record: current.data.record,
    error: null,
  };
}
