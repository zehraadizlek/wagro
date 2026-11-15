# Unsupervised detection of unusual climate months in WAGRO

**Technical report: Isolation Forest on NASA POWER monthly climate features**

| | |
|---|---|
| System | WAGRO, a prototype crop-rotation decision-support tool (NASA Space Apps Challenge 2026) |
| Component | Environmental anomaly detection, model version `anomaly-iforest-1` |
| Method label in the app | ML (unsupervised) |
| Code | `src/lib/ml/isolation-forest.ts`, `src/lib/ml/anomaly.ts`, `src/lib/features/monthly.ts`, `src/app/api/nasa-power/monthly/route.ts`, `src/lib/ml/use-anomalies.ts` |
| Tests | `src/lib/ml/isolation-forest.test.ts`, `src/lib/ml/anomaly.test.ts` |
| Evaluation | `scripts/evaluate.eval.ts` (`npm run evaluate`), output in `docs/ml/evaluation.md` |
| Report status | Describes the code at the commit that adds this file. Every parameter below was read from the source. Items that could not be verified are marked **Unknown**. |

---

## 1. Abstract

WAGRO flags months whose combination of weather and soil-water conditions was
rare for the farmer's location. It uses an Isolation Forest (Liu, Ting & Zhou,
2008) that is fitted at run time on the location's own record of up to
30 years (360 months) of NASA POWER data. The input is seven monthly features,
each expressed as a z-score against the same calendar month in the same
record. The model flags the 5 % of months with the highest anomaly score and
explains each one by its strongest deviating features.

No labelled outcomes exist, so accuracy cannot be measured. The evaluation
instead plants synthetic anomalies (5 runs × 10 planted months, among 360
synthetic months):

- **Strong single-pattern anomalies:** the forest finds 49/50. A max-|z| rule finds 50/50.
- **Moderate anomalies spread over five features (±2.3 SD):** the forest finds 34/50. The max-|z| rule finds 2/50.
- **Stability:** mean Jaccard similarity of flagged sets across five seeds is 0.76.
- **Speed:** about 8–11 ms per fit and score in Node.

In the app, the output is information only. It does not change any rotation
score. It detects statistical unusualness, not crop damage.

## 2. Problem statement and agricultural motivation

A rotation recommendation in WAGRO is driven by long-term climate (10-year
means and monthly climatology) and rule-based criteria. Long-term means hide
individual months that were far from normal, such as a very wet autumn, a
heat spell in June, or a run of frost nights. A farmer or adviser reviewing a
recommendation benefits from knowing whether recent seasons were typical,
because unusual recent seasons can explain past yields, field conditions or
soil water at sowing.

The task is therefore: *for one location, which months in its own record
were unusual, considering several climate and soil-water variables
together?* "Unusual" is defined only relative to that location's own history.
It is not defined relative to crop needs.

## 3. Why unsupervised anomaly detection was selected

- **No labels.** There is no verified dataset of "damaging" or "harmful" months for WAGRO's locations. A supervised model would require such labels. `docs/ml/dataset-audit.md` records that the candidate yield source, TÜİK district statistics, has not been exported or verified.
- **Multivariate rarity.** A single threshold per variable, as in a classic max-|z| rule, misses months where several variables are moderately off at once. Isolation Forest scores the joint pattern.
- **Per-location fit.** The model is fitted on the location's own record, so it needs no external training set and adapts to each climate.
- **Small, explainable, dependency-free.** About 100 lines of TypeScript run in the browser in milliseconds. Each flag can be explained by its z-scores.

Isolation Forest was chosen over distance- or density-based detectors
(Chandola, Banerjee & Kumar, 2009) because its cost is linear in the number
of trees and sub-sample size, and its random-split principle needs no
distance metric across mixed units.

## 4. NASA POWER data and variables actually used

