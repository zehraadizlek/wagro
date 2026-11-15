# Model card: Environmental anomaly detection (Isolation Forest)

| Field | Value |
|---|---|
| Status | **Not built** (planned for Phase 3) |
| Method label shown in the app | ML (unsupervised) |
| Code | `src/lib/ml/isolation-forest.ts`, `src/lib/ml/anomaly.ts` (to be created) |

## Purpose
Flag months whose combination of weather and soil conditions was unusual for
**this location**, as a prompt to look closer. It does **not** detect crop
disease, pests or confirmed crop damage, and it does not forecast.

## Training data
- The location's own record: NASA POWER daily data aggregated to months,
  target baseline 1996–2025 (≈ 360 months). Verified available with no missing
  values at the test point for 1995–2025 (`dataset-audit.md`, section 2).
- Optional: MODIS NDVI monthly anomaly from GIBS, 2000 onward (gap 2025-04).
- Fitted per location at run time; nothing is shared between users.

## Features (planned)
| Feature | Unit | Source |
|---|---|---|
| Mean temperature anomaly | z-score vs same calendar month | POWER T2M |
| Precipitation anomaly | z-score of monthly total | POWER PRECTOTCORR |
| ET0 anomaly | z-score | Computed (FAO-56) from POWER |
| Water balance (P − ET0) anomaly | z-score | Computed |
| Root-zone wetness anomaly | z-score | POWER GWETROOT |
| Hot days (Tmax ≥ 32 °C) anomaly | z-score | POWER T2M_MAX daily |
| Frost nights anomaly | z-score | POWER T2M_MIN daily |
| NDVI anomaly (optional) | z-score | GIBS MODIS NDVI |

## Target / labels
None (unsupervised).

## Validation strategy (planned)
1. **Synthetic injection:** add known outliers to real records; measure recall and precision.
2. **Stability:** agreement of flagged months across random seeds and across a baseline shifted by ±2 years.
3. **Plausibility:** compare flagged periods with documented regional droughts or heat waves. Qualitative only, reported as such.

## Evaluation metrics
None yet.

## Uncertainty and limitations
- Inputs are gridded (≈ 50 km for POWER, ≈ 1 km for NDVI), not field measurements.
- "Unusual" is relative to 30 years at this grid cell, not to crop needs.
- Short or gappy records reduce reliability; the model must refuse to run below a minimum record length.

## Where human judgment is needed
Whether an unusual month actually affected the crop, and what to do about it.
