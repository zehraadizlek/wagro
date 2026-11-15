import MethodBadge from "@/components/ml/MethodBadge";
import { CROP_PARAMS } from "@/lib/rotation/crops";
import type { StrategyResult } from "@/lib/rotation/engine";

function List({ items }: { items: string[] }) {
  return (
    <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-muted">
      {items.map((t, i) => (
        <li key={i}>{t}</li>
      ))}
    </ul>
  );
}

/**
 * One card per option: why, what it may do, what to check locally.
 * Evidence and knowledge gaps sit behind a toggle.
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
      <h2 className="font-display text-3xl">Your options</h2>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {results.map((r) => (
          <article
            key={r.id}
            className={`space-y-3 rounded-[24px] border bg-paper p-5 ${
              r.id === bestId ? "border-accent" : "border-line"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-display text-2xl leading-tight">{r.name}</h3>
                <div className="mt-1">
                  <MethodBadge method={r.method} />
                </div>
                <p className="mt-1 text-sm text-muted">
                  {r.sequence.map((c) => CROP_PARAMS[c].label).join(" → ")}
                  {r.coverCrops && " + cover crop"}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <span className="font-display text-3xl">{r.overall}</span>
                <span className="text-sm text-muted">/100</span>
                {r.id === bestId && (
                  <div className="text-xs font-medium text-olive">Highest score under Wagro&apos;s rules</div>
                )}
              </div>
            </div>

            <p className="text-sm">{r.why}</p>

            <div>
              <h4 className="text-sm font-medium text-olive">Good for</h4>
              <List items={r.benefits} />
            </div>

            {r.localReview.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-clay">Check locally</h4>
                <List items={r.localReview} />
              </div>
            )}

            <details className="text-sm">
              <summary className="cursor-pointer text-muted">
                What this is based on
              </summary>
              <List items={r.evidence} />
              <h4 className="mt-2 text-sm font-medium">Not known yet</h4>
              <List items={r.gaps} />
            </details>
          </article>
        ))}
      </div>
    </section>
  );
}
