"""Command-line training entry point for the rebuilt fraud-risk model."""

from __future__ import annotations

import argparse
import json
import platform
import sys
from datetime import datetime, timezone
from importlib.metadata import PackageNotFoundError, version
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.dummy import DummyClassifier
from sklearn.impute import SimpleImputer
from sklearn.isotonic import IsotonicRegression
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import average_precision_score, brier_score_loss
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.compose import ColumnTransformer

from .calibration import IdentityCalibrator
from .data import assign_development_windows, audit_raw_data, load_raw_data, summarize_transactions
from .evaluation import save_diagnostic_plots, score_metrics, select_threshold
from .features import CATEGORICAL_FEATURES, NUMERIC_FEATURES, build_feature_table


MINIMUM_RECALL = 0.80


def _one_hot_encoder() -> OneHotEncoder:
    """Keep compatibility with supported scikit-learn 1.x releases."""
    try:
        return OneHotEncoder(handle_unknown="ignore", sparse_output=True)
    except TypeError:  # pragma: no cover - only for old scikit-learn installations
        return OneHotEncoder(handle_unknown="ignore", sparse=True)


def make_preprocessor(scale_numeric: bool) -> ColumnTransformer:
    numeric_steps = [("impute", SimpleImputer(strategy="median"))]
    if scale_numeric:
        numeric_steps.append(("scale", StandardScaler()))
    return ColumnTransformer(
        transformers=[
            ("numeric", Pipeline(numeric_steps), NUMERIC_FEATURES),
            ("category", Pipeline([("impute", SimpleImputer(strategy="most_frequent")), ("one_hot", _one_hot_encoder())]), CATEGORICAL_FEATURES),
        ],
        remainder="drop",
    )


def _probabilities(model, matrix) -> np.ndarray:
    return np.asarray(model.predict_proba(matrix)[:, 1], dtype=float)


def _calibrated_probabilities(calibrator, raw_probabilities: np.ndarray) -> np.ndarray:
    raw = np.asarray(raw_probabilities)
    if hasattr(calibrator, "predict_proba"):
        return np.asarray(calibrator.predict_proba(raw.reshape(-1, 1))[:, 1], dtype=float)
    return np.asarray(calibrator.predict(raw), dtype=float)


def _fit_calibrator(method: str, raw_probabilities: np.ndarray, labels: np.ndarray):
    if method == "sigmoid_platt_scaling":
        calibrator = LogisticRegression(C=1_000.0, max_iter=1_000, solver="lbfgs", random_state=42)
        calibrator.fit(np.asarray(raw_probabilities).reshape(-1, 1), labels)
        return calibrator
    if method == "isotonic":
        calibrator = IsotonicRegression(out_of_bounds="clip")
        calibrator.fit(raw_probabilities, labels)
        return calibrator
    raise ValueError(f"Unknown calibration method: {method}")


def _take_smoke_sample(indices: np.ndarray, maximum_rows: int) -> np.ndarray:
    """Take the earliest representative segment for a fast wiring check."""
    return indices[:maximum_rows]


def _window_indices(window_labels: np.ndarray, smoke_test: bool) -> dict[str, np.ndarray]:
    windows = {name: np.flatnonzero(window_labels == name) for name in ("fit", "early_stopping", "calibration", "threshold_validation", "test")}
    if smoke_test:
        limits = {"fit": 50_000, "early_stopping": 10_000, "calibration": 15_000, "threshold_validation": 15_000, "test": 20_000}
        windows = {name: _take_smoke_sample(indices, limits[name]) for name, indices in windows.items()}
    if any(len(indices) == 0 for indices in windows.values()):
        raise ValueError("At least one chronological split is empty")
    return windows


def _split_summary(timestamps, labels, indices: np.ndarray) -> dict:
    y = labels.iloc[indices]
    ts = timestamps.iloc[indices]
    return {
        "rows": int(len(indices)),
        "fraud_rows": int(y.sum()),
        "fraud_rate": float(y.mean()),
        "start": ts.min().isoformat(),
        "end": ts.max().isoformat(),
    }


def _package_versions() -> dict[str, str]:
    packages = ("numpy", "pandas", "scikit-learn", "xgboost", "joblib", "matplotlib")
    resolved = {}
    for package in packages:
        try:
            resolved[package] = version(package)
        except PackageNotFoundError:
            resolved[package] = "not installed"
    return resolved


