import { describe, expect, it } from "vitest";
import type { FarmProfile } from "@/lib/schemas/farm";
import { predictSuitability } from "./suitability";

const farm = {
  name: "T", latitude: 39, longitude: 33, areaHa: 1, currentCrop: "wheat", previousCrops: [],
  irrigation: "none", soilType: "loamy", soilPh: 7, priorities: [], marketCrops: [],
  hasRowPlanter: true, coverCropsOk: true,
} satisfies FarmProfile;

describe("predictSuitability", () => {
  it("never returns a prediction while the model is not trained", () => {
    const r = predictSuitability("wheat", farm);
    expect(r.status).toBe("not-trained");
    expect("yieldAnomalyPct" in r).toBe(false);
  });
});
