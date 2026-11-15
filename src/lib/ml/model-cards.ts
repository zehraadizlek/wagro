/**
 * Machine-readable status of every analysis method, so the app can label each
 * result honestly. Keep in sync with docs/ml/model-cards/*.md.
 */

export type MethodLabel =
  | "rule-based"
  | "statistics"
  | "ml-unsupervised"
  | "ml-trained"
  | "optimization";

export const METHOD_TEXT: Record<MethodLabel, string> = {
  "rule-based": "Rule-based",
  statistics: "Statistics",
  "ml-unsupervised": "ML (unsupervised)",
  "ml-trained": "ML (trained)",
  optimization: "Optimization",
};

export type ModelStatus = "not-built" | "built" | "evaluated" | "blocked";

export type ModelCard = {
  id: string;
  name: string;
  method: MethodLabel;
  status: ModelStatus;
  /** One line on what it is for, and what it is not for. */
  purpose: string;
  data: string;
  evaluation: string | null;
  limitations: string[];
  doc: string;
};

export const MODEL_CARDS: ModelCard[] = [
  {
    id: "anomaly",
    name: "Unusual-month detector (Isolation Forest)",
    method: "ml-unsupervised",
    status: "evaluated",
    purpose:
      "Flags months whose mix of weather and soil conditions was rare for this place. It does not detect crop disease or damage and does not forecast.",
    data: "The location's own NASA POWER record: 30 years of monthly anomalies of 7 features. No labels.",
    evaluation:
      "Synthetic tests only (no labels exist): strong injected anomalies 50/50 found; moderate combined anomalies 25/50 vs 1/50 for a max-|z| rule; flags agree across random seeds with Jaccard 0.76 on average.",
    limitations: [
      "Gridded data (about 50 km), not field measurements.",
      "Always flags about 5 % of months, so an ordinary place still gets flags.",
      "A single extreme value with everything else normal can rank below combined anomalies.",
    ],
    doc: "docs/ml/model-cards/anomaly-isolation-forest.md",
  },
  {
    id: "optimizer",
    name: "Rotation optimizer",
    method: "optimization",
    status: "evaluated",
    purpose: "Searches all allowed crop sequences for the best balance of the eight criteria.",
    data: "The rule-based criteria; no training data.",
    evaluation:
      "Exact Pareto front checked against brute force; constraints never violated in tests; 3 seasons ≈ 2 ms, 4 seasons ≈ 18 ms (Node). Same-family crops never follow each other.",
    limitations: ["Only as good as the rule-based criteria and crop values."],
    doc: "docs/ml/model-cards/rotation-optimizer.md",
  },
  {
    id: "phenology",
    name: "Plant-cover seasons (NDVI phenology)",
    method: "statistics",
    status: "built",
    purpose: "Describes green-up, peak and low-cover months around the field. Cannot identify crops.",
    data: "MODIS NDVI monthly from NASA GIBS (about 1 km).",
    evaluation:
      "Synthetic curves give the defined months; on a real 3-year series the typical spring peak matched the winter-wheat calendar. No ground truth for timing.",
    limitations: ["Monthly steps; neighbouring fields mix in; snow lowers winter values."],
    doc: "docs/ml/model-cards/ndvi-phenology.md",
  },
  {
    id: "suitability",
    name: "Crop suitability / yield anomaly",
    method: "ml-trained",
    status: "blocked",
    purpose: "Would estimate how a crop tends to perform under given weather. Not available.",
    data: "No verified labels. Needs district yields (TÜİK) that have not been exported.",
    evaluation: null,
    limitations: ["Not trained. The app shows no prediction from it."],
    doc: "docs/ml/model-cards/crop-suitability.md",
  },
];
