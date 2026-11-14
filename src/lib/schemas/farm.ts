import { z } from "zod";

export const CROPS = [
  "wheat",
  "chickpea",
  "sunflower",
  "barley",
  "lentil",
  "corn",
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
] as const;
export type Priority = (typeof PRIORITIES)[number];

export const farmProfileSchema = z.object({
  name: z.string().trim().min(1, "Farm name is required").max(80),
  latitude: z
    .number({ message: "Pick a location on the map" })
    .min(-90)
    .max(90),
  longitude: z
    .number({ message: "Pick a location on the map" })
    .min(-180)
    .max(180),
  areaHa: z
    .number({ message: "Enter the farm area" })
    .positive("Area must be greater than 0")
    .max(100000),
  currentCrop: z.enum(CROPS),
  previousCrops: z.array(z.enum(CROPS)).max(5),
  irrigation: z.enum(IRRIGATION),
  soilType: z.enum(SOIL_TYPES),
  soilPh: z.number().min(3).max(10).nullable(),
  priorities: z.array(z.enum(PRIORITIES)),
});

export type FarmProfile = z.infer<typeof farmProfileSchema>;