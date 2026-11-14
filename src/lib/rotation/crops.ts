import type { Crop } from "@/lib/schemas/farm";

/**
 * PROTOTYPE ASSUMPTIONS
 * Every number in this file is a relative, simplified value chosen for the
 * first version of the scoring engine. They are NOT validated agronomic
 * facts and must be reviewed by an agronomist before real use.
 */
export const PARAMETERS_NOTE =
  "Crop parameters are prototype assumptions (relative values, not measurements). They require agronomic validation.";

export type CropFamily = "cereal" | "legume" | "oilseed";

export type CropParams = {
  crop: Crop;
  label: string;
  family: CropFamily;
  /** Relative water demand, 1 (low) to 5 (high). */
  waterDemand: number;
  /**
   * Relative nitrogen balance, -2 (strong consumer) to +2 (clear contributor).
   * Legumes are positive because they host nitrogen-fixing bacteria.
   */
  nitrogenBalance: number;
  /** Relative contribution to soil health, 1 (low) to 5 (high). */
  soilHealth: number;
  /** Assumed comfortable mean temperature range for the crop, in degrees C. */
  tempRangeC: [number, number];
  /** Assumed seasonal rainfall range that suits the crop without irrigation, in mm. */
  rainRangeMm: [number, number];
};

export const CROP_PARAMS: Record<Crop, CropParams> = {
  wheat: {
    crop: "wheat",
    label: "Wheat",
    family: "cereal",
    waterDemand: 3,
    nitrogenBalance: -1.5,
    soilHealth: 2.5,
    tempRangeC: [8, 22],
    rainRangeMm: [300, 600],
  },
  barley: {
    crop: "barley",
    label: "Barley",
    family: "cereal",
    waterDemand: 2.5,
    nitrogenBalance: -1,
    soilHealth: 2.5,
    tempRangeC: [7, 20],
    rainRangeMm: [250, 500],
  },
  corn: {
    crop: "corn",
    label: "Corn",
    family: "cereal",
    waterDemand: 4.5,
    nitrogenBalance: -2,
    soilHealth: 2,
    tempRangeC: [18, 30],
    rainRangeMm: [500, 800],
  },
  chickpea: {
    crop: "chickpea",
    label: "Chickpea",
    family: "legume",
    waterDemand: 2,
    nitrogenBalance: 1.5,
    soilHealth: 4,
    tempRangeC: [10, 25],
    rainRangeMm: [250, 450],
  },
  lentil: {
    crop: "lentil",
    label: "Lentil",
    family: "legume",
    waterDemand: 2,
    nitrogenBalance: 1.5,
    soilHealth: 4,
    tempRangeC: [8, 22],
    rainRangeMm: [250, 450],
  },
  sunflower: {
    crop: "sunflower",
    label: "Sunflower",
    family: "oilseed",
    waterDemand: 3,
    nitrogenBalance: -1,
    soilHealth: 3,
    tempRangeC: [15, 28],
    rainRangeMm: [400, 650],
  },
};

export const CROP_LIST: CropParams[] = Object.values(CROP_PARAMS);
