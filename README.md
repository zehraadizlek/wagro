# WAGRO — crop rotation decision support from NASA data

WAGRO helps a farmer compare crop rotations that protect the soil and save
water. The farmer answers four short questions; WAGRO reads NASA Earth
observation data for the field and explains which rotation fits best, why,
what is uncertain, and what to check locally. Built for the NASA Space Apps
Challenge 2026. It supports, and does not replace, local agronomic advice.

## What it does

- **Guided input:** field location (map), crops this and recent seasons, soil and irrigation, priorities, and limits (crops you can sell, row-crop planter, cover crops).
- **Your weather:** water balance (FAO-56 ET0), frost dates, hot days, soil moisture now, from 10 years of NASA POWER data.
- **Your last 10 years:** trend tests and dry / normal / wet years, with the best option in each.
- **Unusual months:** months whose weather and soil were rare for the place (Isolation Forest on 30 years of data).
- **Your field up close:** slope and frost-prone low spots from 30 m elevation data.
- **Options:** the current rotation, three rule-based alternatives, and the best balance found by searching every allowed rotation. Each shows why, what it is good for, what it rests on, what is unknown, and what to check locally.
- **Your field over 3 years:** when crops are in the field and when soil is bare.
- **Plant cover:** 3 years of MODIS NDVI at the field, season timing, and a check against the crop calendar.
- **Satellite maps:** MODIS NDVI, SMAP soil moisture, MODIS land temperature and GRACE water storage, with a month slider.
- **What-if sliders:** +0 to +3 °C and −30 % to +10 % rain; everything re-scores.
- **Report page** summarising the results for an adviser, and a **How it works** page.

## How results are labelled

Every result says how it was made. Nothing rule-based is called ML.

| Label | Used for |
|---|---|
| Rule-based | The eight scores (water, nitrogen, organic matter, pest break, erosion, climate fit, soil fit, income) and the hand-built options |
| Statistics | Trends (Mann-Kendall, Sen's slope), year types (k-means), NDVI season timing, single extreme values |
| ML (unsupervised) | Unusual-month detection (Isolation Forest), learned per location without labels |
| Optimization | "Best balance under Wagro's rules": exact Pareto search over every allowed rotation with the same rules |

**No supervised ML model is trained.** Crop suitability / yield prediction is
blocked until verified training labels exist (see
[docs/ml/dataset-audit.md](docs/ml/dataset-audit.md)); the app shows no
prediction from it.

## Data sources

| Source | Use | Access |
|---|---|---|
| NASA POWER (daily, community AG) | Weather, ET0, indicators, 30-year anomaly baseline | Proxied by `/api/nasa-power` and `/api/nasa-power/monthly` |
| NASA GIBS: MODIS NDVI, SMAP L4, MODIS LST, GRACE | Maps; NDVI series read through the published colormap | Browser, no key |
| AWS Terrain Tiles (NASA SRTM where available, other DEMs elsewhere) | Slope and low spots | Browser, no key |
| ISRIC SoilGrids v2 | Modelled soil properties (route ready, not yet shown) | `/api/soilgrids` |
| OpenStreetMap | Base map tiles | Browser |

No API keys or environment variables are needed.

## Run it

Requires Node.js (tested with v24) and npm.

```bash
npm install
```

```bash
npm run dev
```

Then open http://localhost:3000.

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build and server |
| `npm test` | Unit and regression tests (Vitest) |
| `npm run evaluate` | Runs the method evaluation and rewrites [docs/ml/evaluation.md](docs/ml/evaluation.md) |
| `npx eslint src` / `npx tsc --noEmit` | Lint and type check |

This project uses Next.js 16 with Cache Components; see `AGENTS.md`. Pages
are hidden, not unmounted, when you navigate, so imperative libraries such
as Leaflet create a fresh element on every mount.

## Code map

```
src/app/                 pages (/, /farm, /rotation = results, /report, /how) and API routes
src/components/          UI sections (climate, rotation, space, ml badges, layout)
src/lib/nasa/            POWER client, indicators (FAO-56 ET0, frost, heat), stats, GIBS, scenarios
src/lib/features/        monthly feature table and anomalies, NDVI series, phenology
src/lib/ml/              Isolation Forest, anomaly detection, model cards, suitability stub
src/lib/rotation/        crops, calendar, scoring (score.ts), strategies (engine.ts), optimizer, crop limits
src/lib/terrain/         slope and low spots from elevation tiles
src/lib/soil/            SoilGrids parser
docs/ml/                 dataset audit, architecture decision, model cards, evaluation
ml/                      offline workspace for future supervised training (not deployed)
```

Farm answers are stored only in the browser (`localStorage`). There is no
database and no account.

## Known limitations

- Crop values and calendars are prototype estimates for mid-latitude farming; an agronomist should review them. In mild-winter places the assumed wheat calendar can be months off (found for the Western Cape); the app flags this when satellite plant cover disagrees.
- The crop list has 9 temperate and semi-arid crops. Where none fits (tested in the Sahel), the recommendation says so instead of pretending.
- NASA POWER is a ~50 km grid; NDVI is ~1 km and mixes neighbouring fields; elevation is ~30 m.
- Scores compare options under the same rules. They do not predict yield or profit.
- GIBS "latest month" dates are set in `src/lib/nasa/gibs.ts` and need updating over time.

More detail: [docs/ml/README.md](docs/ml/README.md).