The source is NASA POWER daily data (community AG), fetched on the server by
`/api/nasa-power/monthly`. The nine POWER parameters requested (`POWER_PARAMS`
in `src/lib/nasa/power.ts`) are T2M, T2M_MAX, T2M_MIN, PRECTOTCORR, RH2M,
WS2M, ALLSKY_SFC_SW_DWN, GWETTOP and GWETROOT. POWER meteorology comes mainly
from the MERRA-2 reanalysis (Gelaro et al., 2017) and solar radiation from
CERES-based products. It is distributed on a grid of roughly 0.5° × 0.625°
(about 50 km).

The monthly features use these parameters:

| Feature (`FEATURE_KEYS`) | Definition in `monthly.ts` | POWER inputs |
|---|---|---|
| `tmean` | Mean of daily T2M, °C | T2M |
| `precipMm` | Monthly rain total, mm, scaled to the full month when days are missing | PRECTOTCORR |
| `et0Mm` | Monthly reference evapotranspiration, mm (FAO-56 Penman-Monteith; Hargreaves when humidity, wind or radiation is missing) | T2M_MAX, T2M_MIN, RH2M, WS2M, ALLSKY_SFC_SW_DWN, T2M |
| `balanceMm` | `precipMm − et0Mm` | derived |
| `gwetRoot` | Mean root-zone soil wetness, 0–1 | GWETROOT (model estimate, not a measurement) |
| `hotDays` | Days with Tmax ≥ 32 °C, scaled to the month | T2M_MAX |
| `frostNights` | Days with Tmin < 0 °C, scaled to the month | T2M_MIN |

GWETTOP is fetched but **not** used as a feature. NDVI is **not** a feature.
The model card explains that the NDVI record starts in 2000 and does not
match the 30-year POWER baseline.

## 5. Temporal structure and historical reference

- **Period.** The app requests `years=30` (`use-anomalies.ts`). `monthRange()` in the route ends at the last complete calendar month, after allowing a 7-day POWER delay, and starts 30 years earlier. A full record is therefore 360 months. The verified reference fixture (lat 39.0, lon 33.0) covers **1996-11 to 2026-10, 360 months**.
- **Reference distribution.** Each z-score uses the mean and standard deviation of the same calendar month over **all years in the fetched record, including the month being scored** (`withAnomalies`). There is no separate baseline period or hold-out. With the default request the reference is the full 30 years.
- **Minimums.** A monthly row needs at least 25 days with both temperature and rain (`MIN_DAYS`). A calendar-month climatology needs at least 5 years of values, otherwise its z-scores are null. The detector refuses to run with fewer than 120 usable months (`minMonths`), returning `status: "insufficient-data"`.
- **Training versus scoring.** The forest is fitted on all usable months and then scores the same months (transductive, in-sample use). This is the normal use of Isolation Forest for finding outliers within a dataset. It is not a forecast of future months.

## 6. Feature engineering and preprocessing

1. Daily points are grouped by year-month (`monthlyRows`).
2. Totals and day counts are scaled to the full month length when some days are missing. Months with fewer than 25 usable days get null values.
3. Values are rounded: temperature to 0.01 °C, totals to 0.1 mm, soil wetness to 0.001.
4. Each value is standardized against its calendar month: `z = (value − mean) / sd`, using the sample standard deviation (n − 1). The z-score is null when there are fewer than 5 years or `sd ≤ 1e-9`, for example no frost ever in July. z-scores are rounded to 0.01.
5. In the feature matrix (`featureMatrix`), rows with no z-scores at all are dropped. A missing z-score in a kept row is set to **0**, meaning "the usual value". This is justified in the code because z-scores are missing mainly when a feature never varies in that calendar month.

Standardizing per calendar month removes the seasonal cycle, so a hot July
is not flagged just for being July.

## 7. Isolation Forest methodology

Isolation Forest (Liu, Ting & Zhou, 2008; 2012) isolates points with random
axis-parallel splits. Anomalies are few and different, so they tend to be
isolated in fewer splits. For a point *x*, the anomaly score is

s(x, ψ) = 2^(−E[h(x)] / c(ψ)), with c(n) = 2H(n−1) − 2(n−1)/n,

where:
- *h(x)* is the path length in one tree;
- *E[h(x)]* is its mean over the trees;
- *ψ* is the sub-sample size;
- *H* is the harmonic number, approximated as ln(i) + γ;
- c(2) = 1 and c(n ≤ 1) = 0.

