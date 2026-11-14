"use client";

import { NO_CHANGE, SCENARIO_NOTE, isNoChange, type Scenario } from "@/lib/nasa/scenario";
import type { StrategyResult } from "@/lib/rotation/engine";

const sign = (v: number) => (v > 0 ? `+${v}` : `${v}`);

function Slider({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
  disabled: boolean;
}) {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="tabular-nums text-olive">{format(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 w-full accent-accent disabled:opacity-40"
      />
      <div className="flex justify-between text-xs text-muted">
        <span>{format(min)}</span>
        <span>{format(max)}</span>
      </div>
    </label>
  );
}

/** "What if" sliders and how each option's score responds. */
export default function ScenarioPanel({
  scenario,
  onChange,
  base,
  shifted,
  disabled,
}: {
  scenario: Scenario;
  onChange: (s: Scenario) => void;
  base: StrategyResult[];
  shifted: StrategyResult[];
  disabled: boolean;
}) {
  const changed = !isNoChange(scenario);
  const best = (rs: StrategyResult[]) => [...rs].sort((a, b) => b.overall - a.overall)[0];
  const bestNow = best(base);
  const bestThen = best(shifted);

  // Which criteria move most for the option that leads in the scenario.
  const before = base.find((r) => r.id === bestThen.id);
  const drivers = before
    ? bestThen.criteria
        .map((c, i) => ({ c, from: before.criteria[i].score }))
        .filter((d) => d.c.score !== null && d.from !== null && Math.abs(d.c.score - d.from) >= 2)
        .sort((a, b) => Math.abs(b.c.score! - b.from!) - Math.abs(a.c.score! - a.from!))
        .slice(0, 3)
    : [];

  return (
    <section className="rounded-[28px] border border-line bg-paper p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-3xl">What if the weather changes?</h2>
          <p className="mt-1 text-sm text-muted">
            Move the sliders to see how each option holds up in a warmer or
            drier future. Everything on this page updates.
          </p>
        </div>
        {changed && (
          <button
            type="button"
            onClick={() => onChange(NO_CHANGE)}
            className="btn btn-ghost"
          >
            Back to today
          </button>
        )}
      </div>

      {disabled ? (
        <p className="mt-4 text-sm text-muted">
          Weather data is not available, so scenarios cannot be tested.
        </p>
      ) : (
        <div className="mt-5 grid gap-6 md:grid-cols-2">
          <Slider
            label="Temperature"
            value={scenario.tempC}
            min={0}
            max={3}
            step={0.5}
            format={(v) => `${sign(v)} °C`}
            onChange={(tempC) => onChange({ ...scenario, tempC })}
            disabled={disabled}
          />
          <Slider
            label="Rain"
            value={Math.round(scenario.rain * 100)}
            min={-30}
            max={10}
            step={5}
            format={(v) => `${sign(v)}%`}
            onChange={(pct) => onChange({ ...scenario, rain: pct / 100 })}
            disabled={disabled}
          />
        </div>
      )}

      {changed && !disabled && (
        <div className="mt-6 rounded-2xl bg-sage/60 p-4">
          <p className="text-sm font-medium">
            {bestNow.id === bestThen.id
              ? `${bestThen.name} stays the best match in this scenario.`
              : `In this scenario the best match changes from "${bestNow.name}" to "${bestThen.name}".`}
          </p>
          {drivers.length > 0 && (
            <p className="mt-1 text-sm text-muted">
              What changes most for it:{" "}
              {drivers
                .map((d) => `${d.c.label.toLowerCase()} ${d.from} → ${d.c.score}`)
                .join(", ")}
              .
            </p>
          )}
          <ul className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            {base.map((r) => {
              const s = shifted.find((x) => x.id === r.id);
              if (!s) return null;
              const d = s.overall - r.overall;
              return (
                <li key={r.id} className="flex justify-between gap-3 rounded-xl bg-paper px-3 py-2">
                  <span>{r.name}</span>
                  <span className="tabular-nums">
                    {r.overall} → <b>{s.overall}</b>{" "}
                    <span className={d < 0 ? "text-clay" : d > 0 ? "text-olive" : "text-muted"}>
                      ({d > 0 ? "+" : ""}
                      {d})
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <p className="mt-4 text-xs text-muted">{SCENARIO_NOTE}</p>
    </section>
  );
}
