import type { AgroIndicators, MonthClimate } from "@/lib/nasa/indicators";
import { MONTH_LABELS } from "@/lib/nasa/indicators";
import type { Crop, FarmProfile } from "@/lib/schemas/farm";
import { CROP_PARAMS } from "./crops";

/**
 * Lays a rotation out month by month, using assumed crop calendars and the
 * local monthly climatology, to show when the field is bare and when each
 * crop meets frost, heat or dry spells.
 */

export const CALENDAR_NOTE =
  "Sowing and harvest months are typical assumptions for mid-latitudes (shifted six months in the southern hemisphere). Local calendars differ, so check them with farmers or an extension service.";

export type RiskFlag = "frost" | "heat" | "dry" | "bareRain" | "bareWet";

export const FLAG_LABEL: Record<RiskFlag, string> = {
  frost: "Frost while in the field",
  heat: "Heat at flowering or grain fill",
  dry: "Rain covers under half of water demand",
  bareRain: "Heavy rain on bare soil",
  bareWet: "Rain exceeds evaporation on bare soil",
};

export type TimelineCell = {
  index: number;
  /** Calendar month, 1 = January. */
  month: number;
  crop: Crop | null;
  phase: "sow" | "grow" | "harvest" | null;
  flags: RiskFlag[];
};

export type BareGap = {
  after: Crop;
  before: Crop;
  startIndex: number;
  months: number;
  /** Months in the gap flagged bareRain or bareWet. */
  exposedMonths: number;
};

export type SeasonPlan = {
  cells: TimelineCell[];
  /** Months until the rotation starts over. */
  cycleMonths: number;
  bareMonths: number;
  gaps: BareGap[];
  counts: Record<RiskFlag, number>;
  notes: string[];
};

const monthOf = (index: number) => (index % 12) + 1;
const shiftMonth = (m: number, south: boolean) =>
  south ? ((m - 1 + 6) % 12) + 1 : m;

function firstIndex(from: number, months: number[]): number {
  for (let i = from; i < from + 24; i++) {
    if (months.includes(monthOf(i))) return i;
  }
  return from;
}

function listMonths(months: number[]): string {
  const uniq = [...new Set(months)].sort((a, b) => a - b);
  return uniq.map((m) => MONTH_LABELS[m - 1]).join(", ");
}

function inFieldFlags(
  crop: Crop,
  c: MonthClimate,
  monthsToHarvest: number,
  irrigation: FarmProfile["irrigation"],
): RiskFlag[] {
  const p = CROP_PARAMS[crop];
  const flags: RiskFlag[] = [];
  const frost = (c.frostDays ?? 0) >= 1;
  // Frost-tolerant crops are only at risk around flowering, near harvest.
  if (frost && (!p.frostTolerant || monthsToHarvest <= 2)) flags.push("frost");
  if (monthsToHarvest <= 2 && (c.heatDays[p.heatStressC] ?? 0) >= 2)
    flags.push("heat");
  if (
    irrigation !== "full" &&
    monthsToHarvest >= 1 &&
    c.et0Mm !== null &&
    c.precipMm !== null &&
    c.et0Mm >= 60 &&
    c.precipMm < 0.5 * c.et0Mm
  )
    flags.push("dry");
  return flags;
}

function bareFlags(c: MonthClimate): RiskFlag[] {
  const flags: RiskFlag[] = [];
  if ((c.heavyRainDays ?? 0) >= 0.3 || (c.precipMm ?? 0) >= 50)
    flags.push("bareRain");
  if ((c.balanceMm ?? -1) > 0) flags.push("bareWet");
  return flags;
}

