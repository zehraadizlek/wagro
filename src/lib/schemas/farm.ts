import { z } from "zod";

export const CROPS = [
  "wheat",
  "chickpea",
  "sunflower",
  "barley",
  "lentil",
  "corn",
  "vetch",
  "sorghum",
  "safflower",
] as const;
export type Crop = (typeof CROPS)[number];

export const SOIL_TYPES = [
  "sandy",
  "loamy",
  "clay",
  "silty",
  "unknown",
] as const;
export type SoilType = (typeof SOIL_TYPES)[number];

export const IRRIGATION = ["none", "limited", "full"] as const;
export type Irrigation = (typeof IRRIGATION)[number];

export const PRIORITIES = [
  "water-efficiency",
  "soil-health",
  "nitrogen-management",
  "crop-diversity",
  "erosion-control",
  "extra-income",
  "animal-feed",
] as const;
export type Priority = (typeof PRIORITIES)[number];

export const farmProfileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Give your field a name")
    .max(80, "Farm name must be 80 characters or fewer"),
  latitude: z
    .number({ message: "Click the map to place your field" })
    .min(-90, "Latitude must be between -90 and 90")
    .max(90, "Latitude must be between -90 and 90"),
  longitude: z
    .number({ message: "Click the map to place your field" })
    .min(-180, "Longitude must be between -180 and 180")
    .max(180, "Longitude must be between -180 and 180"),
  areaHa: z
    .number({ message: "Enter the field size" })
    .positive("Area must be greater than 0")
    .max(100000, "Area must be 100000 ha or less"),
  currentCrop: z.enum(CROPS),
  previousCrops: z.array(z.enum(CROPS)).max(5, "Choose at most 5 previous crops"),
  irrigation: z.enum(IRRIGATION),
  soilType: z.enum(SOIL_TYPES),
  soilPh: z
    .number({ message: "Enter pH as a number, for example 6.8" })
    .min(3, "pH must be between 3 and 10")
    .max(10, "pH must be between 3 and 10")
    .nullable(),
  priorities: z.array(z.enum(PRIORITIES)),
  /** Crops the farmer can sell nearby. Empty means no limit. */
  marketCrops: z.array(z.enum(CROPS)).default([]),
  /** Whether the farm has a row-crop planter (needed for corn, sunflower, sorghum). */
  hasRowPlanter: z.boolean().default(true),
  /** Whether the farmer is open to cover crops that are not harvested. */
  coverCropsOk: z.boolean().default(true),
});

export type FarmProfile = z.infer<typeof farmProfileSchema>;
