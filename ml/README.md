# ml/ — offline training workspace

Nothing in this folder is deployed or imported by the app.

**Status (2026-11-15): no model has been trained.** The only candidate label
source (TÜİK district crop statistics) has not been exported yet; see
`../docs/ml/dataset-audit.md`, section 7.

The first ML component (environmental anomaly detection) is unsupervised and
runs in TypeScript inside the app (`src/lib/ml/`, Phase 3). It does not use
this folder.

## Layout

```
ml/
  README.md          this file
  requirements.txt   Python packages for offline work only
  data/
    README.md        where raw data comes from and how to add it
    raw/             downloaded files, never edited, not committed
    processed/       derived tables, not committed
```

Training scripts are added only after a dataset passes the audit. Every
trained model must ship with a model card in `../docs/ml/model-cards/`
(training data, features, labels, number of observations, coverage, missing
data, validation and metrics) and be exported to JSON for the TypeScript
evaluator. Never commit raw third-party data.

## Setup (when needed)

```bash
python -m venv .venv
```

```bash
.venv\Scripts\activate
```

```bash
pip install -r ml/requirements.txt
```
