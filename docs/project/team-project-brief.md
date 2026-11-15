# WAGRO — Team project brief

**For:** team members writing the NASA Space Apps project description, the presentation and the submission materials.
**Status:** describes the code on `main` at the commit that adds this file. If you write something that is not in this brief, check the code first.

> **One rule for all our materials:** WAGRO is a **prototype decision-support system**. It combines NASA environmental data, the farmer's own answers, explainable rules, statistics, one unsupervised machine-learning component and an optimization search. It is **not** a trained AI that predicts yields, it does **not** identify crops from satellites, it does **not** measure soil moisture in the field, and it does **not** replace an agronomist.

---

## 1. What WAGRO is

WAGRO is a web app that helps a farmer compare **crop rotations**, meaning the order in which crops follow each other on a field over several seasons. It aims at rotations that protect the soil and save water. The farmer answers four short questions. WAGRO reads NASA Earth-observation data for the area around the field and shows which rotation scores best under its rules, why, what is uncertain, and what to check locally. A printable report can be taken to an adviser.

## 2. The agricultural problem

- Repeating the same cereal year after year (for example wheat → barley → wheat) depletes soil nitrogen and organic matter and lets pests and diseases build up.
- Bare soil between crops is exposed to erosion.
- In dry regions, water is the limiting factor: a rotation must fit the rain and evaporation of the place.
- Weather is changing, so the last few years may not be typical.
- Farmers rarely have an easy way to combine climate data, soil conditions and rotation principles. WAGRO makes those trade-offs visible and explainable.

## 3. User workflow

1. **Home → Start.**
2. **"My farm": a 4-step form.**
   - Field location (click on a map), name and area.
   - Current crop and up to 5 previous crops.
   - Soil type, pH (optional) and irrigation (none / limited / full).
   - Priorities and limits: which crops the farmer can sell, whether they have a row-crop planter, whether cover crops are acceptable.
   - Answers are saved only in the browser (`localStorage`). There are no accounts and no database.
3. **Results page.**
   - Your weather.
   - Your last 10 years.
   - Unusual months.
   - Your field up close (slope and low spots).
   - The recommendation.
   - Option cards.
   - Your field over 3 years (the season timeline).
   - Plant cover around your field.
   - Satellite maps.
   - What-if sliders.
4. **Report**, a printable summary for an adviser.
5. **How it works**, the methods, labels and limitations.

## 4. NASA and other data sources

| Source | What it contributes | Resolution |
|---|---|---|
| **NASA POWER** daily, AG community (T2M, T2M_MAX, T2M_MIN, PRECTOTCORR, RH2M, WS2M, ALLSKY_SFC_SW_DWN, GWETTOP, GWETROOT) | Temperature, rain, humidity, wind, solar radiation and modelled soil wetness. 10 years drive the scores; 30 years drive the unusual-month detection. | About 50 km grid |
| **MODIS Terra NDVI** (NASA GIBS) | Monthly plant-cover maps, and a 3-year NDVI series around the pin read from the map tiles through NASA's published colormap | About 1 km |
| **SMAP L4 root-zone soil moisture** (GIBS) | Soil-moisture map layer | About 9 km, model-assimilated |
| **MODIS land surface temperature**, monthly daytime (GIBS) | Ground-heat map layer | About 1 km or more |
| **GRACE water storage** (GIBS) | Underground water-storage anomaly map layer; the GIBS layer ends in 2022-07 | About 300 km |
| **AWS Terrain Tiles** (NASA SRTM where available, other DEMs such as EU-DEM elsewhere) | Slope and frost-prone low spots, which feed the erosion score | About 30 m |
| ISRIC SoilGrids v2 | Server route built and tested, **not shown in the app yet** | 250 m model |
| OpenStreetMap | Base map | — |

No API keys are needed.

## 5. Climate indicators and environmental analysis

All indicators come from the 10-year NASA POWER daily record (`src/lib/nasa/indicators.ts`):

- **Water balance:** monthly rain against reference evapotranspiration (ET0). ET0 uses FAO-56 Penman-Monteith, with Hargreaves as a fallback when inputs are missing.
- **Frost:** frost nights (Tmin < 0 °C), hard frost (< −5 °C), and the typical last spring and first autumn frost dates (hemisphere-aware).
- **Heat:** days at or above 30, 32 and 35 °C per month.
- **Soil moisture now:** the last 30 days of root-zone wetness compared with the same days in earlier years. This is a **model estimate for the area**, not a field measurement.
- **Long-term climate fit** (changed in this sprint): 10-year mean temperature and mean yearly rain, compared with each crop's prototype ranges, including the upper rain bound. The last 12 months are shown only as recent context.

