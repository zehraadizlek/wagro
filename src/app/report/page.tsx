"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  XAxis,
  YAxis,
} from "recharts";
import RecommendationCard from "@/components/rotation/RecommendationCard";
import SeasonTimeline from "@/components/rotation/SeasonTimeline";
import { doyLabel } from "@/lib/nasa/indicators";
import { useClimate } from "@/lib/nasa/use-climate";
import { CROP_PARAMS, PARAMETERS_NOTE } from "@/lib/rotation/crops";
import {
  CRITERION_MEANING,
  ENGINE_NOTE,
  buildRecommendation,
  evaluateStrategies,
} from "@/lib/rotation/engine";
import { useFarm } from "@/lib/storage/use-farm";
import { useTerrain } from "@/lib/terrain/use-terrain";

const COLORS = ["#8b7355", "#7d8f69", "#3f4a3a", "#b9a77f", "#5f7052"];
const label = (s: string) =>
  s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, " ");

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="break-inside-avoid rounded-[24px] border border-line bg-paper p-6 print:rounded-none print:border-x-0 print:border-t-0 print:px-0">
      <h2 className="mb-3 font-display text-3xl">{title}</h2>
      {children}
    </section>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-line/60 py-1.5 text-sm last:border-0">
      <span className="text-muted">{k}</span>
      <span className="text-right font-medium">{v}</span>
    </div>
  );
}

