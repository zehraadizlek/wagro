"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import PageHeader from "@/components/ui/PageHeader";
import RecommendationCard from "@/components/rotation/RecommendationCard";
import { useClimate } from "@/lib/nasa/use-climate";
import { CROP_PARAMS, PARAMETERS_NOTE } from "@/lib/rotation/crops";
import {
  ENGINE_NOTE,
  buildRecommendation,
  evaluateStrategies,
  type StrategyResult,
} from "@/lib/rotation/engine";
import { useFarm } from "@/lib/storage/use-farm";

const COLORS = ["#b8481f", "#55612f", "#2b1d14"];

function StrategyCard({
  s,
  best,
  index,
}: {
  s: StrategyResult;
  best: boolean;
  index: number;
}) {
  return (
    <article
      style={{ animationDelay: `${index * 80}ms` }}
      className={`rise rounded-[28px] border p-6 ${
        best ? "border-terracotta bg-paper" : "border-line bg-paper"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          {best && (
            <span className="mb-2 inline-block rounded-full bg-terracotta px-3 py-1 text-xs font-medium text-paper">
              Highest score under these rules
            </span>
          )}
          <h2 className="font-display text-3xl">{s.name}</h2>
          <p className="mt-1 text-sm text-muted">{s.description}</p>
        </div>
        <div className="text-right">
          <div className="font-display text-6xl leading-none text-terracotta">
            {s.overall}
          </div>
          <div className="text-xs text-muted">out of 100</div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {s.sequence.map((c, i) => (
          <span key={i} className="flex items-center gap-2">
            <span className="rounded-full bg-sage px-3 py-1 text-sm">
              {CROP_PARAMS[c].label}
            </span>
            {i < s.sequence.length - 1 && <span className="text-muted">→</span>}
          </span>
        ))}
      </div>

      <div className="mt-6 space-y-4">
        {s.criteria.map((c) => (
          <div key={c.id}>
            <div className="flex justify-between text-sm">
              <span className="font-medium">
                {c.label}
                <span className="ml-2 text-xs text-muted">
                  weight {Math.round(c.weight * 100)}%
                </span>
              </span>
              <span>{c.score === null ? "n/a" : c.score}</span>
            </div>
            <div className="mt-1 h-2 rounded-full bg-sand">
              <div
                className="h-2 rounded-full bg-terracotta"
                style={{ width: `${c.score ?? 0}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-muted">{c.explanation}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl bg-sage/50 p-4">
          <h3 className="mb-2 text-sm font-medium">Advantages</h3>
          {s.advantages.length ? (
            <ul className="list-disc space-y-1 pl-5 text-xs text-muted">
              {s.advantages.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted">No criterion scored 60 or more.</p>
          )}
        </div>
        <div className="rounded-2xl bg-sand/70 p-4">
          <h3 className="mb-2 text-sm font-medium">Risks</h3>
          {s.risks.length ? (
            <ul className="list-disc space-y-1 pl-5 text-xs text-muted">
              {s.risks.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted">No criterion scored below 60.</p>
          )}
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-line p-4 text-xs text-muted">
        <span className="font-medium text-espresso">
          Data confidence: {s.confidence.level}.
        </span>
        <ul className="mt-1 list-disc space-y-1 pl-5">
          {s.confidence.reasons.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      </div>
    </article>
  );
}

export default function Page() {
  const { farm, ready } = useFarm();
  const climate = useClimate(farm);

  const results = useMemo(() => {
    if (!farm || climate.status === "loading" || climate.status === "idle")
      return null;
    return evaluateStrategies(farm, climate.summary);
  }, [farm, climate.status, climate.summary]);

  const rec = useMemo(
    () => (farm && results ? buildRecommendation(farm, results) : null),
    [farm, results],
  );

  const bestId = results
    ? [...results].sort((a, b) => b.overall - a.overall)[0].id
    : null;

  const chartData = results
    ? results[0].criteria.map((c, i) => ({
        criterion: c.label,
        ...Object.fromEntries(
          results.map((r) => [r.name, r.criteria[i].score ?? 0]),
        ),
      }))
    : [];

  return (
    <>
      <PageHeader
        eyebrow="Rotation engine"
        title={
          <>
            Compare your <em className="text-terracotta">rotations</em>
          </>
        }
        description="Three three-season strategies scored on water, nitrogen, soil health, diversity, climate and soil fit. Start with the summary, then open the details."
      />

      {ready && !farm && (
        <div className="rounded-[28px] border border-line bg-paper p-8">
          <p className="text-lg">Save your farm profile to see rotation options.</p>
          <Link
            href="/farm"
            className="mt-5 inline-block rounded-full bg-terracotta px-6 py-3 text-sm font-semibold text-paper hover:bg-terracotta-dark"
          >
            Go to Farm profile
          </Link>
        </div>
      )}

      {farm && !results && (
        <div className="space-y-4">
          <div className="h-48 animate-pulse rounded-[28px] bg-sand" />
          <div className="h-48 animate-pulse rounded-[28px] bg-sand" />
        </div>
      )}

      {results && (
        <div className="space-y-6">
          {climate.status === "error" && (
            <div className="rounded-[24px] border border-terracotta/40 bg-paper p-5 text-sm">
              <p className="font-medium text-terracotta">
                Climate data could not be loaded
              </p>
              <p className="mt-1 text-muted">
                {climate.error}. Scores below leave out climate suitability and
                rescale the other weights.
              </p>
            </div>
          )}

          {rec && <RecommendationCard rec={rec} results={results} />}

          <h2 className="pt-4 font-display text-3xl">Detailed breakdown</h2>
          {results.map((s, i) => (
            <StrategyCard key={s.id} s={s} best={s.id === bestId} index={i} />
          ))}

          <section className="rounded-[28px] border border-line bg-paper p-6">
            <h2 className="font-display text-3xl">Criteria side by side</h2>
            <div className="mt-4 h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid stroke="#e6d8c3" vertical={false} />
                  <XAxis
                    dataKey="criterion"
                    tick={{ fontSize: 12, fill: "#7a6352" }}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fontSize: 12, fill: "#7a6352" }}
                    width={36}
                  />
                  <Tooltip />
                  <Legend />
                  {results.map((r, i) => (
                    <Bar key={r.id} dataKey={r.name} fill={COLORS[i]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="rounded-[28px] border border-line bg-sand/60 p-6 text-sm text-muted">
            <h3 className="mb-2 font-medium text-espresso">How to read this</h3>
            <ul className="list-disc space-y-1 pl-5">
              <li>{ENGINE_NOTE}</li>
              <li>{PARAMETERS_NOTE}</li>
              <li>
                Results support a discussion with an agronomist. They are not
                instructions and do not replace local advice.
              </li>
            </ul>
          </section>
        </div>
      )}
    </>
  );
}