export function buildSeasonPlan(
  sequence: Crop[],
  indicators: AgroIndicators | null,
  farm: FarmProfile,
): SeasonPlan {
  const south = farm.latitude < 0;
  const cal = (c: Crop) => {
    const k = CROP_PARAMS[c].calendar;
    return {
      sow: k.sowMonths.map((m) => shiftMonth(m, south)),
      harvest: shiftMonth(k.harvestMonth, south),
    };
  };

  // Place each crop at its first possible sowing month after the last harvest.
  const placed: { crop: Crop; start: number; harvest: number }[] = [];
  let cursor = 0;
  for (const crop of sequence) {
    const k = cal(crop);
    const start = firstIndex(cursor, k.sow);
    const harvest = firstIndex(start + 1, [k.harvest]);
    placed.push({ crop, start, harvest });
    cursor = harvest + 1;
  }
  // The rotation repeats: the cycle ends when the first crop can be sown again.
  const firstStart = placed[0].start;
  const restart = firstIndex(cursor, cal(sequence[0]).sow);
  const cycleEnd = restart - 1;

  const climate = (m: number) => indicators?.months[m - 1] ?? null;
  const cells: TimelineCell[] = [];
  for (let i = firstStart; i <= cycleEnd; i++) {
    const month = monthOf(i);
    const slot = placed.find((p) => i >= p.start && i <= p.harvest);
    const c = climate(month);
    if (slot) {
      cells.push({
        index: i,
        month,
        crop: slot.crop,
        phase: i === slot.start ? "sow" : i === slot.harvest ? "harvest" : "grow",
        flags: c
          ? inFieldFlags(slot.crop, c, slot.harvest - i, farm.irrigation)
          : [],
      });
    } else {
      cells.push({
        index: i,
        month,
        crop: null,
        phase: null,
        flags: c ? bareFlags(c) : [],
      });
    }
  }

  const gaps: BareGap[] = placed.map((p, k) => {
    const nextStart = k + 1 < placed.length ? placed[k + 1].start : restart;
    const gapCells = cells.filter(
      (c) => c.index > p.harvest && c.index < nextStart,
    );
    return {
      after: p.crop,
      before: k + 1 < placed.length ? placed[k + 1].crop : sequence[0],
      startIndex: p.harvest + 1,
      months: gapCells.length,
      exposedMonths: gapCells.filter((c) => c.flags.length > 0).length,
    };
  });

  const counts: Record<RiskFlag, number> = {
    frost: 0, heat: 0, dry: 0, bareRain: 0, bareWet: 0,
  };
  for (const cell of cells) for (const f of cell.flags) counts[f] += 1;

  const cycleMonths = cells.length;
  const bareMonths = cells.filter((c) => c.crop === null).length;
  const notes: string[] = [];

  notes.push(
    `The field is bare for ${bareMonths} of every ${cycleMonths} months (${Math.round(
      (100 * bareMonths) / Math.max(1, cycleMonths),
    )}%) in this rotation.`,
  );

  const longest = [...gaps].sort((a, b) => b.months - a.months)[0];
  if (longest && longest.months >= 3) {
    const startMonth = MONTH_LABELS[monthOf(longest.startIndex) - 1];
    const endMonth =
      MONTH_LABELS[monthOf(longest.startIndex + longest.months - 1) - 1];
    notes.push(
      `Longest bare spell: ${longest.months} months (${startMonth} to ${endMonth}) after ${CROP_PARAMS[longest.after].label.toLowerCase()} and before ${CROP_PARAMS[longest.before].label.toLowerCase()}.${
        longest.exposedMonths
          ? ` In ${longest.exposedMonths} of those months rain usually falls on uncovered soil, which raises the risk of erosion and nutrient loss. A cover crop or crop residue could protect the soil.`
          : ""
      }`,
    );
  }

  if (indicators) {
    for (const p of placed) {
      const label = CROP_PARAMS[p.crop].label;
      const flagged = (f: RiskFlag) =>
        cells
          .filter((c) => c.crop === p.crop && c.index >= p.start && c.index <= p.harvest && c.flags.includes(f))
          .map((c) => c.month);
      const frost = flagged("frost");
      const heat = flagged("heat");
      const dry = flagged("dry");
      if (frost.length)
        notes.push(
          `${label}: frost is common in ${listMonths(frost)} while it is in the field${
            CROP_PARAMS[p.crop].frostTolerant ? ", close to flowering" : ""
          }. Sowing date and variety choice matter here.`,
        );
      if (heat.length)
        notes.push(
          `${label}: days of ${CROP_PARAMS[p.crop].heatStressC} °C or more are common in ${listMonths(heat)}, during flowering and grain fill.`,
        );
      if (dry.length)
        notes.push(
          `${label}: rain covers less than half of the evaporative demand in ${listMonths(dry)}${
            farm.irrigation === "none" ? ", and you have no irrigation" : ""
          }.`,
        );
    }
  }

  // Dedupe notes for rotations that repeat a crop.
  return {
    cells,
    cycleMonths,
    bareMonths,
    gaps,
    counts,
    notes: [...new Set(notes)],
  };
}
