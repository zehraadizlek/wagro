"use client";

import { useEffect, useState } from "react";
import { loadNdviSeries, type NdviPoint } from "./ndvi";

export const NDVI_MONTHS = 36;

// Shared by every component on the page; survives page switches.
const cache = new Map<string, NdviPoint[]>();
// One request per field even when several components ask at once.
const inflight = new Map<string, Promise<NdviPoint[]>>();

function load(lat: number, lng: number, key: string): Promise<NdviPoint[]> {
  let p = inflight.get(key);
  if (!p) {
    p = loadNdviSeries(lat, lng, NDVI_MONTHS, new AbortController().signal)
      .then((points) => {
        cache.set(key, points);
        return points;
      })
      .finally(() => inflight.delete(key));
    inflight.set(key, p);
  }
  return p;
}

export type NdviState = { status: "idle" | "loading" | "error" | "done"; points: NdviPoint[] | null };

/** The last 36 months of MODIS NDVI at a point (browser only). Pass null to skip. */
export function useNdvi(lat: number | null, lng: number | null): NdviState {
  const key = lat === null || lng === null ? "" : `${lat}|${lng}`;
  const [state, setState] = useState<{ key: string; points?: NdviPoint[]; error?: boolean } | null>(null);

  useEffect(() => {
    if (lat === null || lng === null || cache.has(key)) return;
    let alive = true;
    load(lat, lng, key)
      .then((points) => alive && setState({ key, points }))
      .catch(() => alive && setState({ key, error: true }));
    return () => {
      alive = false;
    };
  }, [key, lat, lng]);

  if (!key) return { status: "idle", points: null };
  const points = cache.get(key) ?? (state?.key === key ? state.points : undefined);
  if (points) return { status: "done", points };
  return { status: state?.key === key && state.error ? "error" : "loading", points: null };
}
