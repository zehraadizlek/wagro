# WAGRO — Machine learning and optimization

Status on 2026-11-15: **Phase 1 (feasibility and dataset audit) done. No
model is built or trained yet.** The app still runs only the rule-based engine
and the existing statistics.

| Document | What it covers |
|---|---|
| [dataset-audit.md](dataset-audit.md) | Every candidate dataset, verified access, coverage and role |
| [architecture-decision.md](architecture-decision.md) | Where ML runs and why (TypeScript in-app; offline Python only for trained models) |
| [model-cards/](model-cards/) | One card per model or method, with status |

| Component | Method label | Status |
|---|---|---|
| Environmental anomaly detection | ML (unsupervised) | Not built — Phase 3 |
| Rotation optimization | Optimization | Not built — Phase 4 |
| NDVI phenology | Statistics | Not built — Phase 5 |
| Crop suitability / yield anomaly | ML (trained) | **Blocked** — needs a verified TÜİK district export |

Rules for this work: never fabricate training data, never call a rule-based
score an ML prediction, and keep the rule-based engine as the working fallback.
