# WAGRO — Architecture decision: where ML runs (Phase 1)

Date: 2026-11-15. Status: **proposed, approved in principle**; numbers marked
"measured" were measured today, others are targets to check in later phases.

## Context

- WAGRO is a Next.js 16 app. All scoring runs in the browser; one route
  handler proxies NASA POWER. There is no database and no server state.
- Goal: free or near-free hosting (for example Vercel's free tier).
- Planned components: environmental anomaly detection (unsupervised), NDVI
  phenology (statistics), rotation optimization (exact search), and a
  supervised suitability model only if labels become available
  (see `dataset-audit.md`).

## Options compared

| | Python FastAPI service | ONNX inference in JS | Plain TypeScript in the app | Offline Python training → JSON trees → TS evaluator |
|---|---|---|---|---|
| Deployables | 2 (Next + Python) | 1 | 1 | 1 (training never deployed) |
| Hosting cost | Free tiers sleep (cold starts); paid ≈ $5–7/month | Free | Free | Free |
| Runtime size | Python + libraries on the server | onnxruntime-web WASM, several MB | Zero extra | A few KB of JSON |
| Fits small per-location models | Yes | Yes | **Yes** | n/a (for trained models) |
| Trees from scikit-learn / XGBoost | Native | Via skl2onnx / onnxmltools | Hand-written only | **Yes**, exported |
| Explainability in the UI | Needs extra API fields | Same | Direct | Direct (tree paths) |
| New app dependencies | — | onnxruntime | none | none |

## Decision

1. **Isolation Forest, phenology and optimization run in TypeScript inside the
   app.** No labels, small data per location, no new dependencies.
2. **Supervised models, if any, are trained offline in Python** under `ml/`
   (not deployed) and **exported as JSON tree ensembles** evaluated by a small
   TypeScript function. ONNX stays as a fallback if a model cannot be
   expressed that way.
3. **No FastAPI service now.** Revisit only if a model needs Python at inference time.

## Data path for long baselines

Measured on 2026-11-15 at lat 39, lon 33:

| Request | Size | Time |
|---|---|---|
| POWER daily, 10 years, 9 parameters | 536 KB | 2.7 s |
| POWER daily, 30 years, 9 parameters | 1.6 MB | 2.8 s |
| POWER monthly, 31 years, 9 parameters | 53 KB | 1.7 s |

Heat-day and frost-night counts need **daily** data. Shipping 1.6 MB to the
browser is avoidable: Phase 2 adds a **new** route that fetches 30 years of
daily data on the server and returns a compact monthly feature table
(target < 60 KB). The existing `/api/nasa-power` route and its 10-year daily
use stay unchanged.

## Performance targets (to be measured in Phases 3–4)

| Task | Size | Target |
|---|---|---|
| Isolation Forest fit + score | ~360 months × ~8 features, 100 trees | < 50 ms in the browser |
| Exhaustive rotation search, 3 seasons | 729 sequences × 2 cover options | < 200 ms on a mid-range phone |
| Exhaustive search, 4 seasons | 13,122 candidates | measure; move to a Web Worker if > 200 ms |

## Tests

Vitest is added as the only new dev dependency (TypeScript and the `@/` path
alias work without extra setup). Python dependencies live only in
`ml/requirements.txt`.

## Labels shown to users

Every result carries one method label so it is never mistaken for something else:

| Label | Meaning |
|---|---|
| Rule-based | The existing engine's rules and crop values |
| Statistics | Trends, anomalies by z-score, phenology, k-means year types |
| ML (unsupervised) | Isolation Forest anomaly scores, learned from the location's own history |
| ML (trained) | Only for a supervised model with a published model card and validation |
| Optimization | Exhaustive search and Pareto selection over the rule-based criteria |
