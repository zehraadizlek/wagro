import { CROPS, type Crop, type FarmProfile } from "@/lib/schemas/farm";
import { CROP_PARAMS } from "./crops";

/** Crops the farmer can actually grow and sell. */
export type Pool = { crops: Crop[]; limited: boolean; relaxed: boolean };

/** Crops allowed by the farmer's market list and machinery. */
export function allowedCrops(farm: FarmProfile): Pool {
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
