"use client";

import { useMemo, useSyncExternalStore } from "react";
import type { FarmProfile } from "@/lib/schemas/farm";
import { parseFarm, readFarmRaw, subscribeFarm } from "./farm-storage";

const SERVER = "\u0000server";

/**
 * Reads the saved farm profile from the browser.
 * `ready` is false during server rendering and the first hydration pass,
 * so pages can avoid flashing a "no profile" message.
 */
export function useFarm(): { farm: FarmProfile | null; ready: boolean } {
  const raw = useSyncExternalStore(subscribeFarm, readFarmRaw, () => SERVER);
  return useMemo(
    () => ({
      ready: raw !== SERVER,
      farm: raw === SERVER ? null : parseFarm(raw),
    }),
    [raw],
  );
}
