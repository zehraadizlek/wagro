# Model card: Crop suitability / yield-anomaly model

| Field | Value |
|---|---|
| Status | **Blocked — no verified labels** |
| Method label shown in the app | ML (trained) — only once validated; until then nothing is shown |
| Code | `src/lib/ml/suitability.ts` will return `{ status: "not-trained" }` |

## Purpose
Estimate how a crop tends to perform at a location under given weather,
relative to that place's normal yield. It would complement, not replace, the
rule-based climate and soil fit.

## Why it is blocked
- No public field-level yield or suitability labels were found.
- FAOSTAT has only national yields (64 years per crop for Türkiye): too few and too coarse.
- ESA WorldCereal is one year of crop presence maps; presence is not suitability.
- TÜİK MEDAS lists crop production statistics, but district granularity and
  export are **not verified** (`dataset-audit.md`, section 7).

## Candidate design if TÜİK district data exports
- Unit: district × crop × year (Türkiye only).
- Target: yield anomaly = yield minus the district's trend line (removes technology trend).
- Features: district-average weather from POWER for the crop's season
  (rain, ET0 deficit, hot days at flowering, frost nights), NDVI anomaly,
  SoilGrids pH / clay / SOC, irrigated share if available.
- Models to compare: a climatology baseline (predict 0), linear regression, Random Forest, gradient boosting.
- Validation: **leave-one-year-out** and **spatial block** cross-validation (whole provinces held out).
- Metrics: RMSE and MAE of the anomaly; skill versus the baseline; R².
- Export: JSON tree ensemble evaluated in TypeScript (`architecture-decision.md`).

## Limitations (expected)
District averages hide field differences; results apply to Türkiye only;
management and variety effects are not observed.
