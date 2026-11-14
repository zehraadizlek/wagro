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
import SeasonTimeline from "@/components/rotation/SeasonTimeline";
import { useClimate } from "@/lib/nasa/use-climate";
import { CROP_PARAMS } from "@/lib/rotation/crops";
import {
  buildRecommendation,
  evaluateStrategies,
  type StrategyResult,
} from "@/lib/rotation/engine";
import { useFarm } from "@/lib/storage/use-farm";

const COLORS = ["#8b7355", "#7d8f69", "#3f4a3a"];

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
      className={`rise rounded-[28px] border p-6 ${best ? "border-accent bg-paper" : "border-line bg-paper"
        }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          {best && (
            <span className="mb-2 inline-block rounded-full bg-accent px-3 py-1 text-xs font-medium text-paper">
              Highest score under these rules
            </span>
          )}
          <h2 className="font-display text-3xl">{s.name}</h2>
          <p className="mt-1 text-sm text-muted">{s.description}</p>
        </div>
        <div className="text-right">
          <div className="font-display text-6xl leading-none text-accent">
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
                className="h-2 rounded-full bg-accent"
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
            Compare your <em className="text-accent">rotations</em>
          </>
        }
        description="We compare your current rotation with two other options and show which one fits your farm best."
      />

      {ready && !farm && (
        <div className="rounded-[28px] border border-line bg-paper p-8">
          <p className="text-lg">Save your farm profile to see rotation options.</p>
          <Link
            href="/farm"
            className="btn btn-primary mt-5"
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
            <div className="rounded-[24px] border border-clay/40 bg-paper p-5 text-sm">
              <p className="font-medium text-clay">
                Climate data could not be loaded
              </p>
              <p className="mt-1 text-muted">
                {climate.error}. Scores below leave out climate suitability and
                rescale the other weights.
              </p>
            </div>
          )}

          {rec && <RecommendationCard rec={rec} results={results} />}

          <SeasonTimeline
            results={results}
            indicators={climate.indicators}
            farm={farm!}
          />

          <details className="rounded-[28px] border border-line bg-paper p-6">
            <summary className="cursor-pointer font-display text-2xl">
              See how each option was scored
            </summary>
            <div className="mt-6 space-y-6">
              {results.map((s, i) => (
                <StrategyCard key={s.id} s={s} best={s.id === bestId} index={i} />
              ))}

              <section className="rounded-[28px] border border-line bg-paper p-6">
                <h2 className="font-display text-3xl">Criteria side by side</h2>
                <div className="mt-4 h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid stroke="#e4ded2" vertical={false} />
                      <XAxis
                        dataKey="criterion"
                        tick={{ fontSize: 12, fill: "#6b665c" }}
                      />
                      <YAxis
                        domain={[0, 100]}
                        tick={{ fontSize: 12, fill: "#6b665c" }}
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
            </div>
          </details>

          <section className="rounded-[28px] border border-line bg-sand/60 p-6 text-sm text-muted">
            <h3 className="mb-2 font-medium text-espresso">Good to know</h3>
            <ul className="list-disc space-y-1 pl-5">
              <li>Scores come from simple, open rules, not from a trained AI model.</li>
              <li>The crop values are first estimates. An agronomist should check them for your region.</li>
              <li>Use the result to start a conversation, not as an instruction.</li>
            </ul>
          </section>
        </div>
      )}
    </>
  );
}
