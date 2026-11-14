import type { AgroIndicators } from "@/lib/nasa/indicators";
import {
  CROPS,
  type Crop,
  type FarmProfile,
  type Priority,
} from "@/lib/schemas/farm";
import { buildSeasonPlan, type SeasonPlan } from "./calendar";
import { COVER_CROP, CROP_PARAMS, type CropFamily } from "./crops";

const SOIL_INPUT_NOTE = "Soil fit uses only the soil type and pH you entered.";

export const ENGINE_NOTE =
  "Scores come from transparent rules and relative crop parameters. This is not a trained machine-learning model, and the parameters are prototype assumptions that need agronomic validation.";

export type CriterionId =
  | "water"
  | "nitrogen"
  | "soilHealth"
  | "diversity"
  | "erosion"
  | "climate"
  | "soilFit"
  | "income";

export type ClimateInput = {
  meanTemp: number | null;
  annualPrecipMm: number | null;
} | null;

export type CriterionResult = {
  id: CriterionId;
  label: string;
  /** 0 to 100, or null when it could not be computed. */
  score: number | null;
  /** Normalized weight actually used (0 when the criterion is unavailable). */
  weight: number;
  explanation: string;
};

export type StrategyId = "current" | "legume" | "diversified" | "cover";

export type StrategyResult = {
  id: StrategyId;
  name: string;
  description: string;
  sequence: Crop[];
  /** Whether a cover crop fills the long empty spells. */
  coverCrops: boolean;
  overall: number;
  criteria: CriterionResult[];
  advantages: string[];
  risks: string[];
  summary: string;
  confidence: { level: "low" | "medium"; reasons: string[] };
  /** Why this option was suggested, in one or two sentences. */
  why: string;
  /** Which data the result rests on. */
  evidence: string[];
  /** What it may do for the farm, in plain words. */
  benefits: string[];
  /** What the tool does not know for this option. */
  gaps: string[];
  /** What a farmer or adviser should check locally. */
  localReview: string[];
};

const LABELS: Record<CriterionId, string> = {
  water: "Water use",
  nitrogen: "Nitrogen",
  soilHealth: "Soil organic matter",
  diversity: "Pest and disease break",
  erosion: "Erosion protection",
  climate: "Climate fit",
  soilFit: "Soil fit",
  income: "Income and feed",
};

/** Plain-language meaning of each criterion, shown to readers. */
export const CRITERION_MEANING: Record<CriterionId, string> = {
  water: "how much water the crops need overall",
  nitrogen: "how much nitrogen the soil gains or loses across the sequence",
  soilHealth: "how much the crops and covers add roots and residue to the soil",
  diversity: "how well changing crops and families breaks pest and disease cycles",
  erosion: "how long the soil stays covered, especially in rainy months",
  climate: "how well the crops match your local temperature and rainfall",
  soilFit: "how well the crops suit your soil type and pH",
  income: "how easy the crops are to sell or use as animal feed",
};

/** One short benefit line per criterion, used when a score is high. */
const BENEFIT: Record<CriterionId, string> = {
  water: "Needs relatively little water",
  nitrogen: "Builds up nitrogen, so less fertilizer",
  soilHealth: "Adds organic matter to the soil",
  diversity: "Breaks pest and disease cycles",
  erosion: "Keeps the soil covered",
  climate: "Fits your weather",
  soilFit: "Suits your soil",
  income: "Easy to sell or feed to animals",
};

const BASE_WEIGHTS: Record<CriterionId, number> = {
  water: 0.18,
  nitrogen: 0.14,
  soilHealth: 0.14,
  diversity: 0.1,
  erosion: 0.12,
  climate: 0.16,
  soilFit: 0.08,
  income: 0.08,
};

const PRIORITY_TARGET: Record<Priority, CriterionId> = {
  "water-efficiency": "water",
  "soil-health": "soilHealth",
  "nitrogen-management": "nitrogen",
  "crop-diversity": "diversity",
  "erosion-control": "erosion",
  "extra-income": "income",
  "animal-feed": "income",
};

