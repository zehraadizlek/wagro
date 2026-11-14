import type { AgroIndicators } from "@/lib/nasa/indicators";
import { MONTH_LABELS } from "@/lib/nasa/indicators";
import {
  CALENDAR_NOTE,
  FLAG_LABEL,
  buildSeasonPlan,
  type RiskFlag,
} from "@/lib/rotation/calendar";
import { CROP_PARAMS, type CropFamily } from "@/lib/rotation/crops";
import type { StrategyResult } from "@/lib/rotation/engine";
import type { FarmProfile } from "@/lib/schemas/farm";

const FAMILY_STYLE: Record<CropFamily, string> = {
  cereal: "bg-[#c9962e] text-espresso",
  legume: "bg-olive text-paper",
  oilseed: "bg-mocha text-paper",
};

const FLAG_GLYPH: Record<RiskFlag, { glyph: string; color: string }> = {
  frost: { glyph: "❄", color: "text-[#3d6f9e]" },
  heat: { glyph: "▲", color: "text-terracotta" },
  dry: { glyph: "◆", color: "text-[#b07d12]" },
  bareRain: { glyph: "≋", color: "text-[#3d6f9e]" },
  bareWet: { glyph: "•", color: "text-[#3d6f9e]" },
};

const FLAGS = Object.keys(FLAG_LABEL) as RiskFlag[];

export default function SeasonTimeline({
  results,
  indicators,
  farm,
}: {
  results: StrategyResult[];
  indicators: AgroIndicators | null;
  farm: FarmProfile;
}) {
  const plans = results.map((r) => ({
    r,
    plan: buildSeasonPlan(r.sequence, indicators, farm),
  }));

  return (
    <section className="break-inside-avoid rounded-[28px] border border-line bg-paper p-6">
      <h2 className="font-display text-3xl">Through the seasons</h2>
      <p className="mt-1 mb-5 text-sm text-muted">
        Each square is one month, from the first sowing until the rotation
        starts over. Striped squares are months when the field is bare. Symbols
        mark months that the last {indicators ? Math.round(indicators.years) : 10}{" "}
        years of NASA POWER data suggest are risky.
      </p>

      {!indicators && (
        <p className="mb-4 rounded-2xl bg-sand/70 p-3 text-xs text-muted">
          Climate data is not available, so only bare months are shown, without
          risk symbols.
        </p>
      )}

      <div className="space-y-6">
        {plans.map(({ r, plan }) => (
          <div key={r.id}>
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="font-medium">{r.name}</h3>
              <span className="text-xs text-muted">
                Bare {plan.bareMonths} of {plan.cycleMonths} months
              </span>
            </div>
            <div className="overflow-x-auto pb-1">
              <div className="flex gap-[3px] print:flex-wrap">
                {plan.cells.map((cell) => {
                  const fam = cell.crop ? CROP_PARAMS[cell.crop].family : null;
                  const title = [
                    `${MONTH_LABELS[cell.month - 1]}: ${
                      cell.crop
                        ? `${CROP_PARAMS[cell.crop].label}${cell.phase === "sow" ? " (sowing)" : cell.phase === "harvest" ? " (harvest)" : ""}`
                        : "bare field"
                    }`,
                    ...cell.flags.map((f) => FLAG_LABEL[f]),
                  ].join(" · ");
                  return (
                    <div
                      key={cell.index}
                      title={title}
                      className="flex w-7 shrink-0 flex-col items-center"
                    >
                      <div
                        className={`flex h-8 w-7 items-center justify-center rounded-md text-[10px] font-semibold ${
                          fam
                            ? FAMILY_STYLE[fam]
                            : "bare-stripes border border-line text-muted"
                        }`}
                      >
                        {cell.crop && cell.phase === "sow"
                          ? CROP_PARAMS[cell.crop].label.slice(0, 2)
                          : ""}
                      </div>
                      <div className="flex h-4 items-center gap-px text-[10px] leading-none">
                        {cell.flags.map((f) => (
                          <span key={f} className={FLAG_GLYPH[f].color}>
                            {FLAG_GLYPH[f].glyph}
                          </span>
                        ))}
                      </div>
                      <div className="text-[10px] text-muted">
                        {MONTH_LABELS[cell.month - 1][0]}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted">
              {plan.notes.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 border-t border-line pt-4 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm bg-[#c9962e]" /> Cereal
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm bg-olive" /> Legume
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm bg-mocha" /> Oilseed
        </span>
        <span className="flex items-center gap-1.5">
          <span className="bare-stripes h-3 w-3 rounded-sm border border-line" />{" "}
          Bare field
        </span>
        {FLAGS.map((f) => (
          <span key={f} className="flex items-center gap-1.5">
            <span className={FLAG_GLYPH[f].color}>{FLAG_GLYPH[f].glyph}</span>
            {FLAG_LABEL[f]}
          </span>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted">{CALENDAR_NOTE}</p>
    </section>
  );
}
