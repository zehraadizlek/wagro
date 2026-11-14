import { CROP_PARAMS } from "@/lib/rotation/crops";
import type { StrategyResult } from "@/lib/rotation/engine";

function Part({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h4 className="text-xs font-medium uppercase tracking-[0.12em] text-olive">
        {title}
      </h4>
      <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-muted">
        {items.map((t, i) => (
          <li key={i}>{t}</li>
        ))}
      </ul>
    </div>
  );
}

/**
 * One card per option, answering the five questions the challenge asks:
 * why it was suggested, what evidence supports it, what it may offer,
 * where information is missing, and what needs local review.
 */
export default function StrategyCards({
  results,
  bestId,
}: {
  results: StrategyResult[];
  bestId: string | null;
}) {
  return (
    <section>
      <h2 className="font-display text-3xl">The options, explained</h2>
      <p className="mt-1 mb-5 text-sm text-muted">
        For each option: why we suggest it, what it rests on, what it may do
        for your farm, what we do not know, and what to check locally.
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        {results.map((r) => (
          <article
            key={r.id}
            className={`space-y-4 rounded-[24px] border bg-paper p-5 ${
              r.id === bestId ? "border-accent" : "border-line"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-display text-2xl leading-tight">{r.name}</h3>
                <p className="mt-1 text-sm text-muted">
                  {r.sequence.map((c) => CROP_PARAMS[c].label).join(" → ")}
                  {r.coverCrops && " + cover crop"}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <span className="font-display text-3xl">{r.overall}</span>
                <span className="text-sm text-muted">/100</span>
                {r.id === bestId && (
                  <div className="text-xs font-medium text-olive">Best match</div>
                )}
              </div>
            </div>

            <p className="text-sm">{r.why}</p>

            <Part title="What it may do for you" items={r.benefits} />
            <Part title="Based on" items={r.evidence} />
            <Part title="What we don't know" items={r.gaps} />
            {r.localReview.length > 0 && (
              <Part title="Check locally" items={r.localReview} />
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
