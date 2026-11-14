import type { AgroIndicators, MonthClimate } from "@/lib/nasa/indicators";
import type { Crop, FarmProfile } from "@/lib/schemas/farm";
import { COVER_CROP, CROP_PARAMS } from "./crops";

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
  /** True when a cover crop protects the soil in an otherwise empty month. */
  cover: boolean;
  flags: RiskFlag[];
};

export type BareGap = {
  after: Crop;
  before: Crop;
  startIndex: number;
  months: number;
  /** Months in the gap flagged bareRain or bareWet. */
  exposedMonths: number;
  /** Months in the gap covered by a cover crop. */
  coveredMonths: number;
};

export type SeasonPlan = {
  cells: TimelineCell[];
  /** Months until the rotation starts over. */
  cycleMonths: number;
  /** Months with neither a crop nor a cover crop. */
  bareMonths: number;
  /** Bare months that usually get heavy or above-demand rain. */
  exposedMonths: number;
  gaps: BareGap[];
  counts: Record<RiskFlag, number>;
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
  opts: { cover?: boolean } = {},
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

  // Long empty spells get a cover crop, leaving a month after harvest and a
  // month before sowing for field work.
  const coverIdx = new Set<number>();
  if (opts.cover) {
    placed.forEach((p, k) => {
      const nextStart = k + 1 < placed.length ? placed[k + 1].start : restart;
      if (nextStart - p.harvest - 1 < COVER_CROP.minGapMonths) return;
      for (let i = p.harvest + 2; i <= nextStart - 2; i++) coverIdx.add(i);
    });
  }

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
        cover: false,
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
        cover: coverIdx.has(i),
        flags: c && !coverIdx.has(i) ? bareFlags(c) : [],
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
      coveredMonths: gapCells.filter((c) => c.cover).length,
    };
  });

  const counts: Record<RiskFlag, number> = {
    frost: 0, heat: 0, dry: 0, bareRain: 0, bareWet: 0,
  };
  for (const cell of cells) for (const f of cell.flags) counts[f] += 1;

  const cycleMonths = cells.length;
  const bare = cells.filter((c) => c.crop === null && !c.cover);
  const bareMonths = bare.length;
  const exposedMonths = bare.filter((c) => c.flags.length > 0).length;
  return { cells, cycleMonths, bareMonths, exposedMonths, gaps, counts };
}
