import { NextResponse } from "next/server";
import { z } from "zod";
import { fetchPower } from "@/lib/nasa/power";

const querySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  start: z.string().regex(/^\d{8}$/),
  end: z.string().regex(/^\d{8}$/),
});

function toDate(s: string): Date {
  return new Date(
    Date.UTC(Number(s.slice(0, 4)), Number(s.slice(4, 6)) - 1, Number(s.slice(6, 8))),
  );
}

export async function GET(request: Request) {
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const parsed = querySchema.safeParse(params);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid parameters. Use lat, lng, start and end (YYYYMMDD)." },
      { status: 400 },
    );
  }

  const { lat, lng, start, end } = parsed.data;
  const days = (toDate(end).getTime() - toDate(start).getTime()) / 86400000;
  if (Number.isNaN(days) || days < 0 || days > 366 * 5) {
    return NextResponse.json(
      { error: "Date range must be between 1 day and 5 years." },
      { status: 400 },
    );
  }

  try {
    const data = await fetchPower({ lat, lng, start, end });
    return NextResponse.json({
      source: "NASA POWER (Prediction Of Worldwide Energy Resources)",
      community: "AG",
      parameters: ["T2M", "PRECTOTCORR"],
      location: { lat, lng },
      start,
      end,
      retrievedAt: new Date().toISOString(),
      ...data,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown error while contacting NASA POWER";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}