const clamp = (v: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, v));
const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const name = (c: Crop) => CROP_PARAMS[c].label;
const lower = (c: Crop) => name(c).toLowerCase();
const fam = (c: Crop): CropFamily => CROP_PARAMS[c].family;

// ---------- single-crop climate fit ----------

export function cropClimateFit(
  crop: Crop,
  climate: ClimateInput,
  irrigation: FarmProfile["irrigation"],
): number | null {
  if (!climate) return null;
  const p = CROP_PARAMS[crop];
  const parts: number[] = [];

  if (climate.meanTemp !== null) {
    const [lo, hi] = p.tempRangeC;
    const dist =
      climate.meanTemp < lo
        ? lo - climate.meanTemp
        : climate.meanTemp > hi
          ? climate.meanTemp - hi
          : 0;
    parts.push(clamp(100 - 8 * dist));
  }
  if (climate.annualPrecipMm !== null) {
    const [lo] = p.rainRangeMm;
    let fit = climate.annualPrecipMm >= lo ? 100 : (100 * climate.annualPrecipMm) / lo;
    const gap = 100 - fit;
    if (irrigation === "limited") fit += gap * 0.5;
    if (irrigation === "full") fit = 100;
    parts.push(clamp(fit));
  }
  return parts.length ? avg(parts) : null;
}

// ---------- which crops the farmer can actually grow ----------

type Pool = { crops: Crop[]; limited: boolean; relaxed: boolean };

/** Crops allowed by the farmer's market list and machinery. */
function allowedCrops(farm: FarmProfile): Pool {
  const ok = CROPS.filter(
    (c) =>
      (farm.marketCrops.length === 0 || farm.marketCrops.includes(c)) &&
      (farm.hasRowPlanter || !CROP_PARAMS[c].needsRowPlanter),
  );
  const limited = ok.length < CROPS.length;
  // With fewer than two crops no rotation can be built, so the limits are relaxed.
  if (ok.length < 2) return { crops: [...CROPS], limited, relaxed: true };
  return { crops: ok, limited, relaxed: false };
}

// ---------- sequence builders ----------

function bestBy(
  candidates: Crop[],
  score: (c: Crop) => number,
): Crop | undefined {
  let best: Crop | undefined;
  let bestScore = -Infinity;
  for (const c of candidates) {
    const s = score(c);
    if (s > bestScore) {
      best = c;
      bestScore = s;
    }
  }
  return best;
}

/** Best crop from the preferred list, falling back to the whole pool. */
function pick(preferred: Crop[], pool: Crop[], score: (c: Crop) => number): Crop {
  return bestBy(preferred, score) ?? bestBy(pool, score) ?? pool[0];
}

function buildSequences(
  farm: FarmProfile,
  climate: ClimateInput,
  pool: Crop[],
): Record<StrategyId, Crop[]> {
  const cur = farm.currentCrop;
  const fit = (c: Crop) => cropClimateFit(c, climate, farm.irrigation) ?? 0;
  // Water-saving score: climate fit minus a penalty for thirsty crops.
  const thrifty = (c: Crop) => fit(c) - 12 * (CROP_PARAMS[c].waterDemand - 1);

  const prev = farm.previousCrops.slice(-2);
  const current: Crop[] = [
    ...Array<Crop>(Math.max(0, 2 - prev.length)).fill(cur),
    ...prev,
    cur,
  ];

  const nonLegume = pool.filter((c) => fam(c) !== "legume");
  const legumes = pool.filter((c) => fam(c) === "legume");
  const s1 = pick(nonLegume.filter((c) => c !== cur), pool, fit);
  const s2 = pick(legumes, pool, fit);
  const s3 = pick(nonLegume.filter((c) => c !== s1 && c !== s2), pool, fit);

  const families: CropFamily[] = ["cereal", "legume", "oilseed"];
  const order = [
    ...families.filter((f) => f !== fam(cur)),
    ...families.filter((f) => f === fam(cur)),
  ];
  const diversified: Crop[] = [];
  for (const f of order) {
    const options = pool.filter((c) => fam(c) === f && c !== cur && !diversified.includes(c));
    diversified.push(pick(options, pool.filter((c) => !diversified.includes(c)), fit));
  }

  // Low-water crops from different families, in the same family order.
  const cover: Crop[] = [];
  for (const f of order) {
    const options = pool.filter((c) => fam(c) === f && !cover.includes(c));
    cover.push(pick(options, pool.filter((c) => !cover.includes(c)), thrifty));
  }

  return { current, legume: [s1, s2, s3], diversified, cover };
}

