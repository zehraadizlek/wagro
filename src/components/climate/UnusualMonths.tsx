"use client";

import Link from "next/link";
import MethodBadge from "@/components/ml/MethodBadge";
import { FEATURE_KEYS, FEATURE_LABELS } from "@/lib/features/monthly";
import { MONTH_LABELS } from "@/lib/nasa/indicators";
import type { AnomalyState } from "@/lib/ml/use-anomalies";

/** Single values this far from normal are listed even when the model does not flag the month. */
const EXTREME_Z = 3;

const ymLabel = (ym: string) => `${MONTH_LABELS[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`;

/** Months that were unusual for this place: the ML flags, plus single extreme values. */
export default function UnusualMonths({ anomalies }: { anomalies: AnomalyState }) {
  if (anomalies.status === "idle") return null;

  const { result, recent, table } = anomalies;
  const ok = result?.status === "ok" ? result : null;
  const strongest = ok ? [...ok.flagged].sort((a, b) => b.score - a.score).slice(0, 3) : [];

  // Statistics: single extreme values in the last 24 months that the model did not flag.
  const flaggedSet = new Set(ok?.flagged.map((m) => m.ym));
  const extremes = table
    ? table.rows.slice(-24).flatMap((r) =>
        flaggedSet.has(r.ym)
          ? []
          : FEATURE_KEYS.filter((k) => r.z[k] !== null && Math.abs(r.z[k]!) >= EXTREME_Z).map((k) => ({
              ym: r.ym,
              text: `${FEATURE_LABELS[k]} ${r.z[k]! > 0 ? "far above" : "far below"} normal`,
            })),
      )
    : [];

  return (
    <section className="rounded-[28px] border border-line bg-paper p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-3xl">Unusual months</h2>
        <MethodBadge method="ml-unsupervised" />
      </div>
      <p className="mt-1 text-sm text-muted">
        Months when weather and soil together were rare for your area. Unusual
        does not always mean harmful.
      </p>

      {anomalies.status === "loading" && <div className="mt-4 h-24 animate-pulse rounded-2xl bg-sand" />}
      {anomalies.status === "error" && (
        <p className="mt-4 text-sm text-clay">The 30-year record could not be loaded.</p>
      )}
      {result?.status === "insufficient-data" && (
        <p className="mt-4 text-sm text-muted">Not enough years of data here to judge.</p>
      )}

      {ok && (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <h3 className="text-sm font-medium">Last 2 years</h3>
            {recent.length ? (
              <ul className="mt-1 space-y-1 text-sm">
                {recent.map((m) => (
                  <li key={m.ym}>
                    <b className="font-medium">{ymLabel(m.ym)}</b>
                    <span className="text-muted"> · {m.summary}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-sm text-muted">Nothing unusual.</p>
            )}
          </div>
          <div>
            <h3 className="text-sm font-medium">Most unusual since {ok.model.trainedOn.start.slice(0, 4)}</h3>
            <ul className="mt-1 space-y-1 text-sm">
              {strongest.map((m) => (
                <li key={m.ym}>
                  <b className="font-medium">{ymLabel(m.ym)}</b>
                  <span className="text-muted"> · {m.summary}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {extremes.length > 0 && (
        <div className="mt-4 rounded-2xl bg-sand/60 p-3 text-sm">
          <div className="mb-1 flex items-center gap-2">
            <span className="font-medium">Also far from normal</span>
            <MethodBadge method="statistics" />
          </div>
          <ul className="space-y-0.5 text-muted">
            {extremes.map((e, i) => (
              <li key={i}>
                {ymLabel(e.ym)} · {e.text}
              </li>
            ))}
          </ul>
        </div>
      )}

      {ok && (
        <p className="mt-3 text-xs text-muted">
          Isolation Forest on {ok.model.trainedOn.months} months of NASA POWER data at
          your pin (about 50 km grid). It does not detect crop disease or damage.{" "}
          <Link href="/how" className="underline hover:text-espresso">
            How it works
          </Link>
        </p>
      )}
    </section>
  );
}
