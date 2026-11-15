# Method card: NDVI phenology

| Field | Value |
|---|---|
| Status | **Not built** (planned for Phase 5) |
| Method label shown in the app | Statistics |
| Code | `src/lib/features/phenology.ts` (to be created) |

## Purpose
Describe the seasonal green-up, peak, decline and low-cover months of the land
around the pin from MODIS NDVI, and compare them with the crop calendar the
engine assumes. It does **not** identify crop species.

## Data
MODIS Terra NDVI monthly via NASA GIBS, read from tiles through the published
colormap (≈ 1 km, quantized to ~0.01). Last 3–5 years; gap at 2025-04.

## Method (planned)
Per season, smooth the monthly series, take its minimum and maximum, and mark
green-up and decline where the curve crosses 20 % and 50 % of the seasonal
amplitude (the common amplitude-threshold approach, as used by tools such as
TIMESAT). Low-cover months are those below an NDVI of 0.2.

## Limitations
Monthly steps are coarse (± one month). The footprint mixes neighbouring fields.
Snow and cloud lower winter values.

## Validation (planned)
Check against the crop calendar for known single-crop areas; report agreement
in months. No accuracy claim without such a check.
