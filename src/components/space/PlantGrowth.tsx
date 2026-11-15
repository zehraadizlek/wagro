"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AXIS_TICK, TOOLTIP_PROPS, axisTitle } from "@/components/ui/chart-style";
import { MONTH_LABELS } from "@/lib/nasa/indicators";
import MethodBadge from "@/components/ml/MethodBadge";
import { seasonSummary } from "@/lib/features/ndvi";
import { checkCalendar, phenology } from "@/lib/features/phenology";
import { useNdvi } from "@/lib/features/use-ndvi";
import { CROP_PARAMS } from "@/lib/rotation/crops";
import type { Crop } from "@/lib/schemas/farm";

function monthList(ms: number[]): string {
  return ms.map((m) => MONTH_LABELS[m - 1]).join(", ");
}

/** What the satellite saw on and around the field over the last 3 years. */
export default function PlantGrowth({ lat, lng, crop }: { lat: number; lng: number; crop: Crop }) {
  const ndvi = useNdvi(lat, lng);
  const points = ndvi.points ?? undefined;
  const error = ndvi.status === "error" ? "Satellite data could not be loaded." : undefined;

  const { lowMonths: bare, missing } = seasonSummary(points ?? []);
  const season = phenology(points ?? []);
  const typical = season.typical;
  const check = checkCalendar(season, crop, lat);
  const m = (n: number | null) => (n === null ? null : MONTH_LABELS[n - 1]);

  const chart = points?.map((p) => ({
    label: `${MONTH_LABELS[Number(p.month.slice(5)) - 1]} ${p.month.slice(2, 4)}`,
    ndvi: p.ndvi === null ? null : Math.round(p.ndvi * 100) / 100,
  }));

  return (
    <section className="rounded-[28px] border border-line bg-paper p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-3xl">Plant cover around your field</h2>
        <MethodBadge method="statistics" />
      </div>
      <p className="mt-1 text-sm text-muted">
        How green the land was each month, seen by NASA&apos;s MODIS satellite.
      </p>

      {!points && !error && (
        <div className="mt-4 h-48 animate-pulse rounded-2xl bg-sand" />
      )}
      {error && <p className="mt-4 text-sm text-clay">{error}</p>}

      {points && chart && (
        <>
          <ul className="mt-4 space-y-1 text-sm">
            {typical && (
              <li>
                {typical.greenFromYearStart
                  ? "Usually green through winter, "
                  : typical.greenUpMonth
                    ? `Usually greens up in ${m(typical.greenUpMonth)}, `
                    : "Usually "}
                peaks in {m(typical.peakMonth)}
                {typical.declineMonth ? ` and fades by ${m(typical.declineMonth)}` : ""}.
              </li>
            )}
            {check && (
              <li className={check.agrees ? "" : "text-clay"}>
                {check.agrees
                  ? `That fits the calendar we assume for ${CROP_PARAMS[crop].label.toLowerCase()}.`
                  : `Our calendar assumes ${CROP_PARAMS[crop].label.toLowerCase()} peaks in ${m(check.expectedPeak)}. Check the sowing and harvest months against your own.`}
              </li>
            )}
            <li>
              {bare.length
                ? `Little plant cover in ${monthList(bare)} (bare soil, stubble or snow). That is when soil is most exposed.`
                : "Rarely looks bare: something is growing most of the year."}
            </li>
          </ul>
          <div className="mt-4 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chart}>
                <CartesianGrid stroke="#e4ded2" vertical={false} />
                <XAxis dataKey="label" tick={AXIS_TICK} interval={5} />
                <YAxis domain={[0, 1]} ticks={[0, 0.25, 0.5, 0.75, 1]} tick={AXIS_TICK} width={48} label={axisTitle("NDVI (0–1)")} />
                <Tooltip {...TOOLTIP_PROPS} formatter={(v) => [v, "NDVI"]} />
                <Line dataKey="ndvi" name="Plant cover (NDVI)" stroke="#5f7052" strokeWidth={2} dot={false} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-xs text-muted">
            0 is bare soil, 1 is dense green plants. Each value covers about 1 km
            around your pin, so nearby fields count too, and it cannot tell
            which crop is growing.
            {missing > 0 && ` ${missing} of ${points.length} months had no satellite data.`}
          </p>
        </>
      )}
    </section>
  );
}
