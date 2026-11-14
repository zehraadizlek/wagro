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
  /** Relative value as animal feed (hay, silage, straw, grazing), 0 to 5. */
  forageValue: number;
  /** Relative ease of selling at a fair price, 1 to 5. */
  marketValue: number;
  /** How deep the roots usually reach. Deep roots open the subsoil and reach stored water. */
  rootDepth: "shallow" | "medium" | "deep";
  /** Copes comparatively well with dry spells. */
  droughtTolerant: boolean;
  /** Needs a row-crop (precision) planter. */
  needsRowPlanter: boolean;
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
    forageValue: 2,
    marketValue: 4,
    rootDepth: "medium",
    droughtTolerant: false,
    needsRowPlanter: false,
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
    forageValue: 3,
    marketValue: 3,
    rootDepth: "medium",
    droughtTolerant: true,
    needsRowPlanter: false,
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
    forageValue: 4,
    marketValue: 4,
    rootDepth: "medium",
    droughtTolerant: false,
    needsRowPlanter: true,
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
    forageValue: 1,
    marketValue: 4,
    rootDepth: "medium",
    droughtTolerant: true,
    needsRowPlanter: false,
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
    forageValue: 2,
    marketValue: 4,
    rootDepth: "shallow",
    droughtTolerant: true,
    needsRowPlanter: false,
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
    forageValue: 1,
    marketValue: 4,
    rootDepth: "deep",
    droughtTolerant: true,
    needsRowPlanter: true,
  },
  vetch: {
    crop: "vetch",
    label: "Vetch",
    family: "legume",
    waterDemand: 2,
    nitrogenBalance: 2,
    soilHealth: 4.5,
    tempRangeC: [5, 20],
    rainRangeMm: [300, 600],
    phRange: [6, 8],
    soilTypeFit: { sandy: 75, loamy: 100, clay: 80, silty: 90 },
    calendar: { sowMonths: [10, 11], harvestMonth: 5 },
    frostTolerant: true,
    heatStressC: 30,
    forageValue: 5,
    marketValue: 3,
    rootDepth: "medium",
    droughtTolerant: false,
    needsRowPlanter: false,
  },
  sorghum: {
    crop: "sorghum",
    label: "Sorghum",
    family: "cereal",
    waterDemand: 2.5,
    nitrogenBalance: -1.5,
    soilHealth: 3,
    tempRangeC: [18, 32],
    rainRangeMm: [350, 650],
    phRange: [5.5, 8],
    soilTypeFit: { sandy: 80, loamy: 100, clay: 85, silty: 90 },
    calendar: { sowMonths: [5], harvestMonth: 9 },
    frostTolerant: false,
    heatStressC: 35,
    forageValue: 4,
    marketValue: 3,
    rootDepth: "deep",
    droughtTolerant: true,
    needsRowPlanter: true,
  },
  safflower: {
    crop: "safflower",
    label: "Safflower",
    family: "oilseed",
    waterDemand: 2,
    nitrogenBalance: -1,
    soilHealth: 3.5,
    tempRangeC: [10, 28],
    rainRangeMm: [250, 500],
    phRange: [6, 8],
    soilTypeFit: { sandy: 70, loamy: 95, clay: 80, silty: 85 },
    calendar: { sowMonths: [3, 4], harvestMonth: 8 },
    frostTolerant: false,
    heatStressC: 35,
    forageValue: 1,
    marketValue: 3,
    rootDepth: "deep",
    droughtTolerant: true,
    needsRowPlanter: false,
  },
};

/**
 * A cover crop grown in empty months and not harvested, for example a
 * vetch and rye mix. Prototype assumptions, like the crops above.
 */
export const COVER_CROP = {
  label: "Cover crop (e.g. vetch + rye)",
  /** Added to the nitrogen balance when a legume mix is used. */
  nitrogenBonus: 0.3,
  /** Added to the organic matter score. */
  soilBonus: 12,
  /** Subtracted from the water score without irrigation when monthly data is missing. */
  waterPenalty: 6,
  /** Share of reference evapotranspiration (ET0) a cover crop uses. */
  waterFactor: 0.5,
  /** Shortest empty spell, in months, worth filling with a cover crop. */
  minGapMonths: 4,
};

export const CROP_LIST: CropParams[] = Object.values(CROP_PARAMS);
