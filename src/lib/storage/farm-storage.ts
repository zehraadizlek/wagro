import { farmProfileSchema, type FarmProfile } from "@/lib/schemas/farm";

const KEY = "wagro:farm-profile:v1";

export function loadFarm(): FarmProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = farmProfileSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function saveFarm(farm: FarmProfile): void {
  window.localStorage.setItem(KEY, JSON.stringify(farm));
}

export function clearFarm(): void {
  window.localStorage.removeItem(KEY);
}