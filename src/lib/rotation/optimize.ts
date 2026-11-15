import type { Crop, FarmProfile } from "@/lib/schemas/farm";
import { allowedCrops } from "./pool";
import { CROP_PARAMS } from "./crops";
import { scoreSequence, type CriterionId, type CriterionResult, type ScoringContext } from "./score";

/**
 * Rotation optimization by exhaustive search.
 *
 * With 9 crops a 3-season rotation has 9³ = 729 sequences (1,458 with the
 * cover-crop option); 4 seasons give 13,122. That is small enough to score
 * every candidate with the existing rule-based criteria and keep the exact
 * Pareto front: the sequences that no other sequence beats on every
 * criterion at once. A genetic algorithm would only approximate this front.
 *
 * Method label: Optimization. It optimizes rule-based scores; it is not ML.
 */

export const OPTIMIZATION_METHOD = "optimization" as const;

export type Candidate = {
  sequence: Crop[];
  coverCrops: boolean;
  overall: number;
  criteria: CriterionResult[];
};

export type OptimizeOptions = {
  /** Seasons per rotation (default 3, like the current strategies). */
  seasons?: 3 | 4;
  /** How many options to return: the best plus clearly different alternatives (default 3). */
  maxResults?: number;
};

export type OptimizeResult = {
  method: typeof OPTIMIZATION_METHOD;
  seasons: number;
  /** Candidates scored (after constraints). */
  evaluated: number;
  /** Size of the Pareto front. */
  paretoSize: number;
  /** Best first, then up to `maxResults − 1` clearly different alternatives. */
  options: Candidate[];
  /** True when the market and machinery limits left too few crops and were ignored. */
  constraintsRelaxed: boolean;
};

/** All sequences of the given length over the crop list (with repetition). */
export function* sequences(crops: Crop[], length: number): Generator<Crop[]> {
  const idx = Array(length).fill(0);
  if (!crops.length) return;
  while (true) {
    yield idx.map((i) => crops[i]);
    let k = length - 1;
    while (k >= 0 && ++idx[k] === crops.length) idx[k--] = 0;
    if (k < 0) return;
  }
}

/** Same rotation regardless of which season it is started from. */
export function cycleKey(seq: Crop[], cover: boolean): string {
  let best = seq.join(">");
  for (let i = 1; i < seq.length; i++) {
    const r = [...seq.slice(i), ...seq.slice(0, i)].join(">");
    if (r < best) best = r;
  }
  return `${best}|${cover}`;
}

/**
 * a dominates b when it is at least as good on every criterion both scored,
 * and strictly better on at least one.
 */
export function dominates(a: CriterionResult[], b: CriterionResult[]): boolean {
  let better = false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i].score;
    const y = b[i].score;
    if (x === null || y === null) continue;
    if (x < y) return false;
    if (x > y) better = true;
  }
  return better;
}

/** Exact Pareto front by incremental filtering. */
export function paretoFront<T extends { criteria: CriterionResult[] }>(items: T[]): T[] {
  const sum = (c: CriterionResult[]) => c.reduce((a, x) => a + (x.score ?? 0), 0);
  // Visiting strong candidates first keeps the running front small.
  const sorted = [...items].sort((a, b) => sum(b.criteria) - sum(a.criteria));
  const front: T[] = [];
  for (const cand of sorted) {
    if (front.some((f) => dominates(f.criteria, cand.criteria))) continue;
    for (let i = front.length - 1; i >= 0; i--) {
      if (dominates(cand.criteria, front[i].criteria)) front.splice(i, 1);
    }
    front.push(cand);
  }
  return front;
}

/** Clearly different: another set of crops, or the same crops with a different cover choice. */
function differs(a: Candidate, b: Candidate): boolean {
  const sa = new Set(a.sequence);
  const sb = new Set(b.sequence);
  const sameCrops = sa.size === sb.size && [...sa].every((c) => sb.has(c));
  return !sameCrops || a.coverCrops !== b.coverCrops;
}

export function optimizeRotation(
  farm: FarmProfile,
  ctx: ScoringContext,
  opts: OptimizeOptions = {},
): OptimizeResult {
  const seasons = opts.seasons ?? 3;
  const maxResults = opts.maxResults ?? 3;
  const pool = allowedCrops(farm);
  const coverChoices = farm.coverCropsOk ? [false, true] : [false];

  const seen = new Set<string>();
  const candidates: Candidate[] = [];
  for (const seq of sequences(pool.crops, seasons)) {
    // The next season should not repeat the crop that is in the field now.
    if (seq[0] === farm.currentCrop) continue;
    for (const cover of coverChoices) {
      const key = cycleKey(seq, cover);
      if (seen.has(key)) continue;
      seen.add(key);
      const { criteria, overall } = scoreSequence(seq, cover, ctx);
      candidates.push({ sequence: seq, coverCrops: cover, overall, criteria });
    }
  }

  const front = paretoFront(candidates).sort((a, b) => b.overall - a.overall);
  const options: Candidate[] = [];
  for (const c of front) {
    if (options.length >= maxResults) break;
    if (options.every((o) => differs(o, c))) options.push(c);
  }

  return {
    method: OPTIMIZATION_METHOD,
    seasons,
    evaluated: candidates.length,
    paretoSize: front.length,
    options,
    constraintsRelaxed: pool.relaxed,
  };
}

/** Criteria where the option beats the comparison by at least `margin` points. */
export function strengthsVersus(
  option: Candidate,
  other: { criteria: CriterionResult[] },
  margin = 5,
): CriterionId[] {
  return option.criteria
    .filter((c, i) => c.score !== null && other.criteria[i].score !== null && c.score - other.criteria[i].score! >= margin)
    .map((c) => c.id);
}

/** Crops in a sequence, for display. */
export const sequenceLabel = (seq: Crop[]) => seq.map((c) => CROP_PARAMS[c].label).join(" → ");