// ---------- criteria ----------

/**
 * Water use. With monthly NASA data this is a simple water budget: in each
 * growing month the crop needs roughly ET0 times a crop factor (from its
 * relative water demand), and 80% of the rain counts as useful. The yearly
 * shortfall drives the score. Without monthly data it falls back to the
 * crops' relative water demand.
 */
function waterScore(
  seq: Crop[],
  irrigation: FarmProfile["irrigation"],
  coverCrops: boolean,
  dryClimate: boolean,
  plan: SeasonPlan,
  indicators: AgroIndicators | null,
) {
  const demand = avg(seq.map((c) => CROP_PARAMS[c].waterDemand));
  const relief = irrigation === "full" ? 0.5 : irrigation === "limited" ? 0.25 : 0;
  const reliefText =
    relief > 0
      ? " Your irrigation covers part of the shortfall."
      : " With no irrigation, the whole shortfall counts.";

  if (!indicators) {
    const base = ((5 - demand) / 4) * 100;
    const coverCost =
      coverCrops && irrigation === "none"
        ? COVER_CROP.waterPenalty * (dryClimate ? 2 : 1)
        : 0;
    return {
      score: clamp(base + (100 - base) * relief - coverCost),
      expl: `Average relative water demand is ${demand.toFixed(1)} out of 5.${reliefText}`,
    };
  }

  let shortfall = 0;
  for (const cell of plan.cells) {
    const m = indicators.months[cell.month - 1];
    if (m.et0Mm === null || m.precipMm === null) continue;
    const factor = cell.crop
      ? cell.phase === "harvest"
        ? 0
        : 0.4 + 0.2 * CROP_PARAMS[cell.crop].waterDemand
      : cell.cover
        ? COVER_CROP.waterFactor
        : 0;
    shortfall += Math.max(0, factor * m.et0Mm - 0.8 * m.precipMm);
  }
  const perYear = (shortfall / Math.max(1, plan.cycleMonths)) * 12 * (1 - relief);
  return {
    score: clamp(100 - perYear / 8),
    expl:
      `In a typical year the crops${coverCrops ? " and cover crop" : ""} need about ${Math.round(perYear)} mm more water than the rain gives in their growing months.` +
      reliefText +
      " Water stored in the soil from wet months is not counted, so this is a cautious estimate.",
  };
}

function nitrogenScore(seq: Crop[], coverCrops: boolean) {
  const bal = avg(seq.map((c) => CROP_PARAMS[c].nitrogenBalance));
  let transitions = 0;
  for (let i = 0; i < seq.length - 1; i++) {
    if (fam(seq[i]) === "legume" && fam(seq[i + 1]) !== "legume") transitions++;
  }
  const adj =
    bal + (transitions * 0.5) / seq.length + (coverCrops ? COVER_CROP.nitrogenBonus : 0);
  const score = clamp(((adj + 2) / 3.5) * 100);
  const expl =
    `Average relative nitrogen balance is ${bal.toFixed(1)} (from -2 to +2).` +
    (transitions > 0
      ? " A legume followed by a non-legume adds a small bonus."
      : " No legume is followed by a non-legume crop in this sequence.") +
    (coverCrops ? " A legume cover crop adds a little nitrogen." : "");
  return { score, expl };
}

