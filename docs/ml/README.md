# WAGRO — Machine learning and optimization

Status on 2026-11-15: **Phases 1–3 done.** The first ML component (unusual-month
detection, unsupervised) is built and evaluated on synthetic tests, but **not
yet shown in the app** (Phase 6). No supervised model is trained. The app
still runs the rule-based engine and the existing statistics.

| Document | What it covers |
|---|---|
| [dataset-audit.md](dataset-audit.md) | Every candidate dataset, verified access, coverage and role |
| [architecture-decision.md](architecture-decision.md) | Where ML runs and why (TypeScript in-app; offline Python only for trained models) |
| [model-cards/](model-cards/) | One card per model or method, with status |

| Component | Method label | Status |
|---|---|---|
| Environmental anomaly detection | ML (unsupervised) | **Built and evaluated** (synthetic tests); UI in Phase 6 |
| Rotation optimization | Optimization | Not built — Phase 4 |
| NDVI phenology | Statistics | Not built — Phase 5 |
| Crop suitability / yield anomaly | ML (trained) | **Blocked** — needs a verified TÜİK district export |

## Phase 2 building blocks (built and unit-tested)

| Piece | File | Notes |
|---|---|---|
| Monthly feature table + anomalies | `src/lib/features/monthly.ts` | 7 features per year-month, z-scores vs same calendar month (≥ 5 years) |
| 30-year feature route | `src/app/api/nasa-power/monthly/route.ts` | Server-side aggregation of POWER daily data; verified live |
| NDVI series and statistics | `src/lib/features/ndvi.ts` | Moved out of `PlantGrowth.tsx`; adds NDVI anomalies |
| SoilGrids estimate | `src/lib/soil/soilgrids.ts`, `src/app/api/soilgrids/route.ts` | 0–30 cm depth-weighted mean and 90 % interval; verified live (≈ 9–22 s upstream, cached after) |
| Tests | `src/**/*.test.ts` (`npm test`) | Includes regression tests and an engine snapshot for the existing logic |

Rules for this work: never fabricate training data, never call a rule-based
score an ML prediction, and keep the rule-based engine as the working fallback.