## 6. Rule-based crop rotation engine (method label: Rule-based)

- **9 crops:** wheat, barley, corn, sorghum, chickpea, lentil, vetch, sunflower, safflower. They fall into three families: cereals, legumes and oilseeds. A cover-crop mix is also available.
- **Crop values:** water demand, nitrogen effect, soil-health effect, temperature/rain/pH ranges, calendars, heat and frost sensitivity, market and forage value. These are **prototype estimates made by the team and not validated by an agronomist.**
- **8 criteria, each 0–100:**
  - Water use (a monthly water budget);
  - Nitrogen;
  - Soil organic matter;
  - Pest and disease break;
  - Erosion protection (bare months, plus slope from terrain);
  - Climate fit (half long-term fit, half seasonal frost, heat and drought stress);
  - Soil fit;
  - Income and feed.
- **Weights:** base weights, plus 0.1 for each priority the farmer picks, then normalized. Missing data removes a criterion, and the remaining weights are rescaled.
- **Options compared:**
  - Your current rotation (always shown first);
  - Add a legume;
  - Mix crop types;
  - Cover crops, less water;
  - Best balance under Wagro's rules (the optimization result, section 7).
- **Farmer limits respected:** market crops, row planter, cover crops. If the limits leave fewer than two crops, they are relaxed and the app says so.
- **Wording:** the highest-scoring option is labelled "Highest score under Wagro's rules". Scores compare options under the same rules; they do **not** predict yield or profit.

## 7. Optimization: exhaustive Pareto search (method label: Optimization)

- **Search space:** every allowed 3-season rotation from the farmer's crop pool.
- **Rules:**
  - Do not repeat the current crop first.
  - Families must alternate, so two crops of the same family never follow each other.
  - Cover crops are used only if allowed.
- **Method:** every candidate is scored with the same eight criteria. The search keeps the **Pareto front**, the options that no other option beats on every criterion, and returns the best weighted option. If it differs from the four hand-built options, it is shown as "Best balance under Wagro's rules".
- **Evaluation** (`docs/ml/evaluation.md`), on synthetic weather across 72 farm variants:
  - The searched option is at least as good as the best hand-built option in 72/72 variants, with a mean gain of 5.19 points.
  - There are 0 rule violations.
  - 3 seasons: 96 candidates, searched in about 2 ms.
- **This is not ML.** It shows that the search works under the rules. It does not show that the rotations are better in the field.

## 8. Unsupervised ML: Isolation Forest (method label: ML (unsupervised))

- **What it does:** flags months that were unusual for the location, considering 7 monthly features together:
  - temperature;
  - rain;
  - ET0;
  - water balance;
  - root-zone soil wetness;
  - hot days (≥ 32 °C);
  - frost nights.

  Each feature is a z-score against the same calendar month over up to 30 years (360 months).
- **Model:** 100 trees, sub-sample 256, seed 42. It flags the top 5 % of months and explains each flag by its strongest features. It is fitted per location in the browser, with no labels.
- **Evaluation** on planted synthetic anomalies:
  - Strong anomalies: 49/50 found.
  - Moderate anomalies spread over 5 features: 34/50 found, against 2/50 for a simple max-|z| threshold rule.
  - Stability across seeds: 0.76 (Jaccard).
- **Use:** an "Unusual months" card, and one information-only note in the recommendation. **It does not change any score.**
- **It detects unusual weather, not crop damage**, and it is not a yield model.
- Full details: `docs/ml/reports/unsupervised-anomaly-detection.md`.

## 9. Statistical methods (method label: Statistics)

- **Mann-Kendall trend test + Sen's slope** on yearly mean temperature and yearly rain: "rising about X per decade, clear trend or could be chance".
- **k-means clustering (k = 3)** on yearly rain, grouping years into dry, normal and wet. For each group, WAGRO re-scores the options with that group's weather and shows which option scores best. The best option per group comes from the rule-based scores and the search, not from the statistics.
- **NDVI season timing (phenology):**
  - From 3 years of MODIS NDVI, find the green-up, peak and fade months using amplitude thresholds of 20 % and 50 %.
  - Report "green through winter" for winter crops.
  - Compare the typical peak with the crop calendar.
  - A mismatch adds a note; it does not change scores.