function soilScore(seq: Crop[], coverCrops: boolean) {
  const base = ((avg(seq.map((c) => CROP_PARAMS[c].soilHealth)) - 1) / 4) * 100;
  let penalty = 0;
  let sameCrop = 0;
  let sameFamily = 0;
  for (let i = 0; i < seq.length; i++) {
    const a = seq[i];
    const b = seq[(i + 1) % seq.length];
    if (seq.length < 2) break;
    if (a === b) {
      sameCrop++;
      penalty += 12;
    } else if (fam(a) === fam(b)) {
      sameFamily++;
      penalty += 5;
    }
  }
  const bonus = coverCrops ? COVER_CROP.soilBonus : 0;
  const score = clamp(base - penalty + bonus);
  const expl =
    `Crop soil values average ${(base / 25 + 1).toFixed(1)} out of 5.` +
    (sameCrop > 0
      ? ` The same crop repeats back to back ${sameCrop} time(s), which lowers the score.`
      : "") +
    (sameFamily > 0
      ? ` Crops of the same family follow each other ${sameFamily} time(s), which lowers it slightly.`
      : "") +
    (bonus ? " Cover crop roots and residue add organic matter." : "");
  return { score, expl };
}

function diversityScore(seq: Crop[]) {
  const crops = new Set(seq).size;
  const families = new Set(seq.map(fam)).size;
  const n = seq.length;
  const score = clamp(
    (n > 1 ? ((crops - 1) / (n - 1)) * 50 : 0) + ((families - 1) / 2) * 50,
  );
  return {
    score,
    expl: `${crops} different crop(s) from ${families} of 3 crop families in ${n} seasons. Changing family gives pests and diseases fewer chances to build up.`,
  };
}

function erosionScore(plan: SeasonPlan, hasMonthly: boolean) {
  const cycle = Math.max(1, plan.cycleMonths);
  const bareShare = plan.bareMonths / cycle;
  const exposedShare = plan.exposedMonths / cycle;
  const score = clamp(100 - 100 * (0.7 * bareShare + 1.5 * exposedShare));
  const covered = plan.gaps.reduce((a, g) => a + g.coveredMonths, 0);
  const expl =
    `The soil is bare for ${plan.bareMonths} of ${plan.cycleMonths} months` +
    (hasMonthly
      ? `, and ${plan.exposedMonths} of those usually get heavy or above-demand rain.`
      : ". Monthly rain was not available, so rainy months could not be singled out.") +
    (covered ? ` A cover crop protects the soil for ${covered} months.` : "") +
    " Slope is not known yet, so steep fields may be at more risk than this shows.";
  return { score, expl };
}

function incomeScore(seq: Crop[], farm: FarmProfile) {
  const feed = farm.priorities.includes("animal-feed");
  const values = seq.map((c) => {
    const p = CROP_PARAMS[c];
    const sellable = farm.marketCrops.length === 0 || farm.marketCrops.includes(c);
    const market = sellable ? p.marketValue : 1;
    return feed ? 0.4 * market + 0.6 * p.forageValue : 0.7 * market + 0.3 * p.forageValue;
  });
  const v = avg(values);
  const unsold = farm.marketCrops.length
    ? seq.filter((c) => !farm.marketCrops.includes(c))
    : [];
  return {
    score: clamp(((v - 1) / 4) * 100),
    expl:
      `Average sale and feed value is ${v.toFixed(1)} out of 5 (prototype estimates, not prices).` +
      (feed ? " Feed value counts more because you chose animal feed." : "") +
      (unsold.length
        ? ` You did not list ${[...new Set(unsold)].map(lower).join(", ")} as sellable, so they count low.`
        : ""),
  };
}

/**
 * How hard the growing months usually are for the crop in the field, from
 * 0 (easy) to 1 (very hard) per month: frost nights, hot days at flowering,
 * and how far rain falls short of evaporative demand. Graded rather than
 * yes/no, so warmer or drier scenarios move the score step by step.
 */
