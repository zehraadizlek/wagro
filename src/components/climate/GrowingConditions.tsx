"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { MONTH_LABELS, doyLabel, type AgroIndicators } from "@/lib/nasa/indicators";

type Level = "good" | "watch" | "risk";

const BADGE: Record<Level, { text: string; className: string }> = {
  good: { text: "Good", className: "bg-sage text-espresso" },
  watch: { text: "Watch", className: "bg-[#ece3cf] text-espresso" },
  risk: { text: "Risk", className: "bg-clay text-paper" },
};

const tick = { fontSize: 12, fill: "#6b665c" };
const round = (v: number | null) => (v === null ? null : Math.round(v));
const months = (ms: number[]) => ms.map((m) => MONTH_LABELS[m - 1]).join(", ");

function Card({
  title,
  level,
  big,
  text,
}: {
  title: string;
  level: Level;
  big: string;
  text: string;
}) {
  return (
    <div className="rounded-[24px] border border-line bg-paper p-5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-muted">{title}</span>
        <span
          className={`rounded-full px-3 py-0.5 text-xs font-semibold ${BADGE[level].className}`}
        >
          {BADGE[level].text}
        </span>
      </div>
      <div className="mt-2 font-display text-3xl leading-tight">{big}</div>
      <p className="mt-2 text-sm text-muted">{text}</p>
    </div>
  );
}

