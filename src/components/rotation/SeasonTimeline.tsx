import type { AgroIndicators } from "@/lib/nasa/indicators";
import { MONTH_LABELS } from "@/lib/nasa/indicators";
import { buildSeasonPlan, type SeasonPlan, type TimelineCell } from "@/lib/rotation/calendar";
import { CROP_PARAMS, type CropFamily } from "@/lib/rotation/crops";
import type { StrategyResult } from "@/lib/rotation/engine";
import type { Crop, FarmProfile } from "@/lib/schemas/farm";

const FAMILY_COLOR: Record<CropFamily, string> = {
  cereal: "#d9cba8",
  legume: "#b7c4a2",
  oilseed: "#cbb8a6",
};
const COVER = "#dfe6d3";
const EMPTY = "repeating-linear-gradient(135deg, #ece6da 0 4px, #f7f4ee 4px 8px)";

const monthName = (m: number) => MONTH_LABELS[m - 1];
const lower = (c: Crop) => CROP_PARAMS[c].label.toLowerCase();

/** "Mar–Jun" for runs of three or more months, "Mar, Apr" otherwise. */
function monthRange(months: number[]): string {
  const ms = [...new Set(months)].sort((a, b) => a - b);
  const runs: number[][] = [];
  for (const m of ms) {
    const run = runs[runs.length - 1];
    if (run && m === run[run.length - 1] + 1) run.push(m);
    else runs.push([m]);
  }
  return runs
    .map((r) =>
      r.length > 2
        ? `${monthName(r[0])}–${monthName(r[r.length - 1])}`
        : r.map(monthName).join(", "),
    )
    .join(", ");
}

type Segment = { kind: "crop" | "cover" | "empty"; crop: Crop | null; cells: TimelineCell[] };

/** Groups months into blocks: one crop, a cover crop, or an empty spell. */
function segments(plan: SeasonPlan): Segment[] {
  const out: Segment[] = [];
  for (const cell of plan.cells) {
    const kind = cell.crop ? "crop" : cell.cover ? "cover" : "empty";
    const last = out[out.length - 1];
    if (last && last.kind === kind && last.crop === cell.crop && cell.phase !== "sow")
      last.cells.push(cell);
    else out.push({ kind, crop: cell.crop, cells: [cell] });
  }
  return out;
}

function summary(plan: SeasonPlan): string[] {
  const lines: string[] = [];
  const longest = [...plan.gaps].sort((a, b) => b.months - a.months)[0];
  if (longest && longest.months >= 3) {
    lines.push(
      longest.coveredMonths
        ? `After ${lower(longest.after)}, a cover crop protects the soil for ${longest.coveredMonths} of ${longest.months} months.`
        : `Empty for ${longest.months} months after ${lower(longest.after)}.${
            longest.exposedMonths ? " A cover crop would protect the soil in the rainy months." : ""
          }`,
    );
  }
  const risks = (["frost", "heat", "dry"] as const)
    .map((f) => {
      const ms = plan.cells.filter((c) => c.crop && c.flags.includes(f)).map((c) => c.month);
      if (!ms.length) return null;
      return `${f === "dry" ? "dry spells" : f} ${monthRange(ms)}`;
    })
    .filter((r): r is string => r !== null);
  if (risks.length) lines.push(`Watch for ${risks.join(" · ")}.`);
  return lines;
}

function Swatch({ bg, label }: { bg: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-3 w-5 rounded-sm border border-line" style={{ background: bg }} />
      {label}
    </span>
  );
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
      <h2 className="font-display text-3xl">Your field over 3 years</h2>
      <p className="mt-1 text-sm text-muted">
        When each crop is in the field, and when the soil is left empty.
      </p>

      <div className="mt-6 space-y-7">
        {results.map((r) => {
          const plan = buildSeasonPlan(r.sequence, indicators, farm, { cover: r.coverCrops });
          return (
            <div key={r.id}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-medium">{r.name}</h3>
                <span className="text-sm text-muted">
                  Empty {plan.bareMonths} of {plan.cycleMonths} months
                </span>
              </div>

              <div className="mt-2 flex h-10 overflow-hidden rounded-xl border border-line">
                {segments(plan).map((s, i) => {
                  const name = s.crop
                    ? CROP_PARAMS[s.crop].label
                    : s.kind === "cover"
                      ? "Cover crop"
                      : "Empty";
                  const from = monthName(s.cells[0].month);
                  const to = monthName(s.cells[s.cells.length - 1].month);
                  return (
                    <div
                      key={i}
                      title={`${name}: ${from}–${to}`}
                      className="flex min-w-0 items-center justify-center border-r border-paper text-xs text-espresso last:border-r-0"
                      style={{
                        flexGrow: s.cells.length,
                        flexBasis: 0,
                        background:
                          s.kind === "crop"
                            ? FAMILY_COLOR[CROP_PARAMS[s.crop!].family]
                            : s.kind === "cover"
                              ? COVER
                              : EMPTY,
                      }}
                    >
                      {s.kind !== "empty" && s.cells.length >= 3 && (
                        <span className="truncate px-1">{s.crop ? name : "Cover"}</span>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="mt-1 flex justify-between text-xs text-muted">
                <span>{monthName(plan.cells[0].month)}</span>
                <span>{monthName(plan.cells[plan.cells.length - 1].month)}</span>
              </div>

              <ul className="mt-2 space-y-0.5 text-sm text-muted">
                {summary(plan).map((l, i) => (
                  <li key={i}>{l}</li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 border-t border-line pt-4 text-xs text-muted">
        <Swatch bg={FAMILY_COLOR.cereal} label="Cereal" />
        <Swatch bg={FAMILY_COLOR.legume} label="Legume" />
        <Swatch bg={FAMILY_COLOR.oilseed} label="Oilseed" />
        <Swatch bg={COVER} label="Cover crop" />
        <Swatch bg={EMPTY} label="Empty" />
      </div>
      <p className="mt-2 text-xs text-muted">Sowing and harvest months are typical dates.</p>
    </section>
  );
}
