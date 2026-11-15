# Model card: Environmental anomaly detection (Isolation Forest)

| Field | Value |
|---|---|
| Status | **Built and evaluated on synthetic tests** (2026-11-15). Shown in the "Unusual months" card and as a note in the recommendation. |
| Method label shown in the app | ML (unsupervised) |
| Code | `src/lib/ml/isolation-forest.ts`, `src/lib/ml/anomaly.ts` |
| Version | `anomaly-iforest-1` |
| Tests | `src/lib/ml/isolation-forest.test.ts`, `src/lib/ml/anomaly.test.ts` |

## Purpose
Flag months whose combination of weather and soil conditions was unusual for
**this location**, as a prompt to look closer. It does **not** detect crop
disease, pests or confirmed crop damage, and it does not forecast.

## Training data
- The location's own record from `/api/nasa-power/monthly` (NASA POWER daily,
  aggregated to months on the server). Default 30 years.
- Fitted at run time per location; nothing is shared between users.
- Reference run: lat 39.0, lon 33.0, **360 months, 1996-11 to 2026-10, no
  missing monthly values** (saved as `src/lib/ml/__fixtures__/monthly-features-39n-33e.json`, retrieved 2026-11-15).
- The model refuses to run with fewer than 120 months.

## Features
Seven monthly anomalies (z-score against the same calendar month over the record, needs ≥ 5 years):

| Feature | Unit before standardizing | Source |
|---|---|---|
| Mean temperature | °C | POWER T2M |
| Precipitation | mm/month | POWER PRECTOTCORR |
| Reference evapotranspiration (ET0) | mm/month | FAO-56 Penman-Monteith from POWER |
| Water balance (P − ET0) | mm/month | computed |
| Root-zone soil wetness | 0–1 | POWER GWETROOT |
| Hot days (Tmax ≥ 32 °C) | days/month | POWER T2M_MAX |
| Frost nights (Tmin < 0 °C) | days/month | POWER T2M_MIN |

A missing z-score is set to 0 ("usual"). It is missing only when a feature
never varies in that calendar month (for example no frost in July).
NDVI is **not** a feature yet: its record (from 2000, ~1 km, colour-decoded)
does not match the 30-year POWER baseline and would need its own handling.

## Model
Isolation Forest (Liu, Ting & Zhou, 2008), dependency-free TypeScript.
100 trees, sub-sample ψ = 256, height limit ⌈log₂ψ⌉, seed 42.
Flags the top 5 % of months by score (contamination 0.05). Each flagged
month is explained by features with |z| ≥ 1.5, strongest first.

## Target / labels
None (unsupervised).

## Validation and metrics (all on 2026-11-15)

There are **no labels**, so accuracy cannot be measured. These tests check
that the method behaves as intended. Synthetic weather is clearly marked as
synthetic in the code and is never used as training data for the app.

| Test | Result |
|---|---|
| Strong injected anomalies (3 features at ±3–3.5 SD), 10 per run, 5 runs, recall in the flagged 5 % | **50 / 50** (recall 1.00). A simple max-\|z\| rule also finds 10 / 10 in a comparable run. |
| Moderate combined anomalies (5 features at ±2 SD), 10 per run, 5 runs | **Forest 25 / 50 vs max-\|z\| rule 1 / 50** |
| Stability across 5 seeds (Jaccard of flagged sets) | mean **0.76**, min 0.64 |
| Speed, fit + score of 360 months (Node) | about 8 ms |

### Plausibility on real data (qualitative only)
The 18 flagged months at the reference location include, for example,
2024-06 ("far more hot days than usual, much warmer than usual, higher water
demand than usual") and 2010-10 ("much wetter than usual"). Wet as well as
dry and hot months are flagged: the method finds *unusual*, not *bad*.

Not flagged: 2026-10, although its root-zone wetness is 3.2 SD below normal,
because the other six features were near normal. A single extreme value is
better shown by the plain z-scores (Statistics) next to this model, not
replaced by it.

## Uncertainty and limitations
- Inputs are gridded (≈ 50 km for POWER), not field measurements.
- "Unusual" is relative to 30 years at this grid cell, not to crop needs.
- The 5 % share is fixed, so every location gets flags even in calm climates.
- Results depend somewhat on the random seed (Jaccard 0.76 on average); a fixed seed keeps the app repeatable.

## Where human judgment is needed
Whether an unusual month actually affected the crop, and what to do about it.