Scores near 1 indicate anomalies. Scores of about 0.5 or below are typical.
When a leaf holds more than one point, c(size) is added to the path length,
as in the original algorithm.

## 8. Implementation and parameters (from the source)

| Parameter | Value | Where |
|---|---|---|
| Trees | 100 | `detectAnomalies` default `trees` |
| Sub-sample size ψ | min(256, number of rows), so 256 for 360 months | `fitIsolationForest` |
| Sampling | Without replacement (partial Fisher–Yates) per tree | `fitIsolationForest` |
| Height limit | ⌈log₂ ψ⌉, so 8 for ψ = 256 | `fitIsolationForest` |
| Random generator | mulberry32, seed 42 by default | `random.ts`, `detectAnomalies` |
| Features | 7 (section 4) | `FEATURE_KEYS` |
| Contamination | 0.05 | `detectAnomalies` default |
| Minimum record | 120 months | `detectAnomalies` default `minMonths` |
| Explanation threshold | \|z\| ≥ 1.5 (`DRIVER_Z`); "much/far" wording at \|z\| ≥ 2.5 | `anomaly.ts` |
| Dependencies | None (pure TypeScript) | — |

**One deviation from the textbook algorithm.** At each node, the split
feature is chosen at random *among the features that still vary in that
node*. A node where no feature varies becomes a leaf. The original
description picks any feature at random. This changes split choice only when
some features are constant within a node.

The model runs in the browser after the route returns the feature table. A
module-level cache keeps one result per location while the page is open.

## 9. Anomaly scoring and decision threshold

- Every month gets a score, rounded to 0.001.
- k = max(1, round(0.05 × n)) months are flagged, where n is the number of usable months. The threshold is the k-th highest score, and months with `score ≥ threshold` are flagged. For n = 360, k = 18. Ties at the threshold could flag slightly more than k months.
- The threshold is therefore **relative**: every location gets about 5 % flagged months, even in a calm climate. It is not an absolute probability.
- Each flagged month gets "drivers": the features with |z| ≥ 1.5, strongest first, turned into a sentence such as "Much wetter than usual, wetter soil than usual." If no single feature reaches 1.5, the text reads "An unusual combination, without one standout factor."

## 10. How results are interpreted and used in the app

- **"Unusual months" card** (`UnusualMonths.tsx`, ML (unsupervised) badge). Shows flagged months in the last 24 months of the record and the three strongest flags overall. It also lists single extreme values (|z| ≥ 3) in the last 24 months that the forest did not flag, labelled **Statistics**, so a single extreme value is not hidden.
- **Recommendation note** (`buildRecommendation`). When recent months are flagged, one caution says how many of the last 24 months were unusual and names the latest. It ends with "the scores above do not include them". The unit test `adds an information-only note about recent unusual months` checks that this note **does not change the top option**.
- **Interpretation.** A flag means "rare for this grid cell, given its own 30 years". It can be wet, dry, hot or cold. It is a prompt to look closer, not a judgement that the month was harmful.

## 11. Experimental setup and reproducibility

- **Deterministic.** The same input and seed give the same flags. This is checked by `isolation-forest.test.ts` ("is deterministic for a seed").
- **Real data fixture.** `src/lib/ml/__fixtures__/monthly-features-39n-33e.json`, retrieved 2026-11-15 from the WAGRO route: lat 39.0, lon 33.0, 360 months, 1996-11 to 2026-10.
- **Synthetic data.** `syntheticDaily({ years: 30, startYear: 1996, seed: 4 })` in `src/lib/testing/synthetic.ts`. It is marked as synthetic, used only for tests and evaluation, and never used to fit anything in the app.
- **Injection protocol** (`scripts/evaluate.eval.ts`): for each scenario and each of 5 seeds (21–25), 10 random months get fixed z-scores for selected features. The forest flags 5 % (18 months). The baseline flags the same number of months with the highest max-|z| across features.
- **Command:** `npm run evaluate`. It rewrites `docs/ml/evaluation.md`. The numbers below come from the run in this sprint (Node v24.19.0).

