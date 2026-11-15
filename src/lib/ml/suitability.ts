import type { Crop, FarmProfile } from "@/lib/schemas/farm";
import { MODEL_CARDS } from "./model-cards";

/**
 * Crop suitability / yield-anomaly model — NOT TRAINED.
 *
 * No verified label source exists yet (see docs/ml/dataset-audit.md §7 and
 * docs/ml/model-cards/crop-suitability.md). Until a model is trained,
 * validated and documented, this function always reports "not-trained" and
 * returns no prediction. The app must never show a score from it.
 */

export type SuitabilityPrediction =
  | { status: "not-trained"; reason: string; doc: string }
  | { status: "ok"; crop: Crop; yieldAnomalyPct: number; interval: [number, number]; modelVersion: string };

export function predictSuitability(crop: Crop, farm: FarmProfile): SuitabilityPrediction {
  void crop;
  void farm;
  const card = MODEL_CARDS.find((c) => c.id === "suitability")!;
  return {
    status: "not-trained",
    reason: "No verified training labels are available yet.",
    doc: card.doc,
  };
}