- **Single extreme values** (|z| ≥ 3) shown next to the ML flags.

## 10. Satellite and geospatial features

- **MODIS NDVI:** a map with a month slider, plus a 3-year plant-cover chart around the pin. It shows how green the **area** was. It **cannot identify which crop** is growing, and the ~1 km pixel mixes neighbouring fields and natural vegetation.
- **SMAP:** a root-zone soil-moisture map layer (a model-assimilated product, about 9 km).
- **Land surface temperature (MODIS):** a monthly daytime ground-heat map layer.
- **GRACE:** a very coarse (about 300 km) map layer of the underground water-storage anomaly.
- **Terrain:**
  - Slope (Horn method) and frost-prone low spots, from about 30 m elevation tiles, inside a circle the size of the farm centred on the pin. **This circle is not the real field boundary.**
  - Mean slope feeds the erosion criterion.

## 11. What-if climate scenarios

Sliders: temperature +0 to +3 °C (steps of 0.5), rain −30 % to +10 % (steps of 5 %). This uses the delta method: every day of the 10-year record is shifted or scaled by the same amount, and all scores, indicators and the timeline are recalculated. It is a **stress test, not a forecast**. Soil wetness is not changed by the sliders.

## 12. Three-year crop calendar and bare periods

"Your field over 3 years" shows, month by month:
- when each crop of the rotation is in the field;
- when the soil is bare;
- where cover crops fill gaps.

It also flags frost, heat or dry months during crop months, and rainy months on bare soil (erosion risk). Calendars are **typical sowing and harvest months set for northern mid-latitudes and shifted 6 months in the southern hemisphere.** They are not the farmer's own dates. A known limitation: in mild-winter places such as the Western Cape, the assumed calendar can be months off. The NDVI timing check points this out.

## 13. Explainability

