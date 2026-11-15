import { mulberry32 } from "./random";

/**
 * Isolation Forest (Liu, Ting & Zhou, 2008), implemented without dependencies.
 *
 * Idea: build many random trees that split the data at random values of
 * random features. Unusual points are isolated after few splits, so their
 * average path length is short. The score is 2^(−E[h(x)] / c(ψ)), where
 * c(ψ) is the average path length of an unsuccessful search in a binary
 * search tree of ψ points. Scores near 1 are anomalous; around 0.5 or below
 * are normal.
 *
 * Deterministic for a given seed.
 */

export type IsolationForestOptions = {
  /** Number of trees (default 100, as in the original paper). */
  trees?: number;
  /** Sub-sample size per tree, ψ (default 256, capped at the number of rows). */
  sampleSize?: number;
  seed?: number;
};

type Node =
  | { leaf: true; size: number }
  | { leaf: false; feature: number; split: number; left: Node; right: Node };

export type IsolationForest = {
  trees: Node[];
  sampleSize: number;
  features: number;
};

const EULER = 0.5772156649015329;

/** Average path length of an unsuccessful BST search among n points. */
export function averagePathLength(n: number): number {
  if (n <= 1) return 0;
  if (n === 2) return 1;
  return 2 * (Math.log(n - 1) + EULER) - (2 * (n - 1)) / n;
}

function buildTree(rows: number[][], depth: number, limit: number, rand: () => number): Node {
  if (depth >= limit || rows.length <= 1) return { leaf: true, size: rows.length };
  const d = rows[0].length;
  // Only features that still vary in this node can split it.
  const candidates: { f: number; min: number; max: number }[] = [];
  for (let f = 0; f < d; f++) {
    let min = Infinity;
    let max = -Infinity;
    for (const r of rows) {
      if (r[f] < min) min = r[f];
      if (r[f] > max) max = r[f];
    }
    if (max > min) candidates.push({ f, min, max });
  }
  if (!candidates.length) return { leaf: true, size: rows.length };
  const c = candidates[Math.floor(rand() * candidates.length)];
  const split = c.min + rand() * (c.max - c.min);
  const left: number[][] = [];
  const right: number[][] = [];
  for (const r of rows) (r[c.f] < split ? left : right).push(r);
  return {
    leaf: false,
    feature: c.f,
    split,
    left: buildTree(left, depth + 1, limit, rand),
    right: buildTree(right, depth + 1, limit, rand),
  };
}

export function fitIsolationForest(rows: number[][], opts: IsolationForestOptions = {}): IsolationForest {
  if (rows.length < 2) throw new Error("Isolation Forest needs at least 2 rows");
  const features = rows[0].length;
  if (rows.some((r) => r.length !== features || r.some((v) => !Number.isFinite(v)))) {
    throw new Error("All rows must have the same number of finite values");
  }
  const nTrees = opts.trees ?? 100;
  const psi = Math.min(opts.sampleSize ?? 256, rows.length);
  const limit = Math.ceil(Math.log2(psi));
  const rand = mulberry32(opts.seed ?? 42);

  const trees: Node[] = [];
  for (let t = 0; t < nTrees; t++) {
    // Sample ψ rows without replacement (partial Fisher–Yates).
    const idx = rows.map((_, i) => i);
    for (let i = 0; i < psi; i++) {
      const j = i + Math.floor(rand() * (idx.length - i));
      [idx[i], idx[j]] = [idx[j], idx[i]];
    }
    trees.push(buildTree(idx.slice(0, psi).map((i) => rows[i]), 0, limit, rand));
  }
  return { trees, sampleSize: psi, features };
}

function pathLength(node: Node, x: number[], depth: number): number {
  if (node.leaf) return depth + averagePathLength(node.size);
  return pathLength(x[node.feature] < node.split ? node.left : node.right, x, depth + 1);
}

/** Anomaly score in (0, 1]; higher is more unusual. */
export function anomalyScore(forest: IsolationForest, x: number[]): number {
  if (x.length !== forest.features) throw new Error("Wrong number of features");
  const mean = forest.trees.reduce((a, t) => a + pathLength(t, x, 0), 0) / forest.trees.length;
  return 2 ** (-mean / averagePathLength(forest.sampleSize));
}
