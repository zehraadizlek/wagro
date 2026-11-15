"use client";

import { useEffect, useState } from "react";
import type { FeatureTable } from "@/lib/features/monthly";
import type { FarmProfile } from "@/lib/schemas/farm";
import { detectAnomalies, type AnomalyResult, type MonthAnomaly } from "./anomaly";

export type AnomalyState = {
  status: "idle" | "loading" | "error" | "done";
  result: AnomalyResult | null;
  /** Flagged months within the last 24 months of the record, oldest first. */
  recent: MonthAnomaly[];
  /** The feature table, for showing single extreme values next to the model. */
  table: FeatureTable | null;
};

type Loaded = { result: AnomalyResult; table: FeatureTable };
// Survives page switches, so the 30-year record is fetched once per field.
const cache = new Map<string, Loaded>();

/** Unusual-month detection for the saved field (ML, unsupervised). */
export function useAnomalies(farm: FarmProfile | null): AnomalyState {
  const key = farm ? `${farm.latitude}|${farm.longitude}` : "";
  const [state, setState] = useState<{ key: string; loaded?: Loaded; error?: boolean } | null>(null);

  useEffect(() => {
    if (!farm || cache.has(key)) return;
    const controller = new AbortController();
    fetch(`/api/nasa-power/monthly?lat=${farm.latitude}&lng=${farm.longitude}&years=30`, {
      signal: controller.signal,
    })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Request failed");
        const table = { rows: json.rows, climatology: json.climatology } as FeatureTable;
        const loaded = { table, result: detectAnomalies(table) };
        cache.set(key, loaded);
        setState({ key, loaded });
      })
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setState({ key, error: true });
      });
    return () => controller.abort();
  }, [farm, key]);

  if (!farm) return { status: "idle", result: null, recent: [], table: null };
  const loaded = cache.get(key) ?? (state?.key === key ? state.loaded : undefined);
  if (!loaded) {
    return { status: state?.key === key && state.error ? "error" : "loading", result: null, recent: [], table: null };
  }
  const recent =
    loaded.result.status === "ok"
      ? (() => {
          const months = loaded.result.months;
          const cutoff = months[Math.max(0, months.length - 24)].ym;
          return loaded.result.flagged.filter((m) => m.ym >= cutoff);
        })()
      : [];
  return { status: "done", result: loaded.result, recent, table: loaded.table };
}
