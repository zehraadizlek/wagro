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
    <section className="rise rounded-[28px] bg-espresso p-6 text-paper md:p-8">
      <div className="text-xs font-medium uppercase tracking-[0.16em] text-sand">
        Summary for decision makers
      </div>
      <h2 className="mt-2 font-display text-3xl leading-tight md:text-4xl">
        {rec.headline}
      </h2>

      <div className="mt-6 grid gap-3 md:grid-cols-3">
        {sorted.map((r, i) => (
          <div
            key={r.id}
            className={`rounded-2xl p-4 ${
              i === 0 ? "bg-terracotta text-paper" : "bg-paper/10"
            }`}
          >
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-medium">{r.name}</span>
              <span className="font-display text-3xl">{r.overall}</span>
            </div>
            <div className="mt-1 text-xs opacity-80">
              {r.sequence.map((c) => CROP_PARAMS[c].label).join(" → ")}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 text-sm leading-relaxed md:grid-cols-2">
        <div>
          <h3 className="mb-2 font-medium text-sand">Why it leads</h3>
          <List items={rec.reasons} />
          {rec.tradeoffs.length > 0 && (
            <>
              <h3 className="mb-2 mt-5 font-medium text-sand">
                What you give up
              </h3>
              <List items={rec.tradeoffs} />
            </>
          )}
        </div>
        <div>
          <h3 className="mb-2 font-medium text-sand">Keep in mind</h3>
          <List items={rec.cautions} />
          <h3 className="mb-2 mt-5 font-medium text-sand">
            Questions for an agronomist
          </h3>
          <List items={rec.discuss} />
        </div>
      </div>
    </section>
  );
}