## 12. Evaluation results (observed)

There are **no labels, so accuracy, precision against real damage, or skill
cannot be measured.** The following are behavioural tests.

| Planted anomaly (5 runs × 10 months) | Isolation Forest | Max-\|z\| rule, same number flagged |
|---|---|---|
| Strong: rain −3.5, ET0 +3, soil wetness −3 SD | 49/50 (recall 0.98, precision 0.54) | 50/50 |
| Moderate combined: 5 features at ±2.3 SD | 34/50 (recall 0.68, precision 0.38) | 2/50 |
| Moderate combined: 5 features at ±2.0 SD | 25/50 (recall 0.50, precision 0.25) | 1/50 |
| Weak combined: 5 features at ±1.5 SD | 11/50 (recall 0.22, precision 0.12) | 1/50 |

"Precision" here is the share of flagged months that were planted. It cannot
exceed 10/18 ≈ 0.56, because 18 months are always flagged and only 10 are
planted.

- **Seed stability.** Mean Jaccard similarity of flagged sets across seeds 1–5 is **0.76** (minimum 0.64).
- **Unit-test thresholds** (`anomaly.test.ts`): mean recall at 5 % ≥ 0.8 for strong anomalies; mean Jaccard ≥ 0.6; the forest is no worse than max-|z| − 1 on combined anomalies; and it finds moderate combined anomalies that max-|z| misses. All pass.
- **Real record (plausibility only).** At lat 39, lon 33 the 18 flagged months include:
  - 2010-10, score 0.611, "much wetter than usual";
  - 2011-11, score 0.595, frost nights and cold;
  - 2024-06, score 0.585, "far more hot days than usual, much warmer than usual, higher water demand than usual".

  These are listed in `docs/ml/evaluation.md`. They have **not** been checked against station records or farm reports.
- **Observed limitation.** In the model card's earlier review, 2026-10 had root-zone wetness 3.2 SD below normal but was not flagged, because the other six features were near normal. This is why the app shows single extreme values (Statistics) next to the forest output.

**Interpretation (not an observed result).** Both methods find single large
deviations. The forest adds value for months where several variables are
moderately off together. Weak combined deviations (±1.5 SD) are mostly not
separable from normal variability by either method.

## 13. Comparison with the threshold-based method

The evaluation compares the forest with a **max-|z| rule**: rank months by
their largest absolute z-score and flag the same number as the forest. This
is the only threshold baseline implemented in the evaluation code.

- **Strong single-pattern anomalies:** the rule is equal or slightly better (50/50 vs 49/50).
- **Moderate combined anomalies:** the forest is clearly better (34 vs 2 at ±2.3 SD; 25 vs 1 at ±2.0 SD).

The app uses both. The forest is labelled ML (unsupervised); single extreme
values at |z| ≥ 3 are labelled Statistics.

## 14. Computational performance

| Measure | Value | Source |
|---|---|---|
| Fit + score, 360 months, 100 trees | 11.4 ms in this sprint's run; 7.9 ms in the previous run | `docs/ml/evaluation.md`, Node v24.19.0, mean of 10 fits |
| Data transfer | The route returns only monthly rows and z-scores. The route comment estimates tens of KB instead of about 1.6 MB of daily data. | `route.ts` comment |
| Upstream fetch time for 30 years of POWER daily data | **Unknown.** Not measured in the evaluation; it depends on NASA POWER response time | — |

Timing differences between runs reflect machine load. Browser timings were
not measured separately.

## 15. Limitations and uncertainty

- **Spatial scale.** POWER is gridded at about 50 km. A flag describes the grid cell around the pin, not the field. Local rain, frost pockets and irrigation are not seen.
- **Model inputs.** Soil wetness (GWETROOT) is a model estimate, not a measurement. Temperature is air temperature at 2 m.
- **Relative threshold.** The 5 % rate means some months are always flagged. The score is not a calibrated probability.
- **In-sample reference.** The scored month is part of its own climatology and of the training sample. A 30-year record limits this effect but does not remove it.
- **Non-stationarity.** A warming trend makes recent months look warmer than the 30-year mean, so recent hot months may be flagged partly because of the trend. This is not corrected.
- **Missing values set to 0** can hide anomalies in a feature that is usually constant.
- **Seed dependence.** Jaccard 0.76 on average. The app fixes seed 42 for repeatability.
- **No validation against observed impacts.** There are no labels, so recall is measured only on planted synthetic anomalies.

