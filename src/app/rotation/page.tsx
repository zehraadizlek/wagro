"use client";

import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";
import GrowingConditions from "@/components/climate/GrowingConditions";
import LastTenYears from "@/components/climate/LastTenYears";
import UnusualMonths from "@/components/climate/UnusualMonths";
import CropRoles from "@/components/rotation/CropRoles";
import RecommendationCard from "@/components/rotation/RecommendationCard";
import ScenarioPanel from "@/components/rotation/ScenarioPanel";
import SeasonTimeline from "@/components/rotation/SeasonTimeline";
import StrategyCards from "@/components/rotation/StrategyCards";
import PageHeader from "@/components/ui/PageHeader";
import dynamic from "next/dynamic";

const SatelliteMap = dynamic(() => import("@/components/space/SatelliteMap"), { ssr: false });
const PlantGrowth = dynamic(() => import("@/components/space/PlantGrowth"), { ssr: false });
const FieldRiskMap = dynamic(() => import("@/components/space/FieldRiskMap"), { ssr: false });
import {
  NO_CHANGE,
  isNoChange,
  scenarioClimate,
  type Scenario,
} from "@/lib/nasa/scenario";
import { useClimate } from "@/lib/nasa/use-climate";
import { CRITERION_MEANING, buildRecommendation, evaluateStrategies } from "@/lib/rotation/engine";
import { checkCalendar, phenology } from "@/lib/features/phenology";
import { useNdvi } from "@/lib/features/use-ndvi";
import { useAnomalies } from "@/lib/ml/use-anomalies";
import { useFarm } from "@/lib/storage/use-farm";
import { useTerrain } from "@/lib/terrain/use-terrain";

export default function Page() {
  const { farm, ready } = useFarm();
  const climate = useClimate(farm);
  const field = useTerrain(farm);
  const anomalies = useAnomalies(farm);
  const ndvi = useNdvi(farm?.latitude ?? null, farm?.longitude ?? null);
  const calendarCheck = useMemo(
    () =>
      farm && ndvi.points
        ? checkCalendar(phenology(ndvi.points), farm.currentCrop, farm.latitude) ?? undefined
        : undefined,
    [farm, ndvi.points],
  );
  const terrainInput = useMemo(
    () => (field.terrain ? { meanSlopePct: field.terrain.meanSlopePct } : null),
    [field.terrain],
  );

  const [scenario, setScenario] = useState<Scenario>(NO_CHANGE);
  // Keeps the sliders smooth while the scores are recalculated.
  const activeScenario = useDeferredValue(scenario);

  const baseResults = useMemo(() => {
    if (!farm || climate.status === "loading" || climate.status === "idle")
      return null;
    return evaluateStrategies(farm, climate.climatology, climate.indicators, terrainInput);
  }, [farm, climate.status, climate.climatology, climate.indicators, terrainInput]);

  // Same daily record, shifted by the scenario.
  const shiftedClimate = useMemo(() => {
    if (!farm || !climate.record || isNoChange(activeScenario)) return null;
    const r = climate.record;
    return scenarioClimate(r.points, activeScenario, farm.latitude, r.elevationM, r.retrievedAt);
  }, [farm, climate.record, activeScenario]);

  const results = useMemo(() => {
    if (!farm || !baseResults || !shiftedClimate) return baseResults;
    return evaluateStrategies(farm, shiftedClimate.climatology, shiftedClimate.indicators, terrainInput);
  }, [farm, baseResults, shiftedClimate, terrainInput]);

  const indicators = shiftedClimate?.indicators ?? climate.indicators;

  const rec = useMemo(
    () =>
      farm && results
        ? buildRecommendation(farm, results, {
            unusualMonths: anomalies.recent.map((m) => ({ ym: m.ym, summary: m.summary })),
            calendarCheck,
          })
        : null,
    [farm, results, anomalies.recent, calendarCheck],
  );

  const bestId = results
    ? [...results].sort((a, b) => b.overall - a.overall)[0].id
    : null;

  return (
    <>
      <PageHeader
        eyebrow={farm ? farm.name : "Results"}
        title="Your results"
        description="Based on 10 years of NASA weather data for the area around your field (about 50 km grid) and your answers."
      />

      {ready && !farm && (
        <div className="rounded-[28px] border border-line bg-paper p-8">
          <p className="text-lg">Answer a few questions about your field first.</p>
          <Link href="/farm" className="btn btn-primary mt-5">
            Start
          </Link>
        </div>
      )}

      {farm && !results && (
        <div className="space-y-4">
          <p className="text-sm text-muted">Loading NASA data for your area…</p>
          <div className="h-48 animate-pulse rounded-[28px] bg-sand" />
          <div className="h-48 animate-pulse rounded-[28px] bg-sand" />
        </div>
      )}

      {farm && results && (
        <div className="space-y-10">
          {climate.status === "error" && (
            <div className="rounded-[24px] border border-clay/40 bg-paper p-5 text-sm">
              <p className="font-medium text-clay">Weather data could not be loaded.</p>
              <p className="mt-1 text-muted">Results below leave weather out.</p>
            </div>
          )}

          {rec && <RecommendationCard rec={rec} results={results} />}

          {indicators && <GrowingConditions ind={indicators} />}

          {climate.record && (
            <LastTenYears record={climate.record} farm={farm} terrain={terrainInput} />
          )}

          <UnusualMonths anomalies={anomalies} />

          <FieldRiskMap
            lat={farm.latitude}
            lng={farm.longitude}
            terrain={field.terrain}
            status={field.status}
          />

          <StrategyCards results={results} bestId={bestId} />

          <SeasonTimeline results={results} indicators={indicators} farm={farm} />

          <PlantGrowth lat={farm.latitude} lng={farm.longitude} crop={farm.currentCrop} />

          <SatelliteMap lat={farm.latitude} lng={farm.longitude} />

          <ScenarioPanel
            scenario={scenario}
            onChange={setScenario}
            base={baseResults!}
            shifted={results}
            disabled={!climate.record}
          />

          <details className="rounded-[28px] border border-line bg-paper p-6">
            <summary className="cursor-pointer font-medium">
              How the scores are worked out
            </summary>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left">
                    <th className="py-2 pr-3 font-medium text-muted">Score</th>
                    {results.map((r) => (
                      <th key={r.id} className="py-2 pr-3 text-right font-medium">
                        {r.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {results[0].criteria.map((c, i) => (
                    <tr key={c.id} className="border-b border-line/60">
                      <td className="py-2 pr-3">
                        {c.label}
                        <div className="text-xs text-muted">{CRITERION_MEANING[c.id]}</div>
                      </td>
                      {results.map((r) => (
                        <td key={r.id} className="py-2 pr-3 text-right tabular-nums">
                          {r.criteria[i].score ?? "–"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-muted">
              0 to 100, higher is better. Scores come from simple rules and
              first estimates for each crop, not from a trained AI model.
            </p>
          </details>

          <details className="rounded-[28px] border border-line bg-paper p-6">
            <summary className="cursor-pointer font-medium">How crops help your soil</summary>
            <div className="mt-4">
              <CropRoles />
            </div>
          </details>

          <p className="text-sm text-muted">
            Wagro helps you think it through. Your own experience and a local
            adviser should have the final say.{" "}
            <Link href="/how" className="underline hover:text-espresso">
              How Wagro works
            </Link>
          </p>

          <div className="grid grid-cols-2 gap-3">
            <Link href="/farm" className="btn btn-ghost w-full">
              Change my answers
            </Link>
            <Link href="/report" className="btn btn-primary w-full">
              Print report
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
