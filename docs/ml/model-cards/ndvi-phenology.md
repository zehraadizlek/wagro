# Method card: NDVI phenology

| Field | Value |
|---|---|
| Status | **Built and tested** (2026-11-15). Shown in "Plant cover around your field" and used for a calendar check. |
| Method label shown in the app | Statistics |
| Code | `src/lib/features/phenology.ts`, `src/lib/features/use-ndvi.ts` |
| Tests | `src/lib/features/phenology.test.ts` |

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

## Winter crops
When the green period already runs at the start of January, the season began
the previous year and the calendar-year window cannot see when. The method then
reports "green through winter" instead of a green-up month. This was found on
the real series, where an earlier version said "greens up in January".

## Southern hemisphere finding (2026-11-15)
At Swartland, South Africa (−33.4, 18.7) the satellite season peaked in
August, while the six-month-shifted wheat calendar assumes November. The check
reported the mismatch, which is the intended behaviour; the calendar itself
needs local values for mild-winter climates.

## Limitations
Monthly steps are coarse (± one month). The footprint mixes neighbouring fields.
Snow and cloud lower winter values.

## Use in the app
`checkCalendar` compares the typical satellite peak with the month the calendar
assumes for the crop in the field now (about two months before harvest). If
they differ by more than one month, the recommendation adds a note asking the
farmer to check sowing and harvest months. Scores are not changed.

## Validation
- Synthetic seasonal curves: peak, green-up and decline found as defined; years with < 10 months or a range < 0.08 are skipped.
- Real series at lat 39, lon 33 (decoded from GIBS on 2026-11-15, fixture in `src/lib/features/__fixtures__/`): seasons found for 2024, 2025 and 2026; typical peak in spring, consistent with the winter-wheat calendar; the 2025 season's range was less than half of 2024's.
- No accuracy claim: there is no ground truth for season timing at this point.
