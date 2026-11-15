# WAGRO — Machine learning and optimization

Status on 2026-11-15: **All 7 phases done.** The first ML component (unusual-month
detection, unsupervised) is built and evaluated on synthetic tests, but **not
yet shown in the app** (Phase 6). No supervised model is trained. The app
still runs the rule-based engine and the existing statistics.

| Document | What it covers |
|---|---|
| [dataset-audit.md](dataset-audit.md) | Every candidate dataset, verified access, coverage and role |
| [architecture-decision.md](architecture-decision.md) | Where ML runs and why (TypeScript in-app; offline Python only for trained models) |
| [model-cards/](model-cards/) | One card per model or method, with status |
| [evaluation.md](evaluation.md) | Generated results (`npm run evaluate`) |
| [reports/unsupervised-anomaly-detection.md](reports/unsupervised-anomaly-detection.md) | Technical report on the Isolation Forest component |
| [../project/team-project-brief.md](../project/team-project-brief.md) | Project brief for the team's submission materials |

| Component | Method label | Status |
|---|---|---|
| Environmental anomaly detection | ML (unsupervised) | **Built and evaluated**; recent flags appear as an information-only note in the recommendation; full card in Phase 6 |
| Rotation optimization | Optimization | **Built and tested**; its best option is now shown as "Best balance under Wagro's rules" |
| NDVI phenology | Statistics | **Built and tested**; drives a calendar check in the recommendation |
| Crop suitability / yield anomaly | ML (trained) | **Blocked** — needs a verified TÜİK district export |

## Phase 2 building blocks (built and unit-tested)

| Piece | File | Notes |
|---|---|---|
| Monthly feature table + anomalies | `src/lib/features/monthly.ts` | 7 features per year-month, z-scores vs same calendar month (≥ 5 years) |
| 30-year feature route | `src/app/api/nasa-power/monthly/route.ts` | Server-side aggregation of POWER daily data; verified live |
| NDVI series and statistics | `src/lib/features/ndvi.ts` | Moved out of `PlantGrowth.tsx`; adds NDVI anomalies |
| SoilGrids estimate | `src/lib/soil/soilgrids.ts`, `src/app/api/soilgrids/route.ts` | 0–30 cm depth-weighted mean and 90 % interval; verified live (≈ 9–22 s upstream, cached after) |
| Tests | `src/**/*.test.ts` (`npm test`) | Includes regression tests and an engine snapshot for the existing logic |

## Phase 5 integration (what changed in the app)
- Every strategy now carries `method` ("rule-based" or "optimization") and `sources`.
- The optimizer's best rotation is added as a fifth option, "Best balance under Wagro's rules", when it differs from the hand-built four; otherwise the matching option says the search found nothing better.
- The recommendation can add two information-only notes: recent unusual months (ML, unsupervised) and a satellite-versus-calendar timing mismatch (Statistics). Neither changes any score.
- `predictSuitability()` exists and always returns "not-trained".

## Phase 6 display (what the user sees)
- A small method badge (Rule-based, Statistics, ML (unsupervised), Optimization) on the suggestion, every option card, "Your last 10 years", "Plant cover" and "Unusual months".
- "Unusual months" card: recent and strongest flags from the Isolation Forest, plus single extreme values the model did not flag (labelled Statistics), with a one-line limitation.
- "Plant cover" adds season timing (green-up or "green through winter", peak, fade) and whether it fits the crop calendar.
- The How page lists the methods with badges and the status of each model, including the untrained suitability model.

## Phase 7 manual QA (2026-11-15, dev server)

| Check | Result |
|---|---|
| Southern hemisphere: Swartland, South Africa (−33.4, 18.7) | Runs without errors; frost "rare", heat and dry months plausible. **Finding:** satellite plant cover peaks in Aug, but the shifted calendar assumes wheat peaks in Nov; the app shows the mismatch note as designed. Calendars for mild winters need local values. |
| Hot, frost-free: Sahel, Niger (13.5, 2.1) | Runs without errors; 197 hot days/year, no frost. **Finding:** the 9-crop list does not fit (best score 44, "best balance" barley → vetch → safflower). Added a warning when the best option scores below 50. |
| Phone width 375 px: results and How pages | No horizontal overflow |
| Report with five options | Table and chart render; method labels shown; outdated limitation text fixed |

## What is still open

- Supervised crop suitability / yield model: blocked until a TÜİK district export is verified (dataset-audit.md §7).
- Climate-aware crop calendars (mild winters, tropics) and crops for other regions.
- Showing SoilGrids next to the farmer's soil input (route built, not displayed).
- Reading GIBS latest dates at run time instead of the fixed values in `gibs.ts`.

Rules for this work: never fabricate training data, never call a rule-based
score an ML prediction, and keep the rule-based engine as the working fallback.