## 16. Why anomaly detection is not crop-damage prediction

The model sees only weather and modelled soil water. It has no information on:
- crops, growth stages, varieties or management;
- yields, disease or pests.

Many unusual months, such as a wet month after harvest, cause no harm. Some
harmful events, such as one frost night at flowering, are not unusual at the
monthly scale. WAGRO therefore never says a flagged month damaged a crop or
will reduce yield. The recommendation note asks the farmer to check whether
the months affected their fields.

## 17. Why this is not supervised learning

- No target variable is used. `detectAnomalies` receives only the feature table. There is no yield, damage or class label anywhere in the pipeline.
- The model is fitted per location at run time, on that location's record. Nothing is trained in advance or shared between users.
- The crop suitability / yield model, which would be supervised, does **not exist**. `predictSuitability()` always returns `"not-trained"`, and the How page lists the model as blocked.

## 18. Potential future improvements

- Hold-out or rolling baselines, for example scoring the last 24 months against the earlier 28 years, to remove the in-sample effect.
- Detrending before standardizing, so that trend and anomaly can be told apart.
- Growing-season-specific features, once crop calendars are made climate-aware.
- An NDVI-based feature with its own baseline from 2000.
- Comparing flags with independent records, such as drought monitors or national disaster declarations, as a qualitative check, not as ground truth.
- Reporting the score distribution next to the 5 % cut-off, so calm locations can show "no strong anomalies".

## 19. References and data sources

DOIs were checked to resolve at doi.org on 2026-11-15.

- Liu, F. T., Ting, K. M., & Zhou, Z.-H. (2008). Isolation Forest. *2008 Eighth IEEE International Conference on Data Mining*, 413–422. https://doi.org/10.1109/ICDM.2008.17
- Liu, F. T., Ting, K. M., & Zhou, Z.-H. (2012). Isolation-based anomaly detection. *ACM Transactions on Knowledge Discovery from Data*, 6(1), 3. https://doi.org/10.1145/2133360.2133363
- Chandola, V., Banerjee, A., & Kumar, V. (2009). Anomaly detection: A survey. *ACM Computing Surveys*, 41(3), 15. https://doi.org/10.1145/1541880.1541882
- Gelaro, R., et al. (2017). The Modern-Era Retrospective Analysis for Research and Applications, Version 2 (MERRA-2). *Journal of Climate*, 30(14), 5419–5454. https://doi.org/10.1175/JCLI-D-16-0758.1
- Allen, R. G., Pereira, L. S., Raes, D., & Smith, M. (1998). *Crop evapotranspiration: Guidelines for computing crop water requirements*. FAO Irrigation and Drainage Paper 56. FAO, Rome. https://www.fao.org/4/x0490e/x0490e00.htm
- Hargreaves, G. H., & Samani, Z. A. (1985). Reference crop evapotranspiration from temperature. *Applied Engineering in Agriculture*, 1(2), 96–99. https://doi.org/10.13031/2013.26773
- NASA POWER project (Prediction Of Worldwide Energy Resources), NASA Langley Research Center. https://power.larc.nasa.gov/ (data access and methodology documentation)
- WAGRO internal documents: `docs/ml/model-cards/anomaly-isolation-forest.md`, `docs/ml/evaluation.md`, `docs/ml/dataset-audit.md`, `docs/ml/architecture-decision.md`.

### Details that could not be verified
- The exact POWER grid resolution per parameter. About 50 km is the commonly stated scale and is used throughout WAGRO; parameter-specific native grids were not re-checked in this sprint.
- Upstream fetch time for a 30-year request.
- Browser (rather than Node) timing of the fit.
