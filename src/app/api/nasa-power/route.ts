import { NextResponse } from "next/server";
import { z } from "zod";
import { POWER_PARAMS, fetchPower } from "@/lib/nasa/power";

/** Accepts only non-empty numeric strings inside the given range. */
const numberInRange = (min: number, max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .transform(Number)
    .pipe(z.number().min(min).max(max));

function toDate(s: string): Date {
  return new Date(
    Date.UTC(
      Number(s.slice(0, 4)),
      Number(s.slice(4, 6)) - 1,
      Number(s.slice(6, 8)),
    ),
  );
}

function isRealDate(s: string): boolean {
  const d = toDate(s);
  return (
    d.getUTCFullYear() === Number(s.slice(0, 4)) &&
    d.getUTCMonth() === Number(s.slice(4, 6)) - 1 &&
    d.getUTCDate() === Number(s.slice(6, 8))
  );
}

const dateString = z
  .string()
  .regex(/^\d{8}$/)
  .refine(isRealDate);

const querySchema = z.object({
  lat: numberInRange(-90, 90),
  lng: numberInRange(-180, 180),
  start: dateString,
  end: dateString,
});

export async function GET(request: Request) {
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const parsed = querySchema.safeParse(params);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error:
          "Invalid parameters. Use lat, lng, start and end (YYYYMMDD, real dates).",
      },
      { status: 400 },
    );
  }

  const { lat, lng, start, end } = parsed.data;
  const days = (toDate(end).getTime() - toDate(start).getTime()) / 86400000;
  if (days < 0 || days > 366 * 10) {
    return NextResponse.json(
      { error: "Date range must be between 1 day and 10 years." },
      { status: 400 },
    );
  }

  try {
    const data = await fetchPower({ lat, lng, start, end });
    return NextResponse.json({
      source: "NASA POWER (Prediction Of Worldwide Energy Resources)",
      community: "AG",
      parameters: POWER_PARAMS,
      location: { lat, lng },
      start,
      end,
      retrievedAt: new Date().toISOString(),
      ...data,
    });
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "Unknown error while contacting NASA POWER";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
