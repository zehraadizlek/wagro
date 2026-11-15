import MethodBadge from "@/components/ml/MethodBadge";
import { CROP_PARAMS } from "@/lib/rotation/crops";
import type { Recommendation, StrategyResult } from "@/lib/rotation/engine";

function List({ items }: { items: string[] }) {
  return (
    <ul className="list-disc space-y-1.5 pl-5">
      {items.map((t, i) => (
        <li key={i}>{t}</li>
      ))}
    </ul>
  );
}

export default function RecommendationCard({
  rec,
  results,
}: {
  rec: Recommendation;
  results: StrategyResult[];
}) {
  const sorted = [...results].sort((a, b) => b.overall - a.overall);

  return (
    <section className="rise rounded-[28px] border border-line bg-sage p-6 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-olive">
          Our suggestion
        </p>
        <MethodBadge method={sorted[0].method} />
      </div>
      <h2 className="mt-2 font-display text-3xl leading-snug md:text-4xl">
        {rec.headline}
      </h2>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {sorted.map((r, i) => (
          <div
            key={r.id}
            className={`rounded-2xl border p-4 ${
              i === 0 ? "border-accent bg-paper" : "border-line bg-paper/70"
            }`}
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-sm font-medium">{r.name}</span>
              <span className="text-sm text-muted">
                <span className="font-display text-2xl text-espresso">
                  {r.overall}
                </span>
                /100
              </span>
            </div>
            <div className="mt-1 text-sm text-muted">
              {r.sequence.map((c) => CROP_PARAMS[c].label).join(" → ")}
              {r.coverCrops && " + cover crop"}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 leading-relaxed md:grid-cols-2">
        <div>
          <h3 className="mb-2 font-medium text-olive">Why</h3>
          <List items={rec.reasons} />
        </div>
        {rec.tradeoffs.length > 0 && (
          <div>
            <h3 className="mb-2 font-medium text-clay">Watch out</h3>
            <List items={rec.tradeoffs} />
          </div>
        )}
      </div>

      <details className="mt-6 rounded-2xl bg-paper/70 p-4 text-sm leading-relaxed">
        <summary className="cursor-pointer font-medium">Before you decide</summary>
        <div className="mt-3 space-y-4 text-muted">
          <List items={rec.cautions} />
          <div>
            <h4 className="mb-1 font-medium text-espresso">
              Ask your agronomist
            </h4>
            <List items={rec.discuss} />
          </div>
        </div>
      </details>
    </section>
  );
}
