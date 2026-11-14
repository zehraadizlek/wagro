import {
  CROPS,
  type Crop,
  type FarmProfile,
  type Priority,
} from "@/lib/schemas/farm";
import { CROP_PARAMS, type CropFamily } from "./crops";

export const ENGINE_NOTE =
  "Scores come from transparent rules and relative crop parameters. This is not a trained machine-learning model, and the parameters are prototype assumptions that need agronomic validation.";

export type CriterionId =
  | "water"
  | "nitrogen"
  | "soilHealth"
  | "diversity"
  | "climate";

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

export type StrategyId = "current" | "legume" | "diversified";

export type StrategyResult = {
  id: StrategyId;
  name: string;
  description: string;
  sequence: Crop[];
  overall: number;
  criteria: CriterionResult[];
  advantages: string[];
  risks: string[];
  summary: string;
  confidence: { level: "low" | "medium"; reasons: string[] };
};

const LABELS: Record<CriterionId, string> = {
  water: "Water use",
  nitrogen: "Nitrogen balance",
  soilHealth: "Soil health",
  diversity: "Diversity",
  climate: "Climate suitability",
};

const BASE_WEIGHTS: Record<CriterionId, number> = {
  water: 0.25,
  nitrogen: 0.2,
  soilHealth: 0.2,
  diversity: 0.15,
  climate: 0.2,
};

const PRIORITY_TARGET: Record<Priority, CriterionId> = {
  "water-efficiency": "water",
  "soil-health": "soilHealth",
  "nitrogen-management": "nitrogen",
  "crop-diversity": "diversity",
};

const clamp = (v: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, v));
const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const name = (c: Crop) => CROP_PARAMS[c].label;
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

function buildSequences(
  farm: FarmProfile,
  climate: ClimateInput,
): Record<StrategyId, Crop[]> {
  const cur = farm.currentCrop;
  const fit = (c: Crop) => cropClimateFit(c, climate, farm.irrigation) ?? 0;

  const prev = farm.previousCrops.slice(-2);
  const current: Crop[] = [
    ...Array<Crop>(Math.max(0, 2 - prev.length)).fill(cur),
    ...prev,
    cur,
  ];

  const nonLegume = CROPS.filter((c) => fam(c) !== "legume");
  const legumes = CROPS.filter((c) => fam(c) === "legume");
  const s1 = bestBy(
    nonLegume.filter((c) => c !== cur),
    fit,
  )!;
  const s2 = bestBy(legumes, fit)!;
  const s3 = bestBy(
    nonLegume.filter((c) => c !== s1),
    fit,
  )!;

  const families: CropFamily[] = ["cereal", "legume", "oilseed"];
  const order = [
    ...families.filter((f) => f !== fam(cur)),
    ...families.filter((f) => f === fam(cur)),
  ];
  const diversified = order.map(
    (f) =>
      bestBy(
        CROPS.filter((c) => fam(c) === f && c !== cur),
        fit,
      ) ?? CROPS.find((c) => fam(c) === f)!,
  );

  return { current, legume: [s1, s2, s3], diversified };
}

// ---------- criteria ----------

function waterScore(seq: Crop[], irrigation: FarmProfile["irrigation"]) {
  const demand = avg(seq.map((c) => CROP_PARAMS[c].waterDemand));
  const base = ((5 - demand) / 4) * 100;
  const relief = irrigation === "full" ? 0.5 : irrigation === "limited" ? 0.25 : 0;
  const score = clamp(base + (100 - base) * relief);
  const expl =
    `Average relative water demand is ${demand.toFixed(1)} out of 5. ` +
    (relief > 0
      ? "Your irrigation lowers the pressure of high-demand crops."
      : "With no irrigation, high-demand crops count fully against this score.");
  return { score, expl };
}

