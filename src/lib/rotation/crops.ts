import type { Crop, SoilType } from "@/lib/schemas/farm";

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
  /** Assumed comfortable soil pH range. */
  phRange: [number, number];
  /** Assumed suitability of each soil texture, 0 to 100. "unknown" is skipped in scoring. */
  soilTypeFit: Record<Exclude<SoilType, "unknown">, number>;
  /**
   * Assumed field calendar for the northern mid-latitudes (months 1 to 12).
   * Mirrored by six months in the southern hemisphere.
   */
  calendar: { sowMonths: number[]; harvestMonth: number };
  /** Whether the crop usually survives winter frost while young. */
  frostTolerant: boolean;
  /** Daily maximum temperature (°C) above which flowering and grain fill are assumed to suffer. */
  heatStressC: 30 | 32 | 35;
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
    phRange: [6, 7.5],
    soilTypeFit: { sandy: 55, loamy: 100, clay: 85, silty: 90 },
    calendar: { sowMonths: [10, 11], harvestMonth: 7 },
    frostTolerant: true,
    heatStressC: 32,
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
    phRange: [6, 7.5],
    soilTypeFit: { sandy: 70, loamy: 100, clay: 75, silty: 90 },
    calendar: { sowMonths: [10, 11], harvestMonth: 6 },
    frostTolerant: true,
    heatStressC: 32,
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
    phRange: [5.8, 7],
    soilTypeFit: { sandy: 50, loamy: 100, clay: 70, silty: 95 },
    calendar: { sowMonths: [4, 5], harvestMonth: 10 },
    frostTolerant: false,
    heatStressC: 35,
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
    phRange: [6, 8],
    soilTypeFit: { sandy: 80, loamy: 90, clay: 60, silty: 85 },
    calendar: { sowMonths: [3, 4], harvestMonth: 7 },
    frostTolerant: false,
    heatStressC: 32,
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
    phRange: [6, 8],
    soilTypeFit: { sandy: 80, loamy: 95, clay: 65, silty: 85 },
    calendar: { sowMonths: [11, 12], harvestMonth: 6 },
    frostTolerant: true,
    heatStressC: 30,
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
    phRange: [6, 7.5],
    soilTypeFit: { sandy: 70, loamy: 100, clay: 80, silty: 90 },
    calendar: { sowMonths: [4, 5], harvestMonth: 9 },
    frostTolerant: false,
    heatStressC: 35,
  },
};

export const CROP_LIST: CropParams[] = Object.values(CROP_PARAMS);
