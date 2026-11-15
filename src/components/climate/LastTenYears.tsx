"use client";

import { useMemo } from "react";
import MethodBadge from "@/components/ml/MethodBadge";
import { computeIndicators } from "@/lib/nasa/indicators";
import { groupYears, pooledSummary, splitYears, trendTest, type TrendTest, type YearType } from "@/lib/nasa/stats";
import type { ClimateRecord } from "@/lib/nasa/use-climate";
import { evaluateStrategies, type StrategyResult, type TerrainInput } from "@/lib/rotation/engine";
import type { FarmProfile } from "@/lib/schemas/farm";

const TYPES: { id: YearType; label: string }[] = [
  { id: "dry", label: "Dry years" },
  { id: "normal", label: "Normal years" },
  { id: "wet", label: "Wet years" },
];

function trendLine(name: string, t: TrendTest | null, unit: string, digits: number): string {
  if (!t) return `${name}: not enough years to judge.`;
  const size = Math.abs(t.perDecade);
  const dir = t.perDecade > 0 ? "rising" : "falling";
  if (size < (unit === "%" ? 3 : 0.1)) return `${name}: no clear change.`;
  if (!t.clear)
    return `${name}: ${dir} about ${size.toFixed(digits)}${unit} per decade, but with so few years this could still be chance.`;
  return `${name}: ${dir} about ${size.toFixed(digits)}${unit} per decade. A clear trend, not chance.`;
}

const best = (rs: StrategyResult[]) => [...rs].sort((a, b) => b.overall - a.overall)[0];

/** Trends and dry/normal/wet years over the record, and the best option in each. */
export default function LastTenYears({
  record,
  farm,
  terrain,
}: {
  record: ClimateRecord;
  farm: FarmProfile;
  terrain: TerrainInput;
}) {
  const data = useMemo(() => {
    const years = splitYears(record.points);
    const temp = trendTest(years.map((y) => y.meanTemp));
    const rains = years.map((y) => y.precipMm);
    const rainTest = trendTest(rains);
    const meanRain =
      rains.filter((v): v is number => v !== null).reduce((a, v) => a + v, 0) /
      Math.max(1, rains.filter((v) => v !== null).length);
    const rain = rainTest && meanRain > 0 ? { ...rainTest, perDecade: (rainTest.perDecade / meanRain) * 100 } : null;

    const groups = groupYears(years);
    const byType = groups
      ? TYPES.map(({ id }) => {
          const members = groups.years.filter((y) => y.type === id);
          if (!members.length) return { id, count: 0, rain: groups.centers[id], best: null };
          const pts = members.flatMap((y) => y.points);
          const results = evaluateStrategies(
            farm,
            pooledSummary(pts, record.retrievedAt),
            computeIndicators(pts, farm.latitude, record.elevationM),
            terrain,
          );
          return { id, count: members.length, rain: groups.centers[id], best: best(results) };
        })
      : null;
    return { years: years.length, temp, rain, byType };
  }, [record, farm, terrain]);

  const winners = data.byType?.map((t) => t.best?.id).filter(Boolean) ?? [];
  const sameEverywhere = winners.length > 0 && winners.every((w) => w === winners[0]);
  const dryBest = data.byType?.find((t) => t.id === "dry")?.best;

  return (
    <section className="rounded-[28px] border border-line bg-paper p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-3xl">Your last {data.years} years</h2>
        <MethodBadge method="statistics" />
      </div>
      <ul className="mt-3 space-y-1 text-sm">
        <li>{trendLine("Temperature", data.temp, " °C", 1)}</li>
        <li>{trendLine("Rain", data.rain, "%", 0)}</li>
      </ul>

      {data.byType && (
        <>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {data.byType.map((t) => (
              <div key={t.id} className="rounded-2xl bg-sand/60 p-4">
                <div className="text-sm font-medium">
                  {TYPES.find((x) => x.id === t.id)!.label}
                </div>
                <div className="text-xs text-muted">
                  {t.count} of {data.years} · about {Math.round(t.rain)} mm rain
                </div>
                <div className="mt-2 text-sm">
                  {t.best ? (
                    <>
                      Best: <b>{t.best.name}</b> ({t.best.overall})
                    </>
                  ) : (
                    "No years in this group."
                  )}
                </div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm">
            {sameEverywhere
              ? `${data.byType.find((t) => t.best)?.best?.name} does best in dry, normal and wet years. A steady choice.`
              : dryBest
                ? `The best option changes with the weather. In dry years, ${dryBest.name.toLowerCase()} holds up best.`
                : "The best option changes with the weather."}
          </p>
        </>
      )}

      <p className="mt-3 text-xs text-muted">
        Trends use the Mann-Kendall test and Sen&apos;s slope. Years are grouped
        by rain with k-means clustering. With only {data.years} years, treat
        both as a guide. These are statistics; the best option in each group is
        chosen by Wagro&apos;s rule-based scores and rotation search, not by the
        statistics.
      </p>
    </section>
  );
}
