"use client";

import { useEffect, useState } from "react";
import type { FarmProfile } from "@/lib/schemas/farm";
import { analyzeTerrain, type Terrain } from "./terrain";

export type TerrainState = {
  status: "idle" | "loading" | "error" | "done";
  terrain: Terrain | null;
};

// Survives page switches, so tiles are fetched once per field.
const cache = new Map<string, Terrain>();
type Result = { key: string; terrain?: Terrain; error?: boolean };

/** Slope and low spots for the saved field, from elevation tiles. */
export function useTerrain(farm: FarmProfile | null): TerrainState {
  const key = farm ? `${farm.latitude}|${farm.longitude}|${farm.areaHa}` : "";
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    if (!farm || cache.has(key)) return;
    const controller = new AbortController();
    analyzeTerrain(farm.latitude, farm.longitude, farm.areaHa, controller.signal)
      .then((terrain) => {
        cache.set(key, terrain);
        setResult({ key, terrain });
      })
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setResult({ key, error: true });
      });
    return () => controller.abort();
  }, [farm, key]);

  if (!farm) return { status: "idle", terrain: null };
  const cached = cache.get(key);
  if (cached) return { status: "done", terrain: cached };
  if (result?.key === key && result.error) return { status: "error", terrain: null };
  return { status: "loading", terrain: null };
}
