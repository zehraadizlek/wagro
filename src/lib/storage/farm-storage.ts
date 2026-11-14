import { farmProfileSchema, type FarmProfile } from "@/lib/schemas/farm";

export const FARM_KEY = "wagro:farm-profile:v1";
const CHANGE_EVENT = "wagro:farm-changed";

export function parseFarm(raw: string | null | undefined): FarmProfile | null {
  if (!raw) return null;
  try {
    const parsed = farmProfileSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** Raw stored string. Returns "" when nothing is stored or storage is blocked. */
export function readFarmRaw(): string {
  try {
    return window.localStorage.getItem(FARM_KEY) ?? "";
  } catch {
    return "";
  }
}

export function subscribeFarm(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

export function loadFarm(): FarmProfile | null {
  if (typeof window === "undefined") return null;
  return parseFarm(readFarmRaw());
}

/** Returns false when the browser blocks storage (private mode, full quota). */
export function saveFarm(farm: FarmProfile): boolean {
  try {
    window.localStorage.setItem(FARM_KEY, JSON.stringify(farm));
    window.dispatchEvent(new Event(CHANGE_EVENT));
    return true;
  } catch {
    return false;
  }
}

export function clearFarm(): void {
  try {
    window.localStorage.removeItem(FARM_KEY);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  } catch {
    /* storage unavailable, nothing to clear */
  }
}
