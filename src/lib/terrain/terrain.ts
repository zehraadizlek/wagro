"use client";

/**
 * Field-level terrain from elevation tiles (AWS Terrain Tiles, "terrarium"
 * format). Where available the tiles come from NASA SRTM; in some regions
 * other models (for example EU-DEM) are used, and each tile says which.
 * Detail is roughly 30 m, so small banks and ditches are not visible.
 */

const TILE = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium";
const Z = 14;

/** Slope (%) from which erosion risk is treated as raised. */
export const SLOPE_SLOPING = 8;
/** Slope (%) from which erosion risk is treated as high. */
export const SLOPE_STEEP = 15;

export type Terrain = {
  /** Average slope inside the field, in percent. */
  meanSlopePct: number;
  /** Share (0–1) of the field steeper than SLOPE_SLOPING. */
  slopingShare: number;
  /** Share (0–1) of the field in low spots where cold air collects. */
  lowShare: number;
  elevMin: number;
  elevMax: number;
  /** Coloured risk overlay as a data URL, and its map bounds. */
  overlay: string;
  bounds: [[number, number], [number, number]];
  /** Field radius used, in metres. */
  radiusM: number;
  sources: string[];
};

const SOURCE_NAMES: Record<string, string> = {
  srtm: "NASA SRTM",
  eudem: "EU-DEM",
  gmted: "GMTED2010",
  etopo1: "ETOPO1",
  ned: "USGS NED",
  ned_topobathy: "USGS NED",
  cdem: "Canada CDEM",
  aster: "NASA/METI ASTER GDEM",
};

function sourceName(raw: string): string {
  const key = raw.split("/")[0].trim().toLowerCase();
  return SOURCE_NAMES[key] ?? key.toUpperCase();
}

const toPixel = (lat: number, lng: number) => {
  const n = 256 * 2 ** Z;
  const rad = (lat * Math.PI) / 180;
  return {
    x: ((lng + 180) / 360) * n,
    y: ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n,
  };
};

const toLatLng = (x: number, y: number): [number, number] => {
  const n = 256 * 2 ** Z;
  const lng = (x / n) * 360 - 180;
  const lat = (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n))) * 180) / Math.PI;
  return [lat, lng];
};

async function loadTile(tx: number, ty: number, signal: AbortSignal) {
  const res = await fetch(`${TILE}/${Z}/${tx}/${ty}.png`, { signal });
  if (!res.ok) throw new Error(`Elevation tile responded with ${res.status}`);
  const source = res.headers.get("x-amz-meta-x-imagery-sources") ?? "";
  const bitmap = await createImageBitmap(await res.blob());
  return { bitmap, source };
}

export async function analyzeTerrain(
  lat: number,
  lng: number,
  areaHa: number,
  signal: AbortSignal,
): Promise<Terrain> {
  const mpp = (156543.03392 * Math.cos((lat * Math.PI) / 180)) / 2 ** Z;
  const radiusM = Math.sqrt((areaHa * 10000) / Math.PI);
  const windowM = Math.min(1200, Math.max(200, radiusM * 1.5));
  const c = toPixel(lat, lng);
  const rPx = windowM / mpp;
  const x0 = Math.floor(c.x - rPx);
  const y0 = Math.floor(c.y - rPx);
  const size = Math.ceil(2 * rPx);

  // Stitch the tiles that cover the window into one canvas.
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  const sources = new Set<string>();
  const tiles: Promise<void>[] = [];
  for (let ty = Math.floor(y0 / 256); ty <= Math.floor((y0 + size) / 256); ty++) {
    for (let tx = Math.floor(x0 / 256); tx <= Math.floor((x0 + size) / 256); tx++) {
      tiles.push(
        loadTile(tx, ty, signal).then(({ bitmap, source }) => {
          ctx.drawImage(bitmap, tx * 256 - x0, ty * 256 - y0);
          source.split(",").filter(Boolean).forEach((s) => sources.add(sourceName(s)));
        }),
      );
    }
  }
  await Promise.all(tiles);

  const px = ctx.getImageData(0, 0, size, size).data;
  const elev = new Float32Array(size * size);
  for (let i = 0; i < size * size; i++) {
    elev[i] = px[i * 4] * 256 + px[i * 4 + 1] + px[i * 4 + 2] / 256 - 32768;
  }
  const at = (x: number, y: number) =>
    elev[Math.min(size - 1, Math.max(0, y)) * size + Math.min(size - 1, Math.max(0, x))];

  // Slope with Horn's method, in percent.
  const slope = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dzdx =
        (at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1) -
          (at(x - 1, y - 1) + 2 * at(x - 1, y) + at(x - 1, y + 1))) /
        (8 * mpp);
      const dzdy =
        (at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1) -
          (at(x - 1, y - 1) + 2 * at(x, y - 1) + at(x + 1, y - 1))) /
        (8 * mpp);
      slope[y * size + x] = 100 * Math.hypot(dzdx, dzdy);
    }
  }

  // Low spots: lower than the land within about 100 m, and fairly flat.
  const k = Math.max(3, Math.round(100 / mpp));
  const low = new Uint8Array(size * size);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let sum = 0;
      let n = 0;
      for (let dy = -k; dy <= k; dy += 2) {
        for (let dx = -k; dx <= k; dx += 2) {
          sum += at(x + dx, y + dy);
          n++;
        }
      }
      const i = y * size + x;
      if (elev[i] < sum / n - 1 && slope[i] < 5) low[i] = 1;
    }
  }

  // Statistics inside the field circle, and the overlay image.
  const img = ctx.createImageData(size, size);
  const cx = c.x - x0;
  const cy = c.y - y0;
  const fieldPx = radiusM / mpp;
  let count = 0;
  let slopeSum = 0;
  let sloping = 0;
  let lowCount = 0;
  let elevMin = Infinity;
  let elevMax = -Infinity;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      const s = slope[i];
      const inField = Math.hypot(x - cx, y - cy) <= fieldPx;
      if (inField) {
        count++;
        slopeSum += s;
        if (s >= SLOPE_SLOPING) sloping++;
        if (low[i]) lowCount++;
        elevMin = Math.min(elevMin, elev[i]);
        elevMax = Math.max(elevMax, elev[i]);
      }
      let rgba: [number, number, number, number] | null = null;
      if (s >= SLOPE_STEEP) rgba = [139, 111, 92, 190];
      else if (s >= SLOPE_SLOPING) rgba = [201, 176, 143, 160];
      else if (low[i]) rgba = [120, 150, 170, 160];
      if (rgba) {
        const a = inField ? rgba[3] : Math.round(rgba[3] * 0.4);
        img.data.set([rgba[0], rgba[1], rgba[2], a], i * 4);
      }
    }
  }
  const out = document.createElement("canvas");
  out.width = size;
  out.height = size;
  out.getContext("2d")!.putImageData(img, 0, 0);

  return {
    meanSlopePct: count ? slopeSum / count : 0,
    slopingShare: count ? sloping / count : 0,
    lowShare: count ? lowCount / count : 0,
    elevMin: Number.isFinite(elevMin) ? elevMin : 0,
    elevMax: Number.isFinite(elevMax) ? elevMax : 0,
    overlay: out.toDataURL("image/png"),
    bounds: [toLatLng(x0, y0 + size), toLatLng(x0 + size, y0)],
    radiusM,
    sources: [...sources],
  };
}
