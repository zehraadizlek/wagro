"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  HEAVY_RAIN_MM,
  MONTH_LABELS,
  doyLabel,
  type AgroIndicators,
} from "@/lib/nasa/indicators";

const tick = { fontSize: 12, fill: "#7a6352" };
const r0 = (v: number | null) => (v === null ? null : Math.round(v));
const r1 = (v: number | null) => (v === null ? null : Math.round(v * 10) / 10);
const r2 = (v: number | null) => (v === null ? null : Math.round(v * 100) / 100);

function Tile({
  title,
  value,
  unit,
  note,
  tone,
}: {
  title: string;
  value: string;
  unit?: string;
  note: string;
  tone: string;
}) {
  return (
    <div className={`rounded-[24px] p-5 ${tone}`}>
      <div className="text-xs font-medium uppercase tracking-[0.14em] opacity-70">
        {title}
      </div>
      <div className="mt-2 font-display text-4xl leading-none">
        {value}
        {unit && <span className="ml-1 text-base opacity-70">{unit}</span>}
      </div>
      <p className="mt-2 text-xs opacity-80">{note}</p>
    </div>
  );
}

function listMonths(ms: number[]) {
  return ms.map((m) => MONTH_LABELS[m - 1]).join(", ");
}

export default function GrowingConditions({ ind }: { ind: AgroIndicators }) {
  const a = ind.annual;
  const years = Math.round(ind.years * 10) / 10;
  const short = ind.years < 5;

  const monthly = ind.months.map((m) => ({
    label: m.label,
    precip: r0(m.precipMm),
    et0: r0(m.et0Mm),
    tmax: r1(m.tmax),
    tmin: r1(m.tmin),
    frost: r1(m.frostDays),
    heat: r1(m.heatDays[32]),
    top: r2(m.gwetTop),
    root: r2(m.gwetRoot),
  }));

  const f = ind.frost;
  const sm = ind.soilMoisture;

  const readings: string[] = [];
  if (a.dryMonths.length)
    readings.push(
      `Rain covers less than half of the evaporative demand in ${listMonths(a.dryMonths)}. Crops in the field then rely on stored soil water or irrigation.`,
    );
  const surplus = ind.months.filter((m) => (m.balanceMm ?? -1) > 0).map((m) => m.month);
  if (surplus.length)
    readings.push(
      `Rain is higher than evaporation in ${listMonths(surplus)}. This is when soil can refill, and when bare soil can lose nutrients and topsoil.`,
    );
  const frostMonths = ind.months.filter((m) => (m.frostDays ?? 0) >= 1).map((m) => m.month);
  if (frostMonths.length)
    readings.push(`Frost nights are common in ${listMonths(frostMonths)}.`);
  const hotMonths = ind.months.filter((m) => (m.heatDays[32] ?? 0) >= 2).map((m) => m.month);
  if (hotMonths.length)
    readings.push(
      `Days of 32 °C or more are common in ${listMonths(hotMonths)}. Heat during flowering can cut grain set.`,
    );

  return (
    <section className="rounded-[28px] border border-line bg-paper p-6">
      <h2 className="font-display text-3xl">Growing conditions</h2>
      <p className="mb-5 text-sm text-muted">
        Typical values for each month, averaged over the {years} years you
        selected.{" "}
        {short &&
          "This is a short record, so one unusual year can dominate. Choose 10 years for a steadier picture."}
      </p>

      <div className="grid gap-4 md:grid-cols-3">
        <Tile
          title="Aridity (rain ÷ ET0)"
          value={a.aridityIndex === null ? "n/a" : a.aridityIndex.toFixed(2)}
          note={
            a.aridityClass
              ? `${a.aridityClass[0].toUpperCase()}${a.aridityClass.slice(1)}: ${r0(a.precipMm)} mm of rain against ${r0(a.et0Mm)} mm of evaporative demand per year.`
              : "Not enough data."
          }
          tone="bg-espresso text-paper"
        />
        <Tile
          title="Frost days per year"
          value={a.frostDays === null ? "n/a" : String(Math.round(a.frostDays))}
          unit="days"
          note={`Nights below 0 °C. About ${Math.round(a.hardFrostDays ?? 0)} of them fall below -5 °C.`}
          tone="bg-sand"
        />
        <Tile
          title="Hot days per year"
          value={a.heatDays35 === null ? "n/a" : String(Math.round(a.heatDays35))}
          unit="days"
          note={`Days reaching 35 °C or more. Heavy-rain days (${HEAVY_RAIN_MM} mm or more): ${a.heavyRainDays === null ? "n/a" : a.heavyRainDays.toFixed(1)} per year.`}
          tone="bg-terracotta text-paper"
        />
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-line p-4 text-sm">
          <h3 className="mb-1 font-medium">Frost window</h3>
          {f.yearsChecked === 0 ? (
            <p className="text-muted">Not enough complete years to judge.</p>
          ) : f.yearsWithFrost === 0 ? (
            <p className="text-muted">
              No frost in {f.yearsChecked} years checked.
            </p>
          ) : (
            <p className="text-muted">
              Last spring frost is typically around{" "}
              <b className="text-espresso">
                {f.lastSpringDoy === null ? "n/a" : doyLabel(f.lastSpringDoy)}
              </b>
              {f.latestSpringDoy !== null &&
                ` (latest seen: ${doyLabel(f.latestSpringDoy)})`}
              . First autumn frost is typically around{" "}
              <b className="text-espresso">
                {f.firstAutumnDoy === null ? "n/a" : doyLabel(f.firstAutumnDoy)}
              </b>
              {f.earliestAutumnDoy !== null &&
                ` (earliest seen: ${doyLabel(f.earliestAutumnDoy)})`}
              .
              {f.frostFreeDays !== null &&
                ` That leaves about ${f.frostFreeDays} frost-free days.`}{" "}
              Based on {f.yearsChecked} years. Frost-sensitive crops are safer
              sown after the latest date seen, not the typical one.
            </p>
          )}
        </div>
        <div className="rounded-2xl border border-line p-4 text-sm">
          <h3 className="mb-1 font-medium">Soil moisture right now</h3>
          {sm ? (
            <p className="text-muted">
              Root-zone soil wetness over the last 30 days is{" "}
              <b className="text-espresso">
                {Math.abs(Math.round(sm.pct))}%{" "}
                {sm.pct >= 0 ? "above" : "below"}
              </b>{" "}
              the usual for this time of year ({sm.recent.toFixed(2)} against{" "}
              {sm.usual.toFixed(2)}, compared with {sm.baselineYears} earlier
              years).{" "}
              {sm.pct <= -15
                ? "Drier than usual: watch soil water before sowing."
                : sm.pct >= 15
                  ? "Wetter than usual: check field access and waterlogging."
                  : "Close to normal."}
            </p>
          ) : (
            <p className="text-muted">
              Needs at least 3 years of data. Choose the 10-year range.
            </p>
          )}
        </div>
      </div>

      {readings.length > 0 && (
        <ul className="mt-4 list-disc space-y-1 rounded-2xl bg-sage/50 p-4 pl-8 text-sm">
          {readings.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ul>
      )}

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <div>
          <h3 className="font-medium">Water balance by month</h3>
          <p className="mb-2 text-xs text-muted">
            Rain against reference evapotranspiration (ET0), in mm. Where the
            brown bar is taller, the air takes more water than falls.
          </p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthly}>
                <CartesianGrid stroke="#e6d8c3" vertical={false} />
                <XAxis dataKey="label" tick={tick} />
                <YAxis tick={tick} width={40} />
                <Tooltip />
                <Legend />
                <Bar dataKey="precip" name="Rain (mm)" fill="#55612f" />
                <Bar dataKey="et0" name="ET0 (mm)" fill="#b8481f" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div>
          <h3 className="font-medium">Temperature and stress days</h3>
          <p className="mb-2 text-xs text-muted">
            Average daily max and min (°C, lines) and typical frost days and
            days of 32 °C or more per month (bars).
          </p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={monthly}>
                <CartesianGrid stroke="#e6d8c3" vertical={false} />
                <XAxis dataKey="label" tick={tick} />
                <YAxis yAxisId="t" tick={tick} unit="°" width={40} />
                <YAxis yAxisId="d" orientation="right" tick={tick} width={30} />
                <Tooltip />
                <Legend />
                <Bar yAxisId="d" dataKey="frost" name="Frost days" fill="#3d6f9e" />
                <Bar yAxisId="d" dataKey="heat" name="Days ≥ 32 °C" fill="#e0a07f" />
                <Line yAxisId="t" dataKey="tmax" name="Max (°C)" stroke="#b8481f" strokeWidth={2} dot={false} />
                <Line yAxisId="t" dataKey="tmin" name="Min (°C)" stroke="#2b1d14" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="md:col-span-2">
          <h3 className="font-medium">Soil wetness by month</h3>
          <p className="mb-2 text-xs text-muted">
            0 is completely dry and 1 is saturated. Surface means the top few
            centimetres; root zone reaches about one metre.
          </p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthly}>
                <CartesianGrid stroke="#e6d8c3" vertical={false} />
                <XAxis dataKey="label" tick={tick} />
                <YAxis tick={tick} width={40} domain={[0, 1]} />
                <Tooltip />
                <Legend />
                <Line dataKey="top" name="Surface" stroke="#c9962e" strokeWidth={2} />
                <Line dataKey="root" name="Root zone" stroke="#55612f" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {ind.et0FallbackShare > 0.05 && (
        <p className="mt-4 text-xs text-muted">
          On {Math.round(ind.et0FallbackShare * 100)}% of days humidity, wind or
          radiation was missing, so ET0 used a simpler temperature-only formula
          (Hargreaves).
        </p>
      )}
    </section>
  );
}
