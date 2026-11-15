# WAGRO — ML dataset audit (Phase 1)

Date: 2026-11-15. Every "Verified" line below comes from a live request made
on this date from the development machine. Nothing here is assumed from
memory; where something was not checked it says **Not verified**.

Test location for all probes: lat 39.0, lon 33.0 (central Anatolia, Türkiye).

## Summary

| Dataset | Role | Access | Verified | Decision |
|---|---|---|---|---|
| NASA POWER daily | Features, anomaly baseline | REST, no key | Yes | **Use** (already integrated) |
| NASA POWER monthly | Long baseline | REST, no key | Yes | **Use** for 30-year context |
| NASA GIBS MODIS NDVI (monthly) | Features, phenology | WMTS tiles + colormap, no key | Yes | **Use** (already integrated) |
| NASA GIBS SMAP L4 / LST / GRACE | Map context | WMTS tiles, no key | Partly | Keep as map layers; not model features yet |
| ISRIC SoilGrids v2 | Soil features (modelled) | REST, no key | Yes, with slow responses | **Use** as an optional, labelled feature |
| FAOSTAT production (bulk ZIP) | Sanity check only | Bulk download, no key | Yes | **Not** a training source (national level) |
| FAOSTAT API | — | Token required (HTTP 401) | Yes (blocked) | Not used |
| TÜİK MEDAS crop statistics | **Only candidate label source** | Interactive web portal | Portal reachable; export **not verified** | **Blocked** until a manual export test |
| ESA WorldCereal 2021 | Cropland / crop-type mask | Zenodo, 8–25 GB per layer | Record metadata verified | Not a label for suitability; optional mask later |

**Conclusion:** there is no reliable label set for a field-level supervised
model. Phase 3 therefore builds the **unsupervised** anomaly detector, which
needs no labels. A district-level supervised model is possible only if the
TÜİK export test in section 7 succeeds.

---

## 1. NASA POWER — daily point API

- Endpoint: `https://power.larc.nasa.gov/api/temporal/daily/point`, community `AG`.
- Parameters used: T2M, T2M_MAX, T2M_MIN, PRECTOTCORR, RH2M, WS2M,
  ALLSKY_SFC_SW_DWN, GWETTOP, GWETROOT.
- Sources reported by the API header: MERRA-2 reanalysis, CERES SYN1deg / SRB, POWER.
- Spatial resolution: grid cell of roughly 0.5° (MERRA-2); one value per cell.
- Temporal coverage: 1981 onwards for most variables. **Solar radiation is
  missing (-999) at the start of 1981** (verified); GWETROOT is present from 1981.
- Verified sizes: 10 years × 9 parameters = 536 KB in 2.7 s;
  30 years (1996–2025) × 9 parameters = **1.6 MB in 2.8 s**.
- Missing data: none in 1995–2025 at the test point (verified via the monthly
  endpoint below). Recent days lag by a few days; WAGRO already ends 7 days back.
- Role: features and per-location baseline. **Not a label.**

## 2. NASA POWER — monthly point API

- Endpoint: `https://power.larc.nasa.gov/api/temporal/monthly/point`.
- Verified: 1995–2025, 9 parameters = **53 KB in 1.7 s**; 403 keys
  (31 years × 13, the 13th "month" is the annual value); **0 missing values**.
- Limitation: monthly means only, so counts such as hot days or frost nights
  cannot be derived. Those need the daily endpoint.
- Role: compact long-term context; daily data remains the source for counts.

## 3. NASA GIBS — MODIS Terra NDVI (monthly)

- Layer `MODIS_Terra_L3_NDVI_Monthly`, GoogleMapsCompatible Level 7 (≈1.2 km/pixel at the test latitude).
- Coverage from capabilities: 2000-03 to 2026-10, **gap at 2025-04**.
- Values are read back from rendered PNG tiles through the published GIBS
  colormap (`MODIS_L3_NDVI.xml`, 140 classes of 0.01). Verified exact colour
  match for one month (NDVI ≈ 0.48, May 2024).
- Limitations: quantized to ~0.01; ~1 km footprint mixes neighbouring fields;
  winter lows can be snow; this is rendered imagery, not the science HDF product.
- Role: features (NDVI anomaly), phenology statistics. **Cannot identify crop species.**

## 4. NASA GIBS — SMAP L4, MODIS LST, GRACE

