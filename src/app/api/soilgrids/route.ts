import { NextResponse } from "next/server";
import { z } from "zod";
import { parseSoilGrids, soilgridsQuery, type SoilEstimate } from "@/lib/soil/soilgrids";

/**
 * Modelled soil properties (ISRIC SoilGrids v2) for one point.
 * The upstream service often takes 10–20 s, so results are cached in memory
 * per ~1 km cell for the life of the server process.
 */

const numberInRange = (min: number, max: number) =>
  z.string().trim().min(1).transform(Number).pipe(z.number().min(min).max(max));

const querySchema = z.object({
  lat: numberInRange(-90, 90),
  lng: numberInRange(-180, 180),
});

const cache = new Map<string, SoilEstimate | null>();

export async function GET(request: Request) {
  const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid parameters. Use lat and lng." }, { status: 400 });
  }
  const { lat, lng } = parsed.data;
  // SoilGrids is 250 m; rounding to 0.01° (~1 km) keeps the cache small.
  const key = `${lat.toFixed(2)}|${lng.toFixed(2)}`;

  if (!cache.has(key)) {
    try {
      const res = await fetch(soilgridsQuery(lat, lng), {
        cache: "no-store",
        signal: AbortSignal.timeout(30000),
      });
      if (!res.ok) throw new Error(`SoilGrids responded with status ${res.status}`);
      cache.set(key, parseSoilGrids(await res.json()));
    } catch (err) {
      const message = err instanceof Error ? err.message : "SoilGrids could not be reached";
      return NextResponse.json({ error: message }, { status: 502 });
    }
  }

  const soil = cache.get(key) ?? null;
  return NextResponse.json({
    location: { lat, lng },
    soil,
    note: soil
      ? "Modelled values from a global 250 m map, not a soil test."
      : "No soil data for this point (for example water, ice or built-up land).",
  });
}