export default function Page() {
  const { farm, ready } = useFarm();
  const climate = useClimate(farm);
  const field = useTerrain(farm);
  const slope = field.terrain?.meanSlopePct ?? null;

  const results = useMemo(() => {
    if (!farm || climate.status === "loading" || climate.status === "idle")
      return null;
    return evaluateStrategies(
      farm,
      climate.summary,
      climate.indicators,
      slope === null ? null : { meanSlopePct: slope },
    );
  }, [farm, climate.status, climate.summary, climate.indicators, slope]);

  const rec = useMemo(
    () => (farm && results ? buildRecommendation(farm, results) : null),
    [farm, results],
  );

  if (ready && !farm) {
    return (
      <div className="rounded-[28px] border border-line bg-paper p-8">
        <p className="text-lg">Save your farm profile to create a report.</p>
        <Link
          href="/farm"
          className="btn btn-primary mt-5"
        >
          Go to Farm profile
        </Link>
      </div>
    );
  }

  if (!farm || !results || !rec) {
    return <div className="h-96 animate-pulse rounded-[28px] bg-sand" />;
  }

  const chartData = results[0].criteria.map((c, i) => ({
    criterion: c.label,
    ...Object.fromEntries(
      results.map((r) => [r.name, r.criteria[i].score ?? 0]),
    ),
  }));
  const s = climate.summary;
  const ind = climate.indicators;
  const n0 = (v: number | null, unit: string) =>
    v === null ? "n/a" : `${Math.round(v)} ${unit}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs font-medium uppercase tracking-[0.16em] text-accent">
            Decision report
          </div>
          <h1 className="font-display text-5xl leading-none">{farm.name}</h1>
          <p className="mt-2 text-sm text-muted">
            Created on {new Date().toLocaleDateString()} with Wagro, a prototype
            decision-support tool.
          </p>
        </div>
        <button
          onClick={() => window.print()}
          className="btn btn-primary print:hidden"
        >
          Print or save as PDF
        </button>
      </div>

      <RecommendationCard rec={rec} results={results} />

      <Section title="1. Farm profile (entered by you)">
        <Row k="Location" v={`${farm.latitude.toFixed(4)}, ${farm.longitude.toFixed(4)}`} />
        <Row k="Area" v={`${farm.areaHa} ha`} />
        <Row k="Current crop" v={label(farm.currentCrop)} />
        <Row
          k="Previous crops"
          v={farm.previousCrops.length ? farm.previousCrops.map(label).join(", ") : "None entered"}
        />
        <Row k="Irrigation" v={label(farm.irrigation)} />
        <Row
          k="Priorities"
          v={farm.priorities.length ? farm.priorities.map(label).join(", ") : "None selected"}
        />
        <Row
          k="Crops you can sell"
          v={farm.marketCrops.length ? farm.marketCrops.map(label).join(", ") : "Any"}
        />
        <Row k="Row-crop planter" v={farm.hasRowPlanter ? "Yes" : "No"} />
        <Row k="Open to cover crops" v={farm.coverCropsOk ? "Yes" : "No"} />
      </Section>

      <Section title="2. Climate (NASA data)">
        {s ? (
          <>
            <Row k="Mean temperature, last 12 months" v={s.meanTemp === null ? "n/a" : `${s.meanTemp.toFixed(1)} °C`} />
            <Row k="Precipitation, scaled to a year" v={s.annualPrecipMm === null ? "n/a" : `${Math.round(s.annualPrecipMm)} mm`} />
            <Row k="Period" v={`${s.start} to ${s.end}`} />
            <Row k="Missing days" v={`${s.missingDays} of ${s.days}`} />
            <Row k="Retrieved" v={new Date(s.retrievedAt).toLocaleString()} />
            {ind && (
              <>
                <h3 className="mt-4 mb-1 text-sm font-medium">
                  Growing conditions, average of the last {Math.round(ind.years)} years
                </h3>
                <Row k="Precipitation per year" v={n0(ind.annual.precipMm, "mm")} />
                <Row k="Reference evapotranspiration (ET0) per year" v={n0(ind.annual.et0Mm, "mm")} />
                <Row
                  k="Aridity (rain ÷ ET0)"
                  v={ind.annual.aridityIndex === null ? "n/a" : `${ind.annual.aridityIndex.toFixed(2)} (${ind.annual.aridityClass})`}
                />
                <Row k="Frost days per year (min below 0 °C)" v={n0(ind.annual.frostDays, "days")} />
                <Row k="Hot days per year (max 35 °C or more)" v={n0(ind.annual.heatDays35, "days")} />
                <Row k="Heavy-rain days per year (20 mm or more)" v={ind.annual.heavyRainDays === null ? "n/a" : `${ind.annual.heavyRainDays.toFixed(1)} days`} />
                <Row
                  k="Typical last spring / first autumn frost"
                  v={
                    ind.frost.lastSpringDoy === null && ind.frost.firstAutumnDoy === null
                      ? "Frost is rare"
                      : `${ind.frost.lastSpringDoy === null ? "n/a" : doyLabel(ind.frost.lastSpringDoy)} / ${ind.frost.firstAutumnDoy === null ? "n/a" : doyLabel(ind.frost.firstAutumnDoy)}`
                  }
                />
                {ind.soilMoisture && (
                  <Row
                    k="Root-zone soil wetness, last 30 days vs usual"
                    v={`${ind.soilMoisture.pct > 0 ? "+" : ""}${Math.round(ind.soilMoisture.pct)}%`}
                  />
                )}
              </>
            )}
            <p className="mt-3 text-xs text-muted">
              Gridded estimates for the cell around your pin, not measurements
              taken inside your field. The Climate page shows a longer trend.
            </p>
          </>
        ) : (
          <p className="text-sm text-muted">
            Climate data could not be loaded ({climate.error}). Scores in this
            report leave out climate suitability.
          </p>
        )}
      </Section>

      <Section title="3. Soil (entered by you)">
        <Row k="Soil type" v={label(farm.soilType)} />
        <Row k="Soil pH" v={farm.soilPh === null ? "Not entered" : String(farm.soilPh)} />
        <Row k="Average slope (elevation data)" v={slope === null ? "Not available" : `${slope.toFixed(1)}%`} />
        <p className="mt-3 text-xs text-muted">
          No satellite or database soil data is used in this version. Soil
          values come only from you.
        </p>
      </Section>

      <Section title="4. Comparing the options">
        <div className="overflow-x-auto">
          <BarChart width={760} height={300} data={chartData}>
            <CartesianGrid stroke="#e4ded2" vertical={false} />
            <XAxis dataKey="criterion" tick={{ fontSize: 12, fill: "#6b665c" }} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: "#6b665c" }} width={36} />
            <Legend />
            {results.map((r, i) => (
              <Bar key={r.id} dataKey={r.name} fill={COLORS[i]} isAnimationActive={false} />
            ))}
          </BarChart>
        </div>
        <table className="mt-5 w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left">
              <th className="py-2 pr-3 font-medium text-muted">What it measures</th>
              {results.map((r) => (
                <th key={r.id} className="py-2 pr-3 text-right font-medium">
                  {r.name}
                  <div className="text-xs font-normal text-muted">
                    {r.sequence.map((c) => CROP_PARAMS[c].label).join(" → ")}
                    {r.coverCrops && " + cover crop"}
                  </div>
                  <div className="text-[11px] font-normal text-muted">
                    {r.method === "optimization" ? "Optimization" : "Rule-based"}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {results[0].criteria.map((c, i) => (
              <tr key={c.id} className="border-b border-line/60">
                <td className="py-2 pr-3">
                  <span className="font-medium">{c.label}</span>
                  <div className="text-xs text-muted">{CRITERION_MEANING[c.id]}</div>
                </td>
                {results.map((r) => (
                  <td key={r.id} className="py-2 pr-3 text-right tabular-nums">
                    {r.criteria[i].score ?? "n/a"}
                  </td>
                ))}
              </tr>
            ))}
            <tr>
              <td className="py-2 pr-3 font-medium">Overall</td>
              {results.map((r) => (
                <td key={r.id} className="py-2 pr-3 text-right font-display text-2xl tabular-nums">
                  {r.overall}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
        <p className="mt-2 text-xs text-muted">
          Scores run from 0 to 100. Higher is better for the farm under these
          rules.
        </p>
        <details className="mt-4 text-sm">
          <summary className="cursor-pointer font-medium">
            How each score was calculated
          </summary>
          <div className="mt-3 space-y-4">
            {results.map((r) => (
              <div key={r.id}>
                <h3 className="font-medium">{r.name}</h3>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-muted">
                  {r.criteria.map((c) => (
                    <li key={c.id}>
                      <span className="text-espresso">{c.label}:</span> {c.explanation}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </details>
        <div className="mt-6">
          <SeasonTimeline results={results} indicators={ind} farm={farm} />
        </div>
      </Section>

      <Section title="5. Data sources">
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
          <li>
            Climate: NASA POWER daily data, a NASA product. Temperature
            (T2M, T2M_MAX, T2M_MIN), precipitation (PRECTOTCORR), humidity
            (RH2M), wind (WS2M), solar radiation (ALLSKY_SFC_SW_DWN) and soil
            wetness (GWETTOP, GWETROOT). POWER builds these from the MERRA-2
            reanalysis and CERES satellite products.
          </li>
          <li>Evapotranspiration: computed by Wagro with the FAO-56 Penman-Monteith method from the values above.</li>
          <li>Satellite maps and plant cover: NASA GIBS imagery of MODIS (vegetation index, land surface temperature), SMAP (root-zone soil moisture) and GRACE/GRACE-FO (water storage).</li>
          <li>Slope and low spots: AWS Terrain Tiles elevation data (NASA SRTM where available, other elevation models elsewhere), about 30 m detail.</li>
          <li>Farm and soil details: entered by the user, not verified.</li>
          <li>Crop parameters: prototype estimates made by the project team, not yet validated by an agronomist.</li>
          <li>Unusual months: Isolation Forest (unsupervised ML) on 30 years of NASA POWER data at the pin. It does not detect crop damage.</li>
          <li>Map tiles: OpenStreetMap contributors.</li>
        </ul>
      </Section>

      <Section title="6. Uncertainty and limitations">
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
          <li>{ENGINE_NOTE}</li>
          <li>{PARAMETERS_NOTE}</li>
          <li>Climate values are gridded estimates and not field measurements.</li>
          <li>Climate fit is half annual temperature and rain against assumed crop ranges, half how often frost, heat and drought hit the crop in its growing months.</li>
          <li>&quot;Best balance under Wagro&apos;s rules&quot; comes from searching every allowed rotation with the same rules (Optimization). It is not a separate prediction.</li>
          <li>Sowing and harvest months are typical mid-latitude dates. In mild-winter or tropical places they can be months off; the results page compares them with satellite plant cover.</li>
          <li>Season calendars use typical sowing and harvest months, not your own dates. Soil wetness comes from a model, not a probe in your field.</li>
          <li>Scores show relative fit under these rules. They do not predict yield, profit or disease risk.</li>
          <li>This report supports a conversation with a local agronomist and does not replace professional advice.</li>
        </ul>
      </Section>
    </div>
  );
}