function seasonalStress(
  plan: SeasonPlan,
  indicators: AgroIndicators,
  irrigation: FarmProfile["irrigation"],
) {
  const inField = plan.cells.filter((c) => c.crop);
  const waterRelief = irrigation === "full" ? 0 : irrigation === "limited" ? 0.5 : 1;
  let points = 0;
  let stressedMonths = 0;
  for (const cell of inField) {
    const m = indicators.months[cell.month - 1];
    const p = CROP_PARAMS[cell.crop!];
    let v = 0;
    if (cell.flags.includes("frost")) v += Math.min(1, (m.frostDays ?? 0) / 8);
    if (cell.flags.includes("heat")) v += Math.min(1, (m.heatDays[p.heatStressC] ?? 0) / 8);
    if (cell.phase !== "harvest" && m.et0Mm !== null && m.precipMm !== null && m.et0Mm >= 60) {
      const deficit = clamp(1 - m.precipMm / m.et0Mm, 0, 1);
      v += 0.6 * deficit * waterRelief;
    }
    v = Math.min(1, v);
    if (v >= 0.15) stressedMonths++;
    points += v;
  }
  return {
    score: clamp(100 - (100 * 1.3 * points) / Math.max(1, inField.length)),
    stressedMonths,
    growingMonths: inField.length,
  };
}

function climateScore(
  seq: Crop[],
  climate: ClimateInput,
  irrigation: FarmProfile["irrigation"],
  plan: SeasonPlan,
  indicators: AgroIndicators | null,
) {
  if (!climate)
    return {
      score: null as number | null,
      expl: "Climate data was not available, so this criterion is left out and the other weights are rescaled.",
    };
  const fits = seq
    .map((c) => cropClimateFit(c, climate, irrigation))
    .filter((v): v is number => v !== null);
  if (!fits.length)
    return {
      score: null as number | null,
      expl: "Climate data had no usable values, so this criterion is left out.",
    };
  if (!indicators)
    return {
      score: avg(fits),
      expl:
        "Compares the last year of temperature and rainfall at your location with assumed crop ranges. Monthly data was missing, so seasonal frost, heat and drought are not included.",
    };
  const season = seasonalStress(plan, indicators, irrigation);
  return {
    score: 0.5 * avg(fits) + 0.5 * season.score,
    expl: `Half comes from how last year's average temperature and rain match each crop. Half comes from the growing months: ${season.stressedMonths} of ${season.growingMonths} usually bring frost, heat or drought for the crop in the field.`,
  };
}

export function cropSoilFit(
  crop: Crop,
  soilType: FarmProfile["soilType"],
  soilPh: number | null,
): number | null {
  const p = CROP_PARAMS[crop];
  const parts: number[] = [];
  if (soilPh !== null) {
    const [lo, hi] = p.phRange;
    const dist = soilPh < lo ? lo - soilPh : soilPh > hi ? soilPh - hi : 0;
    parts.push(clamp(100 - 30 * dist));
  }
  if (soilType !== "unknown") parts.push(p.soilTypeFit[soilType]);
  return parts.length ? avg(parts) : null;
}

function soilFitScore(seq: Crop[], farm: FarmProfile) {
  const fits = seq
    .map((c) => cropSoilFit(c, farm.soilType, farm.soilPh))
    .filter((v): v is number => v !== null);
  if (!fits.length)
    return {
      score: null as number | null,
      expl: "You did not enter a soil type or pH, so this criterion is left out and the other weights are rescaled.",
    };
  const used = [
    farm.soilType !== "unknown" ? `${farm.soilType} soil` : null,
    farm.soilPh !== null ? `pH ${farm.soilPh}` : null,
  ]
    .filter(Boolean)
    .join(" and ");
  return {
    score: avg(fits),
    expl: `Compares ${used} with assumed crop preferences. ${SOIL_INPUT_NOTE}`,
  };
}

function weights(
  priorities: Priority[],
  hasClimate: boolean,
  hasSoil: boolean,
) {
  const w = { ...BASE_WEIGHTS };
  for (const p of priorities) w[PRIORITY_TARGET[p]] += 0.1;
  if (!hasClimate) w.climate = 0;
  if (!hasSoil) w.soilFit = 0;
  const total = Object.values(w).reduce((a, b) => a + b, 0);
  (Object.keys(w) as CriterionId[]).forEach((k) => (w[k] = w[k] / total));
  return w;
}

// ---------- explanations ----------

