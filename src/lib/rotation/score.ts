import type { AgroIndicators } from "@/lib/nasa/indicators";
import type { Crop, FarmProfile, Priority } from "@/lib/schemas/farm";
import { buildSeasonPlan, type SeasonPlan } from "./calendar";
import { COVER_CROP, CROP_PARAMS, type CropFamily } from "./crops";

/**
 * Rule-based scoring of one crop sequence on eight criteria.
 * Used by the strategy builder (engine.ts) and the optimizer (optimize.ts).
 */

const SOIL_INPUT_NOTE = "Soil fit uses only the soil type and pH you entered.";

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

export const LABELS: Record<CriterionId, string> = {
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

export const clamp = (v: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, v));
export const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const fam = (c: Crop): CropFamily => CROP_PARAMS[c].family;
const lower = (c: Crop) => CROP_PARAMS[c].label.toLowerCase();

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
    const [lo, hi] = p.rainRangeMm;
    const rain = climate.annualPrecipMm;
    // Too little rain: irrigation can make up the shortfall.
    let fit = rain >= lo ? 100 : (100 * rain) / lo;
    const gap = 100 - fit;
    if (irrigation === "limited") fit += gap * 0.5;
    if (irrigation === "full") fit = 100;
    // Too much rain (above the crop's range): irrigation cannot help.
    if (rain > hi) fit = Math.min(fit, (100 * hi) / rain);
    parts.push(clamp(fit));
  }
  return parts.length ? avg(parts) : null;
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

/** Field terrain the scores can use; null when elevation data is missing. */
export type TerrainInput = { meanSlopePct: number } | null;

function erosionScore(plan: SeasonPlan, hasMonthly: boolean, terrain: TerrainInput) {
  const cycle = Math.max(1, plan.cycleMonths);
  const bareShare = plan.bareMonths / cycle;
  const exposedShare = plan.exposedMonths / cycle;
  // Bare soil on a slope washes away faster: from 2% slope up, the exposure
  // counts more, up to double at 22% and steeper.
  const slopeFactor = terrain ? 1 + clamp((terrain.meanSlopePct - 2) / 20, 0, 1) : 1;
  const score = clamp(100 - 100 * slopeFactor * (0.7 * bareShare + 1.5 * exposedShare));
  const covered = plan.gaps.reduce((a, g) => a + g.coveredMonths, 0);
  const expl =
    `The soil is bare for ${plan.bareMonths} of ${plan.cycleMonths} months` +
    (hasMonthly
      ? `, and ${plan.exposedMonths} of those usually get heavy or above-demand rain.`
      : ". Monthly rain was not available, so rainy months could not be singled out.") +
    (covered ? ` A cover crop protects the soil for ${covered} months.` : "") +
    (terrain
      ? ` Your field's average slope is ${terrain.meanSlopePct.toFixed(1)}%${
          slopeFactor > 1.05 ? ", which makes bare months count more." : "."
        }`
      : " Slope is not known, so steep fields may be at more risk than this shows.");
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
        "Compares the 10-year average temperature and yearly rain at your location with each crop's prototype ranges (too little and too much rain). Monthly data was missing, so seasonal frost, heat and drought are not included.",
    };
  const season = seasonalStress(plan, indicators, irrigation);
  return {
    score: 0.5 * avg(fits) + 0.5 * season.score,
    expl: `Half is long-term fit: how the 10-year average temperature and yearly rain match each crop's prototype ranges (too little and too much rain). Half comes from the growing months: ${season.stressedMonths} of ${season.growingMonths} usually bring frost, heat or drought for the crop in the field.`,
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

export function weights(
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

// ---------- one sequence ----------

/** Everything the criteria need that does not depend on the sequence. */
export type ScoringContext = {
  farm: FarmProfile;
  climate: ClimateInput;
  indicators: AgroIndicators | null;
  terrain: TerrainInput;
  hasClimate: boolean;
  hasMonthly: boolean;
  hasSoil: boolean;
  dryClimate: boolean;
  weights: Record<CriterionId, number>;
};

export function scoringContext(
  farm: FarmProfile,
  climate: ClimateInput,
  indicators: AgroIndicators | null = null,
  terrain: TerrainInput = null,
): ScoringContext {
  const hasClimate =
    !!climate && (climate.meanTemp !== null || climate.annualPrecipMm !== null);
  const hasSoil = farm.soilType !== "unknown" || farm.soilPh !== null;
  const aridity = indicators?.annual.aridityIndex ?? null;
  return {
    farm,
    climate: hasClimate ? climate : null,
    indicators,
    terrain,
    hasClimate,
    hasMonthly: !!indicators,
    hasSoil,
    dryClimate: aridity !== null && aridity < 0.5,
    weights: weights(farm.priorities, hasClimate, hasSoil),
  };
}

export type SequenceScore = {
  plan: SeasonPlan;
  criteria: CriterionResult[];
  /** Weighted 0–100 score under the farmer's priorities. */
  overall: number;
};

/** Scores one crop sequence, with or without cover crops in long gaps. */
export function scoreSequence(seq: Crop[], coverCrops: boolean, ctx: ScoringContext): SequenceScore {
  const { farm, indicators } = ctx;
  const plan = buildSeasonPlan(seq, indicators, farm, { cover: coverCrops });
  const parts: Record<CriterionId, { score: number | null; expl: string }> = {
    water: waterScore(seq, farm.irrigation, coverCrops, ctx.dryClimate, plan, indicators),
    nitrogen: nitrogenScore(seq, coverCrops),
    soilHealth: soilScore(seq, coverCrops),
    diversity: diversityScore(seq),
    erosion: erosionScore(plan, ctx.hasMonthly, ctx.terrain),
    climate: climateScore(seq, ctx.climate, farm.irrigation, plan, indicators),
    soilFit: soilFitScore(seq, farm),
    income: incomeScore(seq, farm),
  };

  const criteria: CriterionResult[] = (Object.keys(parts) as CriterionId[]).map((k) => ({
    id: k,
    label: LABELS[k],
    score: parts[k].score === null ? null : Math.round(parts[k].score),
    weight: parts[k].score === null ? 0 : ctx.weights[k],
    explanation: parts[k].expl,
  }));

  const usedWeight = criteria.reduce((a, c) => a + c.weight, 0) || 1;
  const overall = Math.round(
    criteria.reduce((a, c) => a + (c.score ?? 0) * c.weight, 0) / usedWeight,
  );
  return { plan, criteria, overall };
}