def _run_baselines(features, labels, windows: dict[str, np.ndarray]) -> dict:
    """Create honest reference points before adopting a complex tree model."""
    fit_idx, threshold_idx = windows["fit"], windows["threshold_validation"]
    results: dict[str, dict] = {}
    dummy = DummyClassifier(strategy="prior").fit(np.zeros((len(fit_idx), 1)), labels.iloc[fit_idx])
    dummy_scores = _probabilities(dummy, np.zeros((len(threshold_idx), 1)))
    results["dummy_prior"] = {"average_precision": float(average_precision_score(labels.iloc[threshold_idx], dummy_scores))}

    logistic_preprocessor = make_preprocessor(scale_numeric=True)
    fit_matrix = logistic_preprocessor.fit_transform(features.iloc[fit_idx])
    validation_matrix = logistic_preprocessor.transform(features.iloc[threshold_idx])
    logistic = LogisticRegression(class_weight="balanced", max_iter=500, solver="lbfgs", random_state=42)
    logistic.fit(fit_matrix, labels.iloc[fit_idx])
    logistic_scores = _probabilities(logistic, validation_matrix)
    results["logistic_regression"] = {"average_precision": float(average_precision_score(labels.iloc[threshold_idx], logistic_scores))}
    return results


def _train_xgboost(features, labels, windows: dict[str, np.ndarray], device: str):
    try:
        import xgboost as xgb
    except ImportError as exc:  # pragma: no cover - depends on runtime environment
        raise RuntimeError("XGBoost is required. Install requirements-ml.txt in a clean environment.") from exc

    fit_idx, early_idx = windows["fit"], windows["early_stopping"]
    preprocessor = make_preprocessor(scale_numeric=False)
    x_fit = preprocessor.fit_transform(features.iloc[fit_idx])
    x_early = preprocessor.transform(features.iloc[early_idx])
    y_fit, y_early = labels.iloc[fit_idx], labels.iloc[early_idx]
    positives = int(y_fit.sum())
    negatives = int(len(y_fit) - positives)
    if positives == 0:
        raise ValueError("Training window contains no fraud labels")
    scale_pos_weight = negatives / positives
    model = xgb.XGBClassifier(
        n_estimators=1500,
        learning_rate=0.05,
        max_depth=6,
        min_child_weight=10,
        subsample=0.80,
        colsample_bytree=0.80,
        reg_lambda=5.0,
        reg_alpha=0.0,
        gamma=0.0,
        scale_pos_weight=scale_pos_weight,
        objective="binary:logistic",
        eval_metric="logloss",
        tree_method="hist",
        device="cuda" if device == "cuda" else "cpu",
        early_stopping_rounds=75,
        random_state=42,
        n_jobs=-1,
    )
    model.fit(x_fit, y_fit, eval_set=[(x_early, y_early)], verbose=False)
    return model, preprocessor, {"xgboost_version": xgb.__version__, "scale_pos_weight": scale_pos_weight, "best_iteration": int(getattr(model, "best_iteration", -1))}