Every option card shows:
- **why** it is suggested;
- **what it is good for** (its strongest criteria);
- **what it rests on** (data sources and the farmer's inputs);
- **what is unknown**;
- **what to check locally**.

Every result has a **method badge**: Rule-based, Statistics, ML (unsupervised) or Optimization. The recommendation compares the top option with the current rotation and lists cautions, including a warning when even the best option scores below 50 (the crop list may not suit the area).

## 14. Farmer constraints and priorities

- **Priorities** (any number): water efficiency, soil health, nitrogen management, crop diversity, erosion control, extra income, animal feed. Each one raises the weight of its criterion.
- **Constraints:**
  - crops the farmer can sell;
  - row-crop planter available (corn, sorghum and sunflower need one);
  - cover crops acceptable;
  - irrigation level.

## 15. Current limitations and data resolution

- POWER weather and soil wetness describe a **~50 km area**, not the field. NDVI is about 1 km, SMAP about 9 km, GRACE about 300 km, elevation about 30 m.
- Crop values and calendars are **prototype estimates, not agronomist-validated**.
- 9 temperate and semi-arid crops only. In the Sahel no option fits well, and the app warns about this.
- Scores compare options under the same rules. They do not predict yield, profit or crop damage.
- The anomaly detector finds statistically unusual months, not harmful ones.
- GIBS "latest month" dates are fixed in the code and need updating over time.
- The app has no field boundary. The terrain circle is an approximation.
- Print/PDF output of the report has had only a basic check.

## 16. Implemented versus planned

| Implemented | Planned / not done |
|---|---|
| 4-step farm form, results, report, How page | Demo farm button, public deployment |
| NASA POWER indicators (10 and 30 years) | Climate-aware crop calendars (instead of fixed calendars) |
| Rule-based engine with 8 criteria and 4 hand-built strategies | Cited crop parameters (for example FAO ECOCROP) and a crop-viability check |
| Exhaustive Pareto rotation search | SoilGrids values shown next to the farmer's soil input |
| Isolation Forest unusual-month detection | Water-stress timeline view |
| Mann-Kendall / Sen trends; k-means year types | Runtime GIBS dates |
| NDVI phenology and calendar check | **Supervised crop suitability / yield model: does not exist.** It is blocked until verified yield labels exist (TÜİK district data not exported) |
| GIBS map layers (NDVI, SMAP, LST, GRACE) | — |
| Terrain slope and low spots | — |
| What-if sliders | — |
| 107 automated tests; `npm run evaluate` report | — |

## 17. Technical architecture

- **Framework:** Next.js 16 (App Router), React 19, TypeScript (strict), Tailwind CSS 4, Recharts, Leaflet, Zod, Vitest.
- **Server routes:**
  - `/api/nasa-power` (10-year daily data);
  - `/api/nasa-power/monthly` (up to 30 years aggregated to months on the server);
  - `/api/soilgrids`.
- **Browser:** all scoring, statistics, the Isolation Forest, the optimizer, GIBS tile reading and terrain analysis run in the browser, in dependency-free TypeScript.
- **Storage:** no database. Farm answers are kept in `localStorage`.
- **Code map:**
  - `src/lib/nasa` — data and indicators;
  - `src/lib/rotation` — crops, scoring, strategies, optimizer, calendar;
  - `src/lib/ml` — Isolation Forest, anomaly detection, model cards;
  - `src/lib/features` — monthly features, NDVI, phenology;
  - `src/lib/terrain`;
  - `src/lib/soil`;
  - `docs/ml` — dataset audit, model cards, evaluation, reports.

## 18. Short project description (~100 words)

WAGRO is a prototype decision-support tool that helps farmers compare crop rotations that protect soil and save water. A farmer answers four short questions about the field, crops, soil and priorities. WAGRO reads NASA POWER weather, MODIS plant cover, SMAP, GRACE and elevation data for the area around the field. It then scores the current rotation and alternatives with transparent rules and searches every allowed rotation for the best balance. Statistics show climate trends and dry or wet years, and an unsupervised Isolation Forest flags unusual recent months. Every result explains why, what is uncertain and what to check locally.

## 19. Longer project description (~250 words)

Crop rotation is one of the cheapest ways to keep soil fertile, break pest cycles and cope with drought. Yet choosing a rotation means weighing climate, water, soil and income at once, often without easy access to data. WAGRO is a prototype web app that brings NASA Earth-observation data to this decision in plain language.

The farmer marks the field on a map and answers four short questions: crops grown recently, soil and irrigation, priorities such as water efficiency or soil health, and practical limits such as which crops they can sell. WAGRO then reads 10 years of NASA POWER weather for the surrounding area. It calculates water balance (FAO-56), frost dates, hot days and modelled soil wetness, and adds MODIS NDVI plant cover, SMAP soil moisture, land temperature, GRACE water storage and slope from elevation data.

Five rotation options are scored on eight transparent criteria, including water use, nitrogen, organic matter, erosion and climate fit. One option comes from an exhaustive Pareto search over every allowed rotation. Statistical tests show temperature and rain trends and which option holds up in dry, normal and wet years. An unsupervised Isolation Forest, fitted on 30 years of the location's own data, flags recent months that were unusual for that place. What-if sliders test warmer and drier futures.

Every result carries a label (rule-based, statistics, unsupervised ML or optimization) and explains its reasons, uncertainties and local checks. WAGRO supports, and does not replace, local agronomic advice.

## 20. Key innovations and technical contributions

- **Plain-language rotation comparison** built on NASA data, with an explanation for every option (why, good for, rests on, unknown, check locally).
- **Honest method labelling:** rule-based, statistics, unsupervised ML and optimization are always shown separately. Nothing rule-based is called AI.
- **Exhaustive Pareto search** over all allowed rotations, with agronomic constraints (family alternation, farmer limits).
- **Dependency-free Isolation Forest in the browser,** fitted per location on 30 years of NASA POWER data, evaluated with planted anomalies against a threshold baseline.
- **NDVI read directly from NASA GIBS map tiles** via the published colormap, used for season timing and a calendar sanity check.
- **Field-scale terrain** (slope and cold-air low spots) from elevation tiles, feeding the erosion criterion.
- **Climate stress testing** with delta-method what-if sliders that re-score everything.
- **Reproducible evaluation** (`npm run evaluate`) and model cards that state what is and is not validated.

### Terms to avoid in our materials
- "AI predicts the best crop" or "the model predicts yield": there is no such model.
- "Satellites detect your crop" or "soil moisture in your field": the data shows the area, not the field.
- "Scientifically validated": crop values are prototype estimates, and there is no ground-truth validation.
- "Replaces agronomists": it supports local advice.