- SMAP L4 root-zone soil moisture: daily, Level 6, 2015-03-31 onward with scattered missing days. Tiles verified loading.
- MODIS Terra LST monthly day: Level 6, 2000-03 to 2026-10. Not individually verified.
- GRACE Tellus mascon: monthly to 2022-07, ~300 km effective resolution. Not individually verified.
- Role for ML: none yet. SMAP could later replace or check POWER GWETROOT; this needs colormap decoding like NDVI and a resolution note.

## 5. ISRIC SoilGrids v2 (REST)

- Endpoint: `https://rest.isric.org/soilgrids/v2.0/properties/query`. No key.
- CORS: `access-control-allow-origin: *` (verified), so it can be called from the browser or through a small proxy.
- Verified values at the test point, 0–5 cm: pH(H₂O) 7.5, clay 30.1 %, sand 28.5 %,
  SOC 20.8 g/kg (raw values scaled by `d_factor` 10). An `uncertainty` value is returned per property.
- Latency: three small queries took 2.5 s, **12.7 s** and 2.7 s. One larger
  query (6 properties × 3 depths × 4 statistics) **timed out at 40 s**.
- A point in the sea returned no data (expected).
- Fair-use limits: ISRIC publishes a fair-use policy for this service; exact limits **not verified**.
- Role: **modelled** soil features at 250 m, shown next to the farmer's own input. **Not a label.**

## 6. FAOSTAT

- API (`faostatservices.fao.org/api/v1`): **HTTP 401**; now requires a token. Not used.
- Bulk ZIP `Production_Crops_Livestock_E_All_Data_(Normalized).zip`: 33.9 MB,
  last modified 2025-12-31, no key (verified, downloaded and parsed).
- Türkiye yield records found (element "Yield", kg/ha):

| Item | Years | Range |
|---|---|---|
| Wheat, Barley, Maize (corn), Chick peas dry, Lentils dry, Sunflower seed, Safflower seed, Vetches | 64 each | 1961–2024 |
| Sorghum | 21 | 2004–2024 |

- Role: **national** annual yields only. 64 observations per crop cannot train
  a location-aware model. Useful as a sanity check for district totals and for
  national yield trends.

## 7. TÜİK — MEDAS crop statistics (candidate labels)

- `data.tuik.gov.tr` redirects (302) to `veriportali.tuik.gov.tr`.
- MEDAS (`biruni.tuik.gov.tr/medas`) is reachable and lists
  "Bitkisel Üretim İstatistikleri" (crop production statistics) — verified in the page source.
- **Not verified:** district (ilçe) granularity for each crop, years
  available, and whether a CSV/XLS export is possible. MEDAS is an interactive
  JavaScript portal; no documented bulk API was found.
- If district data exports, the expected shape is one row per
  district × crop × year with area, production and yield. Observation counts
  are **unknown until the export is done**.

### Manual export test needed (for the project owner)

1. Open MEDAS → Bitkisel Üretim İstatistikleri.
2. Choose level **ilçe** (district), crops: buğday, arpa, mısır, nohut,
   mercimek, ayçiçeği, aspir, fiğ, sorgum; all available years.
3. Try to export as CSV or Excel.
4. Report: does it export, which years, which crops, and how many rows.

Raw files must go to `ml/data/raw/` (gitignored) and must not be edited by hand.

## 8. ESA WorldCereal 2021

- Zenodo record 7875105, "ESA WorldCereal 10 m 2021 v100", CC-BY-4.0,
  published 2023-05-12, 21 files. Example sizes: temporary crops
  classification 15.5 GB, maize classification 18.2 GB, active cropland 20.1 GB
  (verified from record metadata; not downloaded).
- One season-year (2021), presence/absence maps at 10 m.
- Role: **not** a suitability label (where a crop is grown is not where it
  grows best). Could later serve as a cropland mask when averaging weather over
  districts. Requires a one-off regional extraction offline; not for the app.

---

## Implications for the models

| Component | Labels needed | Available? | Status |
|---|---|---|---|
| Environmental anomaly detection (Isolation Forest) | None | n/a | **Go** — Phase 3 |
| NDVI phenology (green-up, peak, decline, bare months) | None | n/a | **Go** — statistics, not ML |
| Rotation optimization (Pareto) | None | n/a | **Go** — Phase 4 |
| Crop suitability / yield-anomaly model | District yields by year | Unverified (TÜİK) | **Blocked** until the export test |
