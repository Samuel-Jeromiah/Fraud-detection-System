# Deployment contract

## What can be deployed now

The FastAPI service can load a reviewed rebuilt bundle from:

```text
backend/models/model_bundle.joblib
```

For a non-production review, set `FRAUD_MODEL_BUNDLE` to an explicit bundle path instead of copying it into `backend/models`.

Generate it with `python -m fraudguard.train`, review `artifacts/rebuilt-model/model_card.json` and `metrics.json`, then copy the bundle into that path as part of a deliberate release. Do not replace the legacy artifact automatically after an experimental run.

## Scoring request

The rebuilt API accepts the following values:

| Field | Source in a real system |
| --- | --- |
| `amount`, `category`, `hour`, `day_of_week`, `month` | Incoming authorization event |
| `distance_from_home_km`, `city_pop` | Event/customer-location enrichment |
| `customer_prior_count`, `customer_prior_avg_amount`, `customer_merchant_prior_count` | Point-in-time transaction-history feature store |

The API derives log transforms, weekend flag, amount ratio, and new-to-merchant flag from these inputs using the same logic as training.

## Important boundary

The frontend form lets a person enter history values so the model can be demonstrated. That is not how a production fraud system works. A real deployment must calculate history before scoring, persist only the required keyed aggregates, control access to the API, authenticate callers, log model/version/decision metadata, and monitor post-deployment calibration and drift.

## Release checklist

1. Run the full pipeline and save its artifacts.
2. Confirm the final report is labeled `FINAL_EVALUATION`, not `SMOKE_TEST_ONLY`.
3. Review class rates, calibration curve, Brier score, recall/precision, and confusion matrix.
4. Copy the bundle and reviewed model card into the backend release artifact.
5. Call `/api/health`, `/api/metadata`, and `/api/score` with a known request.
6. Pin the environment that created the bundle. Pickled model objects can be incompatible across major dependency versions.
