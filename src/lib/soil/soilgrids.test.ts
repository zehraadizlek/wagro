import { describe, expect, it } from "vitest";
import fixture from "./__fixtures__/soilgrids-39n-33e.json";
import { parseSoilGrids, soilgridsQuery, textureClass } from "./soilgrids";

// The fixture is one real SoilGrids response for lat 39, lon 33,
// saved on 2026-11-15. It is used only to test parsing.

describe("parseSoilGrids", () => {
  const s = parseSoilGrids(fixture)!;

  it("converts mapped units with d_factor and weights depths 0–30 cm", () => {
    // pH 7.5, 7.6, 7.7 over 5, 10, 15 cm → (37.5 + 76 + 115.5) / 30 = 7.63
    expect(s.ph.mean).toBeCloseTo(7.6, 1);
    // clay 30.1, 31.4, 36.8 % → (150.5 + 314 + 552) / 30 = 33.9 %
    expect(s.clay.mean).toBeCloseTo(33.9, 1);
    // SOC 20.8, 13.3, 8.8 g/kg → 12.3 g/kg
    expect(s.soc.mean).toBeCloseTo(12.3, 1);
  });

  it("keeps the 90 % interval around the mean", () => {
    for (const e of [s.ph, s.clay, s.sand, s.silt, s.soc]) {
      expect(e.low).toBeLessThanOrEqual(e.mean);
      expect(e.high).toBeGreaterThanOrEqual(e.mean);
    }
  });

  it("maps the texture to a Wagro soil type", () => {
    expect(s.texture).toBe("loamy");
    expect(s.source).toMatch(/SoilGrids/);
  });

  it("returns null for points without data", () => {
    expect(parseSoilGrids({ properties: { layers: [] } })).toBeNull();
    expect(parseSoilGrids({})).toBeNull();
    expect(parseSoilGrids(null)).toBeNull();
  });
});

describe("textureClass", () => {
  it("follows the simplified USDA rules", () => {
    expect(textureClass(45, 20, 35)).toBe("clay");
    expect(textureClass(8, 85, 7)).toBe("sandy");
    expect(textureClass(15, 20, 65)).toBe("silty");
    expect(textureClass(20, 40, 40)).toBe("loamy");
  });
});

describe("soilgridsQuery", () => {
  it("asks for 5 properties, 3 depths, mean and 90 % interval", () => {
    const u = new URL(soilgridsQuery(39, 33));
    expect(u.searchParams.getAll("property")).toHaveLength(5);
    expect(u.searchParams.getAll("depth")).toEqual(["0-5cm", "5-15cm", "15-30cm"]);
    expect(u.searchParams.getAll("value")).toEqual(["mean", "Q0.05", "Q0.95"]);
    expect(u.searchParams.get("lon")).toBe("33");
  });
});
