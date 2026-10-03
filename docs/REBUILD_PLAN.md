# FraudGuard rebuild plan

## Goal

Produce a reproducible academic fraud-risk prototype. It must train without target leakage, report honest performance on an untouched future test period, return calibrated probabilities, and expose a scoring contract that a real service can implement.

## Current state

The repository contains a polished FastAPI and Next.js demonstration plus an older Streamlit application, a notebook, and serialized XGBoost artifacts. The existing artifacts are preserved as a **legacy baseline**. They are not the evidence for the rebuilt model because the notebook used the final test set to select its threshold and several features used information from the future.

## Execution phases

| Phase | Deliverable | Acceptance check |
| --- | --- | --- |
| 0. Preserve and audit | Legacy artifacts remain untouched; inventory and known limitations documented. | Existing frontend lint still passes. |
| 1. Data contract | Raw-data dictionary, validation checks, deterministic time windows. | Expected columns, dates, labels, and class rates are verified. |
| 2. Leakage-safe features | One feature module that produces only event-time or prior-history features. | Tests prove the current row's label is never used as a feature. |
| 3. Baselines | Dummy and class-weighted logistic-regression benchmarks. | XGBoost must beat baseline PR-AUC before it is adopted. |
| 4. XGBoost training | Time-aware preprocessing, bounded model search, early stopping, saved bundle. | Validation metrics and configuration are saved beside the model. |
| 5. Calibration and policy | Compare raw scores, sigmoid (Platt), and isotonic calibration using time-ordered calibration fit/check slices; threshold selected on a different held-out window. | Brier score and calibration plot are published; the bundle is called calibrated only when a fitted method wins. |
| 6. Final evaluation | One evaluation against `fraudTest.csv`, never used for fit/tuning/thresholding. | Metrics, confusion matrix, ROC/PR and calibration plots are generated. |
| 7. Deployment | FastAPI loads only the rebuilt bundle and accepts the model's real feature contract. | API smoke test produces a calibrated score and a decision. |
| 8. Documentation | Model card, runbook, architecture/update guide, and course-ready explanation. | A new reader can reproduce the result and distinguish demo inputs from production inputs. |

## Time split policy

The source already provides a chronological external test file. Within `fraudTrain.csv`, sorted by transaction timestamp, the pipeline uses:

1. **Model-fit window:** earliest 60%. Fits preprocessing and model weights.
2. **Early-stopping window:** next 10%. Stops tree growth without looking at later decision-policy data.
3. **Calibration window:** next 15%. Fits only the probability calibrator.
4. **Threshold-validation window:** final 15%. Chooses the operating threshold after calibration.
5. **Untouched test window:** all of `fraudTest.csv`. Used once for final reporting.

This creates honest separation. The final metric can be lower than the legacy number; that is a more credible result, not a regression in the project.

## Feature policy

The final model will use amount, transaction time, category, city population, distance from home, and customer history available **before** the event. It will not use name, address, card number as a raw feature, occupation, date of birth/age, gender, or a target-encoded merchant score.

Customer history is calculated in timestamp order: prior transaction count, prior average amount, amount ratio to that prior average, and prior visits to the same merchant. In production those four values require a feature store or transaction-history database; a browser must not invent them.

## Decision policy

The default rule is: among calibrated scores that reach the configured minimum recall (initially 80%), choose the threshold with the highest precision on the threshold-validation window. This is a policy choice, not a universal mathematical truth. It is kept in configuration and can be changed after discussing the cost of false positives and missed fraud.

## Completion boundary

The repository will include a runnable local/HPC pipeline and a generic Slurm submission template. I can execute a small local smoke test here. The full XGBoost training and final test report require a Python environment with the pinned packages; if this computer has no suitable environment, the exact HPC command is the remaining external step.
