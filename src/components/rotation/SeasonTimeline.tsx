import type { AgroIndicators } from "@/lib/nasa/indicators";
import { MONTH_LABELS } from "@/lib/nasa/indicators";
import { buildSeasonPlan, type SeasonPlan } from "@/lib/rotation/calendar";
import { CROP_PARAMS, type CropFamily } from "@/lib/rotation/crops";
import type { StrategyResult } from "@/lib/rotation/engine";
import type { Crop, FarmProfile } from "@/lib/schemas/farm";

const FAMILY_COLOR: Record<CropFamily, string> = {
  cereal: "#c8b48a",
  legume: "#7d8f69",
  oilseed: "#8b6f5c",
};

/** Only the three risks a farmer acts on are shown as icons. */
const ICONS = {
  frost: { icon: "❄", label: "Frost risk", short: "frost" },
  heat: { icon: "☀", label: "Heat at flowering", short: "heat" },
  dry: { icon: "💧", label: "Too dry, needs water", short: "dry spells" },
} as const;
type IconFlag = keyof typeof ICONS;
const ICON_FLAGS = Object.keys(ICONS) as IconFlag[];

const EMPTY = "repeating-linear-gradient(135deg, #e4ded2 0 3px, transparent 3px 7px)";
const EMPTY_RAIN = "repeating-linear-gradient(135deg, #b9c7c9 0 3px, transparent 3px 7px)";
const COVER = "repeating-linear-gradient(135deg, #b5c4a0 0 4px, #dfe6d3 4px 8px)";

const name = (c: Crop) => CROP_PARAMS[c].label.toLowerCase();
const monthName = (m: number) => MONTH_LABELS[m - 1];

/** Two short, plain sentences for one rotation. */
function plainNotes(plan: SeasonPlan): string[] {
  const notes: string[] = [];

  const longest = [...plan.gaps].sort((a, b) => b.months - a.months)[0];
  if (longest && longest.months >= 3) {
    const from = monthName((longest.startIndex % 12) + 1);
    const to = monthName(((longest.startIndex + longest.months - 1) % 12) + 1);
    notes.push(
      longest.coveredMonths
        ? `After ${name(longest.after)} (${from} to ${to}) a cover crop protects the soil for ${longest.coveredMonths} of ${longest.months} months.`
        : `The field stays empty for ${longest.months} months after ${name(longest.after)} (${from} to ${to}).${
            longest.exposedMonths ? " Rain can wash bare soil away then, so a cover crop would help." : ""
          }`,
    );
  } else {
    notes.push("The field is almost never left empty.");
  }

  // One short line for all risks, with months merged across crops.
  const risks = ICON_FLAGS.map((flag) => {
    const months = new Set<number>();
    for (const cell of plan.cells) {
      if (cell.crop && cell.flags.includes(flag)) months.add(cell.month);
    }
    if (!months.size) return null;
    const list = [...months].sort((a, b) => a - b).map(monthName).join(", ");
    return `${ICONS[flag].icon} ${ICONS[flag].short} in ${list}`;
  }).filter((r): r is string => r !== null);
  if (risks.length) notes.push(`Watch for: ${risks.join(" · ")}`);

  return notes;
}

export default function SeasonTimeline({
  results,
  indicators,
  farm,
}: {
  results: StrategyResult[];
  indicators: AgroIndicators | null;
  farm: FarmProfile;
}) {
  return (
    <section className="break-inside-avoid rounded-[28px] border border-line bg-paper p-6">
      <h2 className="font-display text-3xl">Your field, month by month</h2>
      <p className="mt-1 mb-5 text-sm text-muted">
        Coloured squares: a crop is growing. Striped squares: the field is
        empty. Icons show months that are often risky in your area.
      </p>

      <div className="space-y-6">
        {results.map((r) => {
          const plan = buildSeasonPlan(r.sequence, indicators, farm, {
            cover: r.coverCrops,
          });
          return (
            <div key={r.id}>
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-medium">
                  {r.name}{" "}
                  <span className="font-normal text-muted">
                    · {r.sequence.map((c) => CROP_PARAMS[c].label).join(" → ")}
                    {r.coverCrops && " + cover crop"}
                  </span>
                </h3>
                <span className="text-xs text-muted">
                  Empty {plan.bareMonths} of {plan.cycleMonths} months
                </span>
              </div>

              <div className="overflow-x-auto pb-1">
                <div className="flex gap-[3px] print:flex-wrap">
                  {plan.cells.map((cell) => {
                    const fam = cell.crop ? CROP_PARAMS[cell.crop].family : null;
                    const rainy = !cell.crop && !cell.cover && cell.flags.length > 0;
                    const icons = ICON_FLAGS.filter((f) => cell.flags.includes(f));
                    return (
                      <div
                        key={cell.index}
                        title={`${monthName(cell.month)}: ${cell.crop ? CROP_PARAMS[cell.crop].label : cell.cover ? "cover crop" : "empty field"}`}
                        className="flex w-7 shrink-0 flex-col items-center"
                      >
                        <div
                          className="flex h-8 w-7 items-center justify-center rounded-md border border-line text-[10px] font-semibold text-espresso"
                          style={{
                            background: fam
                              ? FAMILY_COLOR[fam]
                              : cell.cover
                                ? COVER
                                : rainy
                                  ? EMPTY_RAIN
                                  : EMPTY,
                            borderColor: fam ? "transparent" : undefined,
                          }}
                        >
                          {cell.crop && cell.phase === "sow"
                            ? CROP_PARAMS[cell.crop].label.slice(0, 2)
                            : ""}
                        </div>
                        <div className="flex h-4 items-center text-[10px] leading-none">
                          {icons.map((f) => (
                            <span key={f}>{ICONS[f].icon}</span>
                          ))}
                        </div>
                        <div className="text-[10px] text-muted">
                          {monthName(cell.month)[0]}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <ul className="mt-2 space-y-1 text-sm text-muted">
                {plainNotes(plan).map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 border-t border-line pt-4 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm" style={{ background: FAMILY_COLOR.cereal }} /> Cereal
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm" style={{ background: FAMILY_COLOR.legume }} /> Legume
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm" style={{ background: FAMILY_COLOR.oilseed }} /> Oilseed
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm border border-line" style={{ background: COVER }} /> Cover crop
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm border border-line" style={{ background: EMPTY }} /> Empty field
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm border border-line" style={{ background: EMPTY_RAIN }} /> Empty in a rainy month
        </span>
        {ICON_FLAGS.map((f) => (
          <span key={f}>
            {ICONS[f].icon} {ICONS[f].label}
          </span>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted">
        Sowing and harvest months are typical dates. Yours may differ.
        {!indicators && " Weather data is missing, so no risk icons are shown."}
      </p>
    </section>
  );
}