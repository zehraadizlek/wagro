import type { AgroIndicators } from "@/lib/nasa/indicators";
import type { Crop, FarmProfile } from "@/lib/schemas/farm";
import type { SeasonPlan } from "./calendar";
import { CROP_PARAMS, type CropFamily } from "./crops";
import { cycleKey, optimizeRotation } from "./optimize";
import { allowedCrops, type Pool } from "./pool";
import {
  cropClimateFit,
  scoreSequence,
  scoringContext,
  type ClimateInput,
  type CriterionId,
  type CriterionResult,
  type TerrainInput,
} from "./score";

export {
  CRITERION_MEANING,
  cropClimateFit,
  cropSoilFit,
  type ClimateInput,
  type CriterionId,
  type CriterionResult,
  type TerrainInput,
} from "./score";

export const ENGINE_NOTE =
  "Scores come from transparent rules and relative crop parameters. This is not a trained machine-learning model, and the parameters are prototype assumptions that need agronomic validation.";

export type StrategyId = "current" | "legume" | "diversified" | "cover" | "optimized";
type BuiltStrategyId = Exclude<StrategyId, "optimized">;

/** How a strategy was produced. Never "ML": these come from rules or a search over rule scores. */
export type StrategyMethod = "rule-based" | "optimization";

/** What a strategy's scores draw on. */
export type DataSource = "nasa-power" | "elevation" | "farmer" | "crop-estimates";

export type StrategyResult = {
  id: StrategyId;
  name: string;
  description: string;
  method: StrategyMethod;
  sources: DataSource[];
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

const name = (c: Crop) => CROP_PARAMS[c].label;
const fam = (c: Crop): CropFamily => CROP_PARAMS[c].family;

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
): Record<BuiltStrategyId, Crop[]> {
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
  optimized: {
    name: "Best balance under Wagro's rules",
    description:
      "Found by scoring every rotation you can grow with the same rules and keeping the best balance for your priorities.",
  },
};

