import { NextResponse } from "next/server";
import { z } from "zod";
import { featureTable } from "@/lib/features/monthly";
import { fetchPower, POWER_PARAMS } from "@/lib/nasa/power";
import { ymd } from "@/lib/nasa/range";

/**
 * Long-term monthly feature table for one location.
 * Fetches up to 30 years of NASA POWER daily data on the server and returns
 * only the monthly rows and anomalies (tens of KB instead of ~1.6 MB).
 * The existing /api/nasa-power route is unchanged.
 */

const numberInRange = (min: number, max: number) =>
  z.string().trim().min(1).transform(Number).pipe(z.number().min(min).max(max));

const querySchema = z.object({
  lat: numberInRange(-90, 90),
  lng: numberInRange(-180, 180),
  years: numberInRange(10, 30).optional(),
});

/** Whole months only: ends at the last complete month before the POWER delay. */
function monthRange(years: number) {
  const recent = new Date();
  recent.setUTCDate(recent.getUTCDate() - 7);
  const end = new Date(Date.UTC(recent.getUTCFullYear(), recent.getUTCMonth(), 0));
  const start = new Date(Date.UTC(end.getUTCFullYear() - years, end.getUTCMonth() + 1, 1));
  return { start: ymd(start), end: ymd(end) };
}

export async function GET(request: Request) {
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const parsed = querySchema.safeParse(params);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid parameters. Use lat, lng and optional years (10 to 30)." },
      { status: 400 },
    );
  }
  const { lat, lng } = parsed.data;
  const years = Math.round(parsed.data.years ?? 30);
  const { start, end } = monthRange(years);

  try {
    const data = await fetchPower({ lat, lng, start, end });
    const table = featureTable(data.points, lat, data.elevationM);
    return NextResponse.json({
      source: "NASA POWER daily (community AG), aggregated to months by Wagro",
      parameters: POWER_PARAMS,
      location: { lat, lng },
      start,
      end,
      years,
      elevationM: data.elevationM,
      retrievedAt: new Date().toISOString(),
      ...table,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error while contacting NASA POWER";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