const META: Record<StrategyId, { name: string; description: string }> = {
  current: {
    name: "Your current rotation",
    description:
      "Continues with your current crop and recent history, so you can compare other options against it.",
  },
  legume: {
    name: "Add a legume",
    description:
      "Places a legume between other crops, chosen by climate fit, to support the nitrogen balance.",
  },
  diversified: {
    name: "Mix crop types",
    description:
      "Uses one crop from each family (cereal, legume, oilseed) for the widest variety.",
  },
  cover: {
    name: "Cover crops, less water",
    description:
      "Low-water crops from different families, with a cover crop in the long empty months.",
  },
};

function whyText(id: StrategyId, seq: Crop[], pool: Pool, coverCrops: boolean): string {
  const fromList = pool.limited && !pool.relaxed
    ? " Only crops you can sell and sow with your machinery were considered."
    : "";
  switch (id) {
    case "current":
      return "This is what you grow now. Every other option is compared with it.";
    case "legume": {
      const leg = seq.find((c) => fam(c) === "legume");
      return (
        (leg
          ? `${name(leg)} sits between the other crops to add nitrogen and break disease cycles. `
          : "") + `The crops were picked by how well they fit your climate.${fromList}`
      );
    }
    case "diversified":
      return `One crop from each family (cereal, legume, oilseed). Changing family every season breaks pest and disease cycles.${fromList}`;
    case "cover":
      return `Crops that need less water${
        coverCrops ? ", and a cover crop that protects and feeds the soil in the long empty months" : ""
      }.${fromList}`;
  }
}

function localChecks(
  id: StrategyId,
  seq: Crop[],
  plan: SeasonPlan,
  coverCrops: boolean,
  hasRowPlanter: boolean,
): string[] {
  const out: string[] = [];
  const months = (flag: "frost" | "heat" | "dry") =>
    [...new Set(plan.cells.filter((c) => c.crop && c.flags.includes(flag)).map((c) => c.month))];
  const risky = (["frost", "heat", "dry"] as const).filter((f) => months(f).length);
  if (risky.length)
    out.push(
      `Sowing dates and varieties that avoid ${risky
        .map((f) => (f === "dry" ? "dry spells" : f))
        .join(", ")} in your area.`,
    );
  if (seq.some((c) => fam(c) === "legume") && id !== "current")
    out.push("Legume diseases common nearby, and whether you need seed inoculant.");
  if (seq.includes("vetch")) out.push("A buyer or your own animals for the vetch hay.");
  if (coverCrops)
    out.push("When to end the cover crop in dry springs, so it does not take water from the next crop.");
  if (!hasRowPlanter && seq.some((c) => CROP_PARAMS[c].needsRowPlanter))
    out.push("Access to a row-crop planter, which this rotation needs.");
  return out.slice(0, 3);
}

function knowledgeGaps(
  id: StrategyId,
  hasClimate: boolean,
  hasMonthly: boolean,
  hasSoil: boolean,
  pool: Pool,
): string[] {
  const out: string[] = [];
  if (pool.relaxed && id !== "current")
    out.push("Your market and machinery limits left too few crops, so they were ignored here.");
  if (!hasSoil) out.push("No soil type or pH, so soil fit is not scored.");
  else out.push("No soil test: soil fit uses only the type and pH you entered.");
  if (!hasClimate || !hasMonthly)
    out.push("Weather data is missing, so climate and seasonal risks are incomplete.");
  out.push("No slope data yet, so erosion risk on steep fields is underestimated.");
  if (id === "cover")
    out.push("How much water the cover crop uses depends on each year's rain.");
  out.push("Yields, prices and local pest pressure are not included.");
  return out.slice(0, 3);
}

// ---------- main ----------