function whyText(
  id: StrategyId,
  seq: Crop[],
  pool: Pool,
  coverCrops: boolean,
  searched: number,
): string {
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
    case "optimized":
      return `We scored all ${searched} rotations you can grow with the same rules. This one gave the best balance for your priorities${
        coverCrops ? ", with a cover crop in the long empty months" : ""
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
  hasTerrain: boolean,
  pool: Pool,
): string[] {
  const out: string[] = [];
  if (pool.relaxed && id !== "current")
    out.push("Your market and machinery limits left too few crops, so they were ignored here.");
  if (!hasSoil) out.push("No soil type or pH, so soil fit is not scored.");
  else out.push("No soil test: soil fit uses only the type and pH you entered.");
  if (!hasClimate || !hasMonthly)
    out.push("Weather data is missing, so climate and seasonal risks are incomplete.");
  if (!hasTerrain)
    out.push("No slope data, so erosion risk on steep fields may be underestimated.");
  else out.push("Slope comes from 30 m elevation data; small banks and gullies are not seen.");
  if (id === "cover" || id === "optimized")
    out.push("How much water a cover crop uses depends on each year's rain.");
  out.push("Yields, prices and local pest pressure are not included.");
  return out.slice(0, 3);
}

// ---------- main ----------

export function evaluateStrategies(
  farm: FarmProfile,
  climate: ClimateInput,
  indicators: AgroIndicators | null = null,
  terrain: TerrainInput = null,
  opts: { optimize?: boolean } = {},
): StrategyResult[] {
  const ctx = scoringContext(farm, climate, indicators, terrain);
  const { hasClimate, hasMonthly, hasSoil } = ctx;
  const pool = allowedCrops(farm);
  const seqs = buildSequences(farm, ctx.climate, pool.crops);

  const evidence = [
    hasClimate
      ? "NASA POWER: 10-year average temperature and yearly rain at your location."
      : null,
    hasMonthly
      ? "NASA POWER: 10 years of monthly rain, frost, heat and evaporation."
      : null,
    hasSoil ? "The soil type and pH you entered." : null,
    terrain ? "Elevation data: the slope of your field." : null,
    "Crop values for water, nitrogen, soil and calendar (first estimates).",
  ].filter((e): e is string => e !== null);

  const sources: DataSource[] = [
    ...(hasClimate || hasMonthly ? (["nasa-power"] as const) : []),
    ...(terrain ? (["elevation"] as const) : []),
    "farmer",
    "crop-estimates",
  ];

  // Search every allowed rotation with the same rules (labelled "optimization").
  const search = opts.optimize === false ? null : optimizeRotation(farm, ctx, { maxResults: 1 });
  const top = search?.options[0] ?? null;
  const topKey = top ? cycleKey(top.sequence, top.coverCrops) : null;

  // An option identical to an earlier one adds nothing, so it is left out.
  const seen = new Set<string>();
  const ids = (["current", "legume", "diversified", "cover"] as BuiltStrategyId[]).filter((id) => {
    const key = `${seqs[id].join(">")}|${id === "cover" && farm.coverCropsOk}`;
    if (id !== "current" && seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const built = ids.map((id) => ({
    id: id as StrategyId,
    seq: seqs[id],
    coverCrops: id === "cover" && farm.coverCropsOk,
  }));
  // Add the search result only when it is a rotation not already shown.
  const matched = built.find((b) => cycleKey(b.seq, b.coverCrops) === topKey);
  if (top && !matched) built.push({ id: "optimized", seq: top.sequence, coverCrops: top.coverCrops });

  return built.map(({ id, seq, coverCrops }) => {
    const { plan, criteria, overall } = scoreSequence(seq, coverCrops, ctx);

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
      method: id === "optimized" ? "optimization" : "rule-based",
      sources,
      sequence: seq,
      coverCrops,
      overall,
      criteria,
      advantages,
      risks,
      summary: `${seq.map(name).join(" → ")} scores ${overall} out of 100 under these rules.`,
      confidence: { level: hasClimate ? "medium" : "low", reasons },
      why:
        whyText(id, seq, pool, coverCrops, search?.evaluated ?? 0) +
        (matched?.id === id && id !== "current"
          ? ` A search of all ${search!.evaluated} possible rotations found no better balance.`
          : matched?.id === id
            ? ` A search of all ${search!.evaluated} possible rotations found no better balance than what you grow now.`
            : ""),
      evidence,
      benefits: benefits.length ? benefits : ["No clear strength under these rules."],
      gaps: knowledgeGaps(id, hasClimate, hasMonthly, hasSoil, !!terrain, pool),
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

/** Below this, the recommendation warns that the crop list may not fit the place. */
export const POOR_FIT = 50;

/** Optional context that informs the advice but never changes scores. */
export type RecommendationContext = {
  /** Recent months flagged as unusual by the anomaly detector (ML, unsupervised). */
  unusualMonths?: { ym: string; summary: string }[];
  /** Satellite season timing compared with the crop calendar (Statistics). */
  calendarCheck?: { crop: Crop; expectedPeak: number; observedPeak: number; agrees: boolean };
};

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function buildRecommendation(
  farm: FarmProfile,
  results: StrategyResult[],
  context: RecommendationContext = {},
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
  // Wagro's crop list is built for mid-latitude, winter-rain or continental
  // farming. When even the best option scores low, the list itself may not
  // fit the place (found in testing for the Sahel).
  if (best.overall < POOR_FIT)
    cautions.push(
      `Even the best option scores only ${best.overall}. The crops Wagro knows (${Object.values(CROP_PARAMS)
        .map((p) => p.label.toLowerCase())
        .join(", ")}) may not suit your area well, and local crops are not in the list. Ask a local adviser which crops fit.`,
    );
  if (second && best.overall - second.overall < 5)
    cautions.push(
      `${second.name} is almost as good (${second.overall}). Choose between them by price, market and machinery.`,
    );
  if (best.confidence.level === "low")
    cautions.push("Weather data was missing, so treat this result with extra care.");
  if (best.method === "optimization")
    cautions.push(
      "This option comes from a search over the same rules, not from a separate prediction. Its strengths and limits are the same as the rules'.",
    );
  const check = context.calendarCheck;
  if (check && !check.agrees)
    cautions.push(
      `Satellite plant cover around your field usually peaks in ${MONTH_NAMES[check.observedPeak - 1]}, but our calendar assumes ${CROP_PARAMS[check.crop].label.toLowerCase()} peaks in ${MONTH_NAMES[check.expectedPeak - 1]}. Check the sowing and harvest months against your own.`,
    );
  const unusual = context.unusualMonths ?? [];
  if (unusual.length) {
    const latest = unusual[unusual.length - 1];
    cautions.push(
      `${unusual.length} of the last 24 months were unusual for your area (latest ${latest.ym}: ${latest.summary.replace(/\.$/, "").toLowerCase()}). Check whether they affected your fields; the scores above do not include them.`,
    );
  }
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
