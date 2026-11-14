/**
 * NASA GIBS (Global Imagery Browse Services) layers used on the results page.
 * Layer names, tile levels and date ranges were checked against the GIBS
 * WMTS capabilities document in November 2026.
 */

export type GibsLayerId = "ndvi" | "soil" | "heat" | "water";

export type GibsLayer = {
  id: GibsLayerId;
  /** Button label, in plain words. */
  label: string;
  /** One sentence telling a farmer how to read the colours. */
  reading: string;
  /** NASA product name, for the source line. */
  product: string;
  layer: string;
  /** GoogleMapsCompatible tile level of the layer. */
  maxZoom: number;
  /** Latest month with data (YYYY-MM). */
  latest: string;
  /** Day of the month used in the tile request. */
  day: "01" | "15";
  legend: string;
  colormap: string;
};

const BASE = "https://gibs.earthdata.nasa.gov";

export const GIBS_LAYERS: GibsLayer[] = [
  {
    id: "ndvi",
    label: "Plant growth",
    reading: "Greener means more living plants. Pale means bare or dry land.",
    product: "MODIS Terra vegetation index (NDVI), monthly",
    layer: "MODIS_Terra_L3_NDVI_Monthly",
    maxZoom: 7,
    latest: "2026-10",
    day: "01",
    legend: `${BASE}/legends/MODIS_L3_NDVI_H.svg`,
    colormap: `${BASE}/colormaps/v1.3/MODIS_L3_NDVI.xml`,
  },
  {
    id: "soil",
    label: "Soil moisture",
    reading: "Bluer means wetter soil in the root zone. Browner means drier.",
    product: "SMAP L4 root-zone soil moisture, daily (mid-month shown)",
    layer: "SMAP_L4_Analyzed_Root_Zone_Soil_Moisture",
    maxZoom: 6,
    latest: "2026-10",
    day: "15",
    legend: `${BASE}/legends/SMAP_Analyzed_Soil_Moisture_H.svg`,
    colormap: `${BASE}/colormaps/v1.3/SMAP_Analyzed_Soil_Moisture.xml`,
  },
  {
    id: "heat",
    label: "Ground heat",
    reading: "Redder means hotter ground in the daytime.",
    product: "MODIS Terra land surface temperature, monthly daytime",
    layer: "MODIS_Terra_L3_Land_Surface_Temp_Monthly_Day",
    maxZoom: 6,
    latest: "2026-10",
    day: "01",
    legend: `${BASE}/legends/MODIS_Land_Surface_Temp_H.svg`,
    colormap: `${BASE}/colormaps/v1.3/MODIS_Land_Surface_Temp.xml`,
  },
  {
    id: "water",
    label: "Water storage",
    reading: "Red means less water stored underground than usual. Blue means more. Very coarse: about 300 km.",
    product: "GRACE / GRACE-FO total water storage anomaly, monthly (until July 2022)",
    layer: "GRACE_Tellus_Liquid_Water_Equivalent_Thickness_Mascon_CRI",
    maxZoom: 6,
    latest: "2022-07",
    day: "01",
    legend: `${BASE}/legends/GRACE_Tellus_Liquid_Water_Equivalent_Thickness_Mascon_CRI_H.svg`,
    colormap: `${BASE}/colormaps/v1.3/GRACE_Tellus_Liquid_Water_Equivalent_Thickness_Mascon_CRI.xml`,
  },
];

/** Month string YYYY-MM, `back` months before `latest`. */
export function monthBefore(latest: string, back: number): string {
  const [y, m] = latest.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 - back, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function tileUrl(layer: GibsLayer, month: string): string {
  return `${BASE}/wmts/epsg3857/best/${layer.layer}/default/${month}-${layer.day}/GoogleMapsCompatible_Level${layer.maxZoom}/{z}/{y}/{x}.png`;
}

// ---------- reading values back from tiles ----------

type Entry = { rgb: [number, number, number]; value: number };

/** Parses a GIBS v1.3 colour map into colour → value pairs (interval midpoints). */
export async function loadColormap(url: string, signal?: AbortSignal): Promise<Entry[]> {
  const text = await (await fetch(url, { signal })).text();
  const doc = new DOMParser().parseFromString(text, "text/xml");
  const out: Entry[] = [];
  doc.querySelectorAll("ColorMapEntry").forEach((e) => {
    if (e.getAttribute("nodata") === "true" || e.getAttribute("transparent") === "true") return;
    const rgb = (e.getAttribute("rgb") ?? "").split(",").map(Number) as [number, number, number];
    const nums = (e.getAttribute("value") ?? "").match(/-?\d+(\.\d+)?/g);
    if (rgb.length !== 3 || !nums) return;
    const vals = nums.map(Number);
    out.push({ rgb, value: vals.length > 1 ? (vals[0] + vals[1]) / 2 : vals[0] });
  });
  return out;
}

function nearest(entries: Entry[], r: number, g: number, b: number): number | null {
  let best: Entry | null = null;
  let bestD = Infinity;
  for (const e of entries) {
    const d = (e.rgb[0] - r) ** 2 + (e.rgb[1] - g) ** 2 + (e.rgb[2] - b) ** 2;
    if (d < bestD) {
      best = e;
      bestD = d;
    }
  }
  // Colours far from every entry are labels, borders or blending: ignore.
  return best && bestD <= 300 ? best.value : null;
}

/** Tile and pixel of a point at a zoom level (Web Mercator). */
export function pointToTile(lat: number, lng: number, z: number) {
  const n = 2 ** z;
  const x = ((lng + 180) / 360) * n;
  const rad = (lat * Math.PI) / 180;
  const y = ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n;
  return {
    tx: Math.floor(x),
    ty: Math.floor(y),
    px: Math.floor((x - Math.floor(x)) * 256),
    py: Math.floor((y - Math.floor(y)) * 256),
  };
}

export function loadImage(url: string, signal?: AbortSignal): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    const abort = () => {
      img.src = "";
      reject(new DOMException("Aborted", "AbortError"));
    };
    signal?.addEventListener("abort", abort, { once: true });
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not load ${url}`));
    img.src = url;
  });
}

/** Value of a GIBS layer at one point for one month, or null if no data. */
export async function sampleLayer(
  layer: GibsLayer,
  colormap: Entry[],
  month: string,
  lat: number,
  lng: number,
  signal?: AbortSignal,
): Promise<number | null> {
  const z = layer.maxZoom;
  const { tx, ty, px, py } = pointToTile(lat, lng, z);
  const url = tileUrl(layer, month).replace("{z}", String(z)).replace("{y}", String(ty)).replace("{x}", String(tx));
  let img: HTMLImageElement;
  try {
    img = await loadImage(url, signal);
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    return null;
  }
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0);
  // Average the pixel and its neighbours that carry a valid colour.
  const vals: number[] = [];
  const data = ctx.getImageData(Math.max(0, px - 1), Math.max(0, py - 1), 3, 3).data;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 200) continue;
    const v = nearest(colormap, data[i], data[i + 1], data[i + 2]);
    if (v !== null) vals.push(v);
  }
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}