export function evaluateStrategies(
  farm: FarmProfile,
  climate: ClimateInput,
  indicators: AgroIndicators | null = null,
): StrategyResult[] {
  const hasClimate =
    !!climate &&
    (climate.meanTemp !== null || climate.annualPrecipMm !== null);
  const hasMonthly = !!indicators;
  const aridity = indicators?.annual.aridityIndex ?? null;
  const dryClimate = aridity !== null && aridity < 0.5;
  const hasSoil = farm.soilType !== "unknown" || farm.soilPh !== null;
  const w = weights(farm.priorities, hasClimate, hasSoil);
  const pool = allowedCrops(farm);
  const seqs = buildSequences(farm, hasClimate ? climate : null, pool.crops);

  const evidence = [
    hasClimate
      ? "NASA POWER: the last 12 months of temperature and rain at your location."
      : null,
    hasMonthly
      ? "NASA POWER: 10 years of monthly rain, frost, heat and evaporation."
      : null,
    hasSoil ? "The soil type and pH you entered." : null,
    "Crop values for water, nitrogen, soil and calendar (first estimates).",
  ].filter((e): e is string => e !== null);

  // An option identical to an earlier one adds nothing, so it is left out.
  const seen = new Set<string>();
  const ids = (["current", "legume", "diversified", "cover"] as StrategyId[]).filter((id) => {
    const key = `${seqs[id].join(">")}|${id === "cover" && farm.coverCropsOk}`;
    if (id !== "current" && seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return ids.map((id) => {
    const seq = seqs[id];
    const coverCrops = id === "cover" && farm.coverCropsOk;
    const plan = buildSeasonPlan(seq, indicators, farm, { cover: coverCrops });

    const parts: Record<CriterionId, { score: number | null; expl: string }> = {
      water: waterScore(seq, farm.irrigation, coverCrops, dryClimate, plan, indicators),
      nitrogen: nitrogenScore(seq, coverCrops),
      soilHealth: soilScore(seq, coverCrops),
      diversity: diversityScore(seq),
      erosion: erosionScore(plan, hasMonthly),
      climate: climateScore(seq, hasClimate ? climate : null, farm.irrigation, plan, indicators),
      soilFit: soilFitScore(seq, farm),
      income: incomeScore(seq, farm),
    };

    const criteria: CriterionResult[] = (Object.keys(parts) as CriterionId[]).map(
      (k) => ({
        id: k,
        label: LABELS[k],
        score: parts[k].score === null ? null : Math.round(parts[k].score),
        weight: parts[k].score === null ? 0 : w[k],
        explanation: parts[k].expl,
      }),
    );

    const usedWeight = criteria.reduce((a, c) => a + c.weight, 0) || 1;
    const overall = Math.round(
      criteria.reduce((a, c) => a + (c.score ?? 0) * c.weight, 0) / usedWeight,
    );

    const scored = criteria.filter((c) => c.score !== null);
    const strong = [...scored].sort((a, b) => b.score! - a.score!).slice(0, 2);
    const weak = [...scored].sort((a, b) => a.score! - b.score!).slice(0, 2);

    const advantages = strong
      .filter((c) => c.score! >= 60)
      .map((c) => `${c.label}: ${c.score} out of 100. ${c.explanation}`);
    const risks = weak
      .filter((c) => c.score! < 60)
      .map((c) => `${c.label}: ${c.score} out of 100. ${c.explanation}`);
    if (!hasClimate)
      risks.push(
        "Climate suitability could not be checked, so this score rests on fewer criteria.",
      );

    const benefits = [...scored]
      .filter((c) => c.score! >= 70)
      .sort((a, b) => b.score! - a.score!)
      .slice(0, 3)
      .map((c) => BENEFIT[c.id]);

    const reasons = [
      "Crop parameters are prototype assumptions and have not been validated by an agronomist.",
      hasSoil
        ? "Soil fit relies on the soil type and pH you entered, not on a soil test or satellite soil data."
        : "No soil type or pH was entered, so soil fit is not part of the score.",
    ];
    if (hasClimate)
      reasons.push(
        "Climate fit uses gridded estimates for the area around your pin, not measurements in your field.",
      );
    else reasons.push("No climate data was available for this run.");

    return {
      id,
      name: META[id].name,
      description: META[id].description,
      sequence: seq,
      coverCrops,
      overall,
      criteria,
      advantages,
      risks,
      summary: `${seq.map(name).join(" → ")} scores ${overall} out of 100 under these rules.`,
      confidence: { level: hasClimate ? "medium" : "low", reasons },
      why: whyText(id, seq, pool, coverCrops),
      evidence,
      benefits: benefits.length ? benefits : ["No clear strength under these rules."],
      gaps: knowledgeGaps(id, hasClimate, hasMonthly, hasSoil, pool),
      localReview: localChecks(id, seq, plan, coverCrops, farm.hasRowPlanter),
    };
  });
}

// ---------- plain-language recommendation ----------

export type Recommendation = {
  bestId: StrategyId;
  headline: string;
  /** Why the top option leads, in everyday words. */
  reasons: string[];
  /** Where the top option is weaker than the current pattern. */
  tradeoffs: string[];
  /** Things to keep in mind before relying on the result. */
  cautions: string[];
  /** Questions worth taking to a local agronomist. */
  discuss: string[];
};

/** What a better score means, in a farmer's words. */
const PLAIN_GAIN: Record<CriterionId, string> = {
  water: "Uses less water",
  nitrogen: "Leaves more nitrogen in the soil, so less fertilizer",
  soilHealth: "Adds more organic matter to the soil",
  diversity: "More crop variety, which breaks pest and disease cycles",
  erosion: "Keeps the soil covered for longer",
  climate: "Fits your weather better",
  soilFit: "Suits your soil better",
  income: "Easier to sell or feed to animals",
};

/** What a worse score means, in a farmer's words. */
const PLAIN_LOSS: Record<CriterionId, string> = {
  water: "Needs more water",
  nitrogen: "Takes more nitrogen from the soil, so more fertilizer",
  soilHealth: "Adds less organic matter",
  diversity: "Less crop variety",
  erosion: "Leaves the soil bare for longer",
  climate: "Fits your weather less well",
  soilFit: "Suits your soil less well",
  income: "Harder to sell or use as feed",
};

const seqText = (r: StrategyResult) =>
  r.sequence.map((c) => CROP_PARAMS[c].label).join(" → ");

export function buildRecommendation(
  farm: FarmProfile,
  results: StrategyResult[],
): Recommendation {
  const ranked = [...results].sort((a, b) => b.overall - a.overall);
  const best = ranked[0];
  const second = ranked[1];
  const current = results.find((r) => r.id === "current")!;

  const headline =
    best.id === "current"
      ? "Your current rotation is already the best fit."
      : `Try ${seqText(best)}${best.coverCrops ? ", with a cover crop in the empty months" : ""}.`;

  const diffs = best.criteria
    .map((c, i) => ({
      c,
      before: current.criteria[i].score,
      delta:
        c.score !== null && current.criteria[i].score !== null
          ? c.score - current.criteria[i].score!
          : null,
    }))
    .filter((d) => d.delta !== null);

  const reasons =
    best.id === "current"
      ? ["None of the other options did better overall."]
      : diffs
          .filter((d) => d.delta! >= 5)
          .sort((a, b) => b.delta! - a.delta!)
          .slice(0, 3)
          .map((d) => `${PLAIN_GAIN[d.c.id]} (${d.before} → ${d.c.score}).`);
  if (!reasons.length)
    reasons.push("Many small gains, no single big one.");

  const tradeoffs =
    best.id === "current"
      ? []
      : diffs
          .filter((d) => d.delta! <= -5)
          .sort((a, b) => a.delta! - b.delta!)
          .slice(0, 2)
          .map((d) => `${PLAIN_LOSS[d.c.id]} (${d.before} → ${d.c.score}).`);

  const cautions: string[] = [];
  if (second && best.overall - second.overall < 5)
    cautions.push(
      `${second.name} is almost as good (${second.overall}). Choose between them by price, market and machinery.`,
    );
  if (best.confidence.level === "low")
    cautions.push("Weather data was missing, so treat this result with extra care.");
  cautions.push(
    "These are first estimates. A higher score is not a promise of more yield or profit.",
  );
  if (farm.priorities.length === 0)
    cautions.push(
      "You did not pick what matters most to you, so everything counts the same. You can set this in your farm profile.",
    );

  const discuss = [
    "Do these water, nitrogen and soil values match what you see in your fields?",
    "Can you sell these crops, and do you have the machines and time to sow them?",
    "Does a soil test confirm your soil type and pH?",
  ];

  return { bestId: best.id, headline, reasons, tradeoffs, cautions, discuss };
}
