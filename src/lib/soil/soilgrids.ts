import type { SoilType } from "@/lib/schemas/farm";

/**
 * ISRIC SoilGrids v2 (250 m, modelled). These are predictions from a global
 * model, not measurements in the field. They are shown next to what the
 * farmer entered and never replace it silently.
 */

export const SOILGRIDS_URL = "https://rest.isric.org/soilgrids/v2.0/properties/query";
export const SOIL_PROPERTIES = ["phh2o", "clay", "sand", "silt", "soc"] as const;
export const SOIL_DEPTHS = ["0-5cm", "5-15cm", "15-30cm"] as const;
type Property = (typeof SOIL_PROPERTIES)[number];

export type Estimate = {
  /** Depth-weighted mean over 0–30 cm. */
  mean: number;
  /** 90 % prediction interval (depth-weighted 5th and 95th percentiles). */
  low: number;
  high: number;
};

export type SoilEstimate = {
  ph: Estimate;
  /** Percent. */
  clay: Estimate;
  sand: Estimate;
  silt: Estimate;
  /** Soil organic carbon, g/kg. */
  soc: Estimate;
  /** Simplified texture class mapped to Wagro's four soil types. */
  texture: Exclude<SoilType, "unknown">;
  depth: "0-30 cm";
  source: string;
};

export function soilgridsQuery(lat: number, lng: number): string {
  const u = new URL(SOILGRIDS_URL);
  u.searchParams.set("lon", String(lng));
  u.searchParams.set("lat", String(lat));
  for (const p of SOIL_PROPERTIES) u.searchParams.append("property", p);
  for (const d of SOIL_DEPTHS) u.searchParams.append("depth", d);
  for (const v of ["mean", "Q0.05", "Q0.95"]) u.searchParams.append("value", v);
  return u.toString();
}

type RawDepth = {
  range: { top_depth: number; bottom_depth: number };
  values: Record<string, number | null>;
};
type RawLayer = { name: string; unit_measure: { d_factor: number }; depths: RawDepth[] };

/**
 * Simplified USDA texture mapping to Wagro's classes:
 * clay ≥ 40 % → clay; sand ≥ 70 % and clay < 15 % → sandy;
 * silt ≥ 50 % and clay < 27 % → silty; otherwise loamy.
 */
export function textureClass(clay: number, sand: number, silt: number): Exclude<SoilType, "unknown"> {
  if (clay >= 40) return "clay";
  if (sand >= 70 && clay < 15) return "sandy";
  if (silt >= 50 && clay < 27) return "silty";
  return "loamy";
}

/** Parses a SoilGrids response. Returns null when the point has no data (sea, ice, cities). */
export function parseSoilGrids(json: unknown): SoilEstimate | null {
  const layers = (json as { properties?: { layers?: RawLayer[] } })?.properties?.layers;
  if (!Array.isArray(layers)) return null;

  const estimate = (name: Property): Estimate | null => {
    const layer = layers.find((l) => l.name === name);
    if (!layer) return null;
    const f = layer.unit_measure?.d_factor || 1;
    let w = 0;
    const acc = { mean: 0, low: 0, high: 0 };
    for (const d of layer.depths) {
      const { mean, "Q0.05": low, "Q0.95": high } = d.values;
      if (mean == null || low == null || high == null) return null;
      const thick = d.range.bottom_depth - d.range.top_depth;
      w += thick;
      acc.mean += (mean / f) * thick;
      acc.low += (low / f) * thick;
      acc.high += (high / f) * thick;
    }
    if (!w) return null;
    const r = (v: number) => Math.round((v / w) * 10) / 10;
    return { mean: r(acc.mean), low: r(acc.low), high: r(acc.high) };
  };

  const ph = estimate("phh2o");
  const clay = estimate("clay");
  const sand = estimate("sand");
  const silt = estimate("silt");
  const soc = estimate("soc");
  if (!ph || !clay || !sand || !silt || !soc) return null;

  return {
    ph,
    clay,
    sand,
    silt,
    soc,
    texture: textureClass(clay.mean, sand.mean, silt.mean),
    depth: "0-30 cm",
    source: "ISRIC SoilGrids v2.0 (250 m, modelled)",
  };
}