function nitrogenScore(seq: Crop[]) {
  const bal = avg(seq.map((c) => CROP_PARAMS[c].nitrogenBalance));
  let transitions = 0;
  for (let i = 0; i < seq.length - 1; i++) {
    if (fam(seq[i]) === "legume" && fam(seq[i + 1]) !== "legume") transitions++;
  }
  const adj = bal + (transitions * 0.5) / seq.length;
  const score = clamp(((adj + 2) / 3.5) * 100);
  const expl =
    `Average relative nitrogen balance is ${bal.toFixed(1)} (from -2 to +2).` +
    (transitions > 0
      ? " A legume followed by a non-legume adds a small bonus."
      : " No legume is followed by a non-legume crop in this sequence.");
  return { score, expl };
}

function soilScore(seq: Crop[]) {
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
  const score = clamp(base - penalty);
  const expl =
    `Crop soil-health values average ${(base / 25 + 1).toFixed(1)} out of 5.` +
    (sameCrop > 0
      ? ` The same crop repeats back to back ${sameCrop} time(s), which lowers the score.`
      : "") +
    (sameFamily > 0
      ? ` Crops of the same family follow each other ${sameFamily} time(s), which lowers it slightly.`
      : "");
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
    expl: `${crops} distinct crop(s) from ${families} of 3 crop families in ${n} seasons.`,
  };
}

function climateScore(
  seq: Crop[],
  climate: ClimateInput,
  irrigation: FarmProfile["irrigation"],
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
  return {
    score: avg(fits),
    expl:
      "Compares the last year of temperature and rainfall at your location with assumed crop ranges. It is a rough guide only, because it uses annual values, not growing-season values.",
  };
}

function weights(priorities: Priority[], hasClimate: boolean) {
  const w = { ...BASE_WEIGHTS };
  for (const p of priorities) w[PRIORITY_TARGET[p]] += 0.1;
  if (!hasClimate) w.climate = 0;
  const total = Object.values(w).reduce((a, b) => a + b, 0);
  (Object.keys(w) as CriterionId[]).forEach((k) => (w[k] = w[k] / total));
  return w;
}

// ---------- main ----------

const META: Record<StrategyId, { name: string; description: string }> = {
  current: {
    name: "Current pattern",
    description:
      "Continues with your current crop and recent history, so you can compare other options against it.",
  },
  legume: {
    name: "Legume-supported",
    description:
      "Places a legume between other crops, chosen by climate fit, to support the nitrogen balance.",
  },
  diversified: {
    name: "Diversified",
    description:
      "Uses one crop from each family (cereal, legume, oilseed) for the widest variety.",
  },
};

export function evaluateStrategies(
  farm: FarmProfile,
  climate: ClimateInput,
): StrategyResult[] {
  const hasClimate =
    !!climate &&
    (climate.meanTemp !== null || climate.annualPrecipMm !== null);
  const w = weights(farm.priorities, hasClimate);
  const seqs = buildSequences(farm, hasClimate ? climate : null);

  return (["current", "legume", "diversified"] as StrategyId[]).map((id) => {
    const seq = seqs[id];
    const parts: Record<CriterionId, { score: number | null; expl: string }> = {
      water: waterScore(seq, farm.irrigation),
      nitrogen: nitrogenScore(seq),
      soilHealth: soilScore(seq),
      diversity: diversityScore(seq),
      climate: climateScore(seq, hasClimate ? climate : null, farm.irrigation),
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

    const reasons = [
      "Crop parameters are prototype assumptions and have not been validated by an agronomist.",
      "Soil type and pH are not used in the scoring in this version.",
    ];
    if (hasClimate)
      reasons.push(
        "Climate comparison uses last year's gridded values against annual ranges, which is only a rough guide.",
      );
    else reasons.push("No climate data was available for this run.");

    return {
      id,
      name: META[id].name,
      description: META[id].description,
      sequence: seq,
      overall,
      criteria,
      advantages,
      risks,
      summary: `${seq.map(name).join(" → ")} scores ${overall} out of 100 under these rules.`,
      confidence: { level: hasClimate ? "medium" : "low", reasons },
    };
  });
}
