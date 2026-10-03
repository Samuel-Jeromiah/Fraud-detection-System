# FraudGuard: calibrated fraud-risk course project

FraudGuard is a Foundations of Artificial Intelligence project that classifies a synthetic card transaction as higher or lower fraud risk. It is deliberately designed as an academic risk-scoring prototype, not as a system that can automatically accuse a customer of fraud.

## Why this project exists

Fraud is rare in the source data. A model that calls every transaction legitimate can look accurate while catching no fraud at all. This project therefore measures ranking quality, calibration, recall, precision, and the practical alert threshold instead of relying on accuracy alone.

The rebuild replaces a legacy notebook workflow with a time-ordered, leakage-safe pipeline:

1. Fit the model on early transactions.
2. Use a later window for early stopping.
3. Calibrate raw XGBoost scores on another future window.
4. Select the alert threshold on a separate validation window.
5. Report final performance only once on `fraudTest.csv`, a later untouched period.

See [the rebuild plan](docs/REBUILD_PLAN.md), [feature/data dictionary](docs/DATA_DICTIONARY.md), and [HPC runbook](docs/HPC_RUNBOOK.md).

## Data

Download the Sparkov synthetic fraud dataset from [Kaggle](https://www.kaggle.com/datasets/kartik2112/fraud-detection) and place these ignored files either in the repository root or in a directory referenced by `FRAUD_DATA_DIR`:

```text
fraudTrain.csv
fraudTest.csv
```

The local source audit finds 1,296,675 development rows (0.579% fraud) from January 2019 through June 2020, followed by 555,719 untouched test rows (0.386% fraud) through December 2020.

## What the rebuilt model uses

It uses transaction amount, time, category, city population, geographic distance, and history available before the transaction: prior customer count, prior customer average, amount-to-average ratio, and prior visits to the merchant. It does not use raw card IDs, names, addresses, gender, age, occupation, or merchant target encoding. The full rationale is in [the data dictionary](docs/DATA_DICTIONARY.md).

## Train and evaluate

Use Python 3.11+ in a clean virtual environment:

```bash
python -m venv .venv
# Windows PowerShell: .\.venv\Scripts\Activate.ps1
# macOS/Linux: source .venv/bin/activate
pip install -r requirements-ml.txt
pip install -e .
python -m fraudguard.train --audit-only
python -m fraudguard.train --smoke-test
python -m fraudguard.train --output-dir artifacts/rebuilt-model
```

The final command writes a model bundle, JSON model card, metrics, calibration plot, and confusion matrix under `artifacts/rebuilt-model/`. Do not quote those metrics in a report until that run finishes. For HPC training, follow [the runbook](docs/HPC_RUNBOOK.md).

## Run the web demo

The repository includes a FastAPI backend and a Next.js frontend. Until a reviewed rebuilt bundle is copied to `backend/models/model_bundle.joblib`, the API clearly identifies the loaded artifact as the legacy baseline.

```bash
# Terminal 1
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Terminal 2
cd frontend
npm ci
npm run dev
```

Open `http://localhost:3000`. The scorecard inputs are an event-time contract: the prior-history values must come from a transaction-history feature store in a real deployment. The browser is a demonstration interface, not that feature store.

## Repository map

```text
src/fraudguard/       Reproducible data, feature, evaluation, serving, and training code
tests/                Leakage-safety unit tests
backend/              FastAPI scoring service
frontend/             Next.js demonstration client
scripts/              HPC submission template
docs/                 Rebuild plan, data dictionary, and runbook
legacy-streamlit/     Preserved original Streamlit application
notebooks/            Preserved original exploratory notebook
```

## Legacy material

The Streamlit app, notebook, prebuilt `.pkl` artifacts, and prior PDF report remain for comparison. They should not be presented as the rebuilt model: the original notebook performed target encoding with label leakage, calculated some history features with future information, used SMOTE across categorical one-hot fields, and chose its threshold on the same test set used for final metrics.