export default function GrowingConditions({ ind }: { ind: AgroIndicators }) {
  const a = ind.annual;
  const f = ind.frost;
  const sm = ind.soilMoisture;

  // Water
  const ai = a.aridityIndex;
  const waterLevel: Level = ai === null ? "watch" : ai < 0.2 ? "risk" : ai < 0.5 ? "watch" : "good";
  const waterBig = a.dryMonths.length
    ? `${a.dryMonths.length} dry months`
    : "Enough rain";
  const waterText = a.dryMonths.length
    ? `In ${months(a.dryMonths)} rain gives less than half of what crops need. Crops then live on water stored in the soil, or on irrigation.`
    : "Rain usually covers what crops need through the year.";

  // Frost
  const hasFrost = f.yearsWithFrost > 0;
  const frostLevel: Level = !hasFrost ? "good" : "watch";
  const frostBig =
    !hasFrost || f.lastSpringDoy === null
      ? "Frost is rare"
      : `Last frost ≈ ${doyLabel(f.lastSpringDoy)}`;
  const frostText = !hasFrost
    ? "No frost was seen in the years checked."
    : `Frost has come as late as ${f.latestSpringDoy === null ? "n/a" : doyLabel(f.latestSpringDoy)}. Sow frost-sensitive crops (chickpea, sunflower, corn) after that. Autumn frost usually starts around ${f.firstAutumnDoy === null ? "n/a" : doyLabel(f.firstAutumnDoy)}.`;

  // Heat
  const hot = round(a.heatDays35) ?? 0;
  const hotMonths = ind.months.filter((m) => (m.heatDays[32] ?? 0) >= 2).map((m) => m.month);
  const heatLevel: Level = hot >= 20 ? "risk" : hot >= 5 ? "watch" : "good";
  const heatText = hotMonths.length
    ? `Hot spells are common in ${months(hotMonths)}. Crops that flower then can lose grain.`
    : "Very hot days are uncommon here.";

  // Soil moisture now
  const pct = sm ? Math.round(sm.pct) : null;
  const soilLevel: Level =
    pct === null ? "watch" : pct <= -25 ? "risk" : pct <= -10 || pct >= 15 ? "watch" : "good";
  const soilBig =
    pct === null
      ? "Not enough data"
      : Math.abs(pct) < 10
        ? "Normal"
        : `${Math.abs(pct)}% ${pct < 0 ? "drier" : "wetter"} than usual`;
  const soilText =
    pct === null
      ? "Choose the 10-year range to compare with earlier years."
      : pct <= -10
        ? "The soil is drier than usual for this time of year. Check soil water before sowing."
        : pct >= 15
          ? "The soil is wetter than usual. Check that machines can enter the field."
          : "Soil water is close to normal for this time of year.";

  const monthly = ind.months.map((m) => ({
    label: m.label,
    rain: round(m.precipMm),
    need: round(m.et0Mm),
    max: round(m.tmax),
    min: round(m.tmin),
    frost: round(m.frostDays),
    hot: round(m.heatDays[32]),
  }));

  return (
    <section className="rounded-[28px] border border-line bg-paper p-6">
      <h2 className="font-display text-3xl">Your weather</h2>
      <p className="mb-5 text-sm text-muted">
        Typical year, from {Math.round(ind.years)} years of NASA data.
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Water" level={waterLevel} big={waterBig} text={waterText} />
        <Card title="Frost" level={frostLevel} big={frostBig} text={frostText} />
        <Card title="Heat" level={heatLevel} big={`${hot} very hot days a year`} text={heatText} />
        <Card title="Soil moisture now" level={soilLevel} big={soilBig} text={soilText} />
      </div>

      <details className="group mt-6 rounded-2xl border border-line p-4">
        <summary className="cursor-pointer font-medium">
          Show month-by-month charts
        </summary>
        <div className="mt-4 grid gap-6 md:grid-cols-2">
          <div>
            <h3 className="font-medium">Rain and crop water need</h3>
            <p className="mb-2 text-xs text-muted">
              In months where the brown bar is taller, rain is not enough.
            </p>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthly}>
                  <CartesianGrid stroke="#e4ded2" vertical={false} />
                  <XAxis dataKey="label" tick={tick} />
                  <YAxis tick={tick} width={40} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="rain" name="Rain (mm)" fill="#7d8f69" />
                  <Bar dataKey="need" name="Water need (mm)" fill="#8b7355" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div>
            <h3 className="font-medium">Temperature, frost and hot days</h3>
            <p className="mb-2 text-xs text-muted">
              Lines: average day and night temperature. Bars: frost nights and
              hot days (32 °C or more) in a typical month.
            </p>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={monthly}>
                  <CartesianGrid stroke="#e4ded2" vertical={false} />
                  <XAxis dataKey="label" tick={tick} />
                  <YAxis yAxisId="t" tick={tick} unit="°" width={40} />
                  <YAxis yAxisId="d" orientation="right" tick={tick} width={30} />
                  <Tooltip />
                  <Legend />
                  <Bar yAxisId="d" dataKey="frost" name="Frost nights" fill="#8fa3a8" />
                  <Bar yAxisId="d" dataKey="hot" name="Hot days" fill="#c9b08f" />
                  <Line yAxisId="t" dataKey="max" name="Day (°C)" stroke="#8b7355" strokeWidth={2} dot={false} />
                  <Line yAxisId="t" dataKey="min" name="Night (°C)" stroke="#3f4a3a" strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </details>

      <details className="mt-3 rounded-2xl border border-line p-4 text-sm text-muted">
        <summary className="cursor-pointer font-medium text-espresso">
          Technical details
        </summary>
        <ul className="mt-3 list-disc space-y-1 pl-5">
          <li>
            Rain per year: {round(a.precipMm) ?? "n/a"} mm. Reference
            evapotranspiration (ET0, FAO-56): {round(a.et0Mm) ?? "n/a"} mm.
          </li>
          <li>
            Aridity index (rain ÷ ET0): {ai === null ? "n/a" : ai.toFixed(2)}
            {a.aridityClass ? ` (${a.aridityClass})` : ""}.
          </li>
          <li>
            Frost days per year: {round(a.frostDays) ?? "n/a"}, of which{" "}
            {round(a.hardFrostDays) ?? "n/a"} below -5 °C. Frost-free season:{" "}
            {f.frostFreeDays ?? "n/a"} days ({f.yearsChecked} years checked).
          </li>
          <li>
            Heavy-rain days (20 mm or more) per year:{" "}
            {a.heavyRainDays === null ? "n/a" : a.heavyRainDays.toFixed(1)}.
          </li>
          {sm && (
            <li>
              Root-zone soil wetness, last 30 days: {sm.recent.toFixed(2)},
              usual: {sm.usual.toFixed(2)} (0 = dry, 1 = saturated;{" "}
              {sm.baselineYears} earlier years).
            </li>
          )}
          {ind.et0FallbackShare > 0.05 && (
            <li>
              ET0 used the temperature-only Hargreaves formula on{" "}
              {Math.round(ind.et0FallbackShare * 100)}% of days.
            </li>
          )}
        </ul>
      </details>
    </section>
  );
}