def run_training(data_dir: str | None, output_dir: Path, device: str, smoke_test: bool) -> dict:
    # A smoke run validates the complete workflow without materializing the
    # full 1.85M-row corpus on a developer laptop. It is never reportable.
    development, external_test = load_raw_data(data_dir, nrows=120_000 if smoke_test else None)
    dev_windows = assign_development_windows(development)
    fallback_prior_amount = float(development.iloc[: int(len(development) * 0.60)]["amt"].median())
    raw = pd.concat([development, external_test], ignore_index=True)
    result = build_feature_table(raw, fallback_prior_amount=fallback_prior_amount)

    window_labels = np.full(len(result.features), "test", dtype=object)
    development_mask = result.sources.eq("development").to_numpy()
    window_labels[development_mask] = dev_windows.to_numpy()
    windows = _window_indices(window_labels, smoke_test)
    labels = result.labels

    baseline_metrics = _run_baselines(result.features, labels, windows)
    model, preprocessor, training_info = _train_xgboost(result.features, labels, windows, device)

    threshold_idx = windows["threshold_validation"]
    threshold_raw_scores = _probabilities(model, preprocessor.transform(result.features.iloc[threshold_idx]))
    xgboost_average_precision = float(average_precision_score(labels.iloc[threshold_idx], threshold_raw_scores))
    if xgboost_average_precision <= baseline_metrics["logistic_regression"]["average_precision"]:
        raise RuntimeError(
            "XGBoost did not beat the logistic-regression baseline on threshold validation "
            f"({xgboost_average_precision:.5f} <= {baseline_metrics['logistic_regression']['average_precision']:.5f})."
        )

    calibration_idx = windows["calibration"]
    calibration_raw = _probabilities(model, preprocessor.transform(result.features.iloc[calibration_idx]))
    calibration_labels = labels.iloc[calibration_idx].to_numpy()
    calibration_cut = int(len(calibration_idx) * (2 / 3))
    calibration_fit_raw, calibration_eval_raw = calibration_raw[:calibration_cut], calibration_raw[calibration_cut:]
    calibration_fit_labels, calibration_eval_labels = calibration_labels[:calibration_cut], calibration_labels[calibration_cut:]
    candidate_brier = {"uncalibrated_identity": float(brier_score_loss(calibration_eval_labels, calibration_eval_raw))}
    for method in ("sigmoid_platt_scaling", "isotonic"):
        candidate = _fit_calibrator(method, calibration_fit_raw, calibration_fit_labels)
        candidate_brier[method] = float(brier_score_loss(calibration_eval_labels, _calibrated_probabilities(candidate, calibration_eval_raw)))
    selected_method = min(candidate_brier, key=candidate_brier.get)
    # Refit only the method already selected by a later calibration slice. The
    # threshold-validation and external test periods are still untouched here.
    calibrator = IdentityCalibrator() if selected_method == "uncalibrated_identity" else _fit_calibrator(selected_method, calibration_raw, calibration_labels)

    threshold_probabilities = _calibrated_probabilities(calibrator, threshold_raw_scores)
    threshold, threshold_policy = select_threshold(labels.iloc[threshold_idx].to_numpy(), threshold_probabilities, MINIMUM_RECALL)

    test_idx = windows["test"]
    final_probabilities = _calibrated_probabilities(calibrator, _probabilities(model, preprocessor.transform(result.features.iloc[test_idx])))
    final_metrics = score_metrics(labels.iloc[test_idx].to_numpy(), final_probabilities, threshold)

    output_dir.mkdir(parents=True, exist_ok=True)
    save_diagnostic_plots(labels.iloc[test_idx].to_numpy(), final_probabilities, threshold, output_dir)
    feature_names = [str(name) for name in preprocessor.get_feature_names_out()]
    importances = getattr(model, "feature_importances_", np.zeros(len(feature_names)))
    importance = dict(sorted(((name, float(value)) for name, value in zip(feature_names, importances)), key=lambda pair: pair[1], reverse=True))

    bundle = {
        "bundle_version": 1,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "preprocessor": preprocessor,
        "model": model,
        "calibrator": calibrator,
        "threshold": threshold,
        "numeric_features": NUMERIC_FEATURES,
        "categorical_features": CATEGORICAL_FEATURES,
        "fallback_prior_amount": fallback_prior_amount,
        "minimum_recall": MINIMUM_RECALL,
        "calibration_method": selected_method,
    }
    joblib.dump(bundle, output_dir / "model_bundle.joblib")

    run_metadata = {
        "status": "SMOKE_TEST_ONLY" if smoke_test else "FINAL_EVALUATION",
        "created_at": bundle["created_at"],
        "data_audit": {"development": summarize_transactions(development), "test": summarize_transactions(external_test)},
        "split_summary": {name: _split_summary(result.timestamps, labels, indices) for name, indices in windows.items()},
        "baseline_average_precision": baseline_metrics,
        "xgboost_threshold_validation_average_precision": xgboost_average_precision,
        "calibration": {
            "method": selected_method,
            "selection_brier": candidate_brier,
            "selection_window_raw_brier": float(brier_score_loss(calibration_eval_labels, calibration_eval_raw)),
            "full_window_brier_after_refit": float(brier_score_loss(calibration_labels, _calibrated_probabilities(calibrator, calibration_raw))),
        },
        "xgboost": training_info,
        "threshold_policy": {**threshold_policy, "selected_threshold": threshold},
        "final_test_metrics": final_metrics,
        "feature_importance_gain": importance,
        "environment": {"python": sys.version, "platform": platform.platform(), "packages": _package_versions()},
        "limitations": [
            "This is a synthetic-data academic model, not a production fraud decision system.",
            "History features require a transaction-history feature store at serving time.",
            "Feature gain importance is global association, not a per-transaction explanation.",
        ],
    }
    (output_dir / "metrics.json").write_text(json.dumps(run_metadata, indent=2), encoding="utf-8")
    (output_dir / "model_card.json").write_text(json.dumps({key: run_metadata[key] for key in ("status", "created_at", "data_audit", "split_summary", "calibration", "threshold_policy", "final_test_metrics", "limitations")}, indent=2), encoding="utf-8")
    return run_metadata


def main() -> None:
    parser = argparse.ArgumentParser(description="Train the leakage-safe calibrated fraud-risk model")
    parser.add_argument("--data-dir", default=None, help="Directory containing fraudTrain.csv and fraudTest.csv")
    parser.add_argument("--output-dir", default="artifacts/rebuilt-model", help="Directory for model and report artifacts")
    parser.add_argument("--device", choices=("cpu", "cuda"), default="cpu", help="Use CUDA only with a GPU-enabled XGBoost environment")
    parser.add_argument("--audit-only", action="store_true", help="Validate and summarize source CSVs without training")
    parser.add_argument("--smoke-test", action="store_true", help="Run a reduced-size pipeline wiring check, not reportable final metrics")
    args = parser.parse_args()
    if args.audit_only:
        print(json.dumps(audit_raw_data(args.data_dir), indent=2))
        return
    summary = run_training(args.data_dir, Path(args.output_dir), args.device, args.smoke_test)
    print(json.dumps({"status": summary["status"], "final_test_metrics": summary["final_test_metrics"]}, indent=2))


if __name__ == "__main__":
    main()
