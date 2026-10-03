"""Metrics, threshold policy, and plots for a fraud-risk model."""

from __future__ import annotations

import os
from pathlib import Path

os.environ.setdefault("MPLCONFIGDIR", str(Path.cwd() / "artifacts" / ".matplotlib"))

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
from sklearn.calibration import calibration_curve
from sklearn.metrics import (
    average_precision_score,
    brier_score_loss,
    confusion_matrix,
    precision_recall_curve,
    precision_score,
    recall_score,
    roc_auc_score,
)


def select_threshold(y_true: np.ndarray, probabilities: np.ndarray, minimum_recall: float) -> tuple[float, dict]:
    """Maximize precision among thresholds that meet the stated recall policy."""
    precision, recall, thresholds = precision_recall_curve(y_true, probabilities)
    usable_precision, usable_recall = precision[:-1], recall[:-1]
    eligible = np.flatnonzero(usable_recall >= minimum_recall)
    if len(eligible) == 0:
        selected_index = int(np.argmax(usable_recall))
        policy_met = False
    else:
        selected_index = int(eligible[np.argmax(usable_precision[eligible])])
        policy_met = True
    threshold = float(thresholds[selected_index])
    return threshold, {
        "minimum_recall": minimum_recall,
        "policy_met": policy_met,
        "validation_precision": float(usable_precision[selected_index]),
        "validation_recall": float(usable_recall[selected_index]),
    }


def score_metrics(y_true: np.ndarray, probabilities: np.ndarray, threshold: float) -> dict:
    predicted = probabilities >= threshold
    matrix = confusion_matrix(y_true, predicted, labels=[0, 1])
    tn, fp, fn, tp = [int(value) for value in matrix.ravel()]
    return {
        "roc_auc": float(roc_auc_score(y_true, probabilities)),
        "average_precision": float(average_precision_score(y_true, probabilities)),
        "brier_score": float(brier_score_loss(y_true, probabilities)),
        "precision": float(precision_score(y_true, predicted, zero_division=0)),
        "recall": float(recall_score(y_true, predicted, zero_division=0)),
        "specificity": float(tn / (tn + fp)) if tn + fp else 0.0,
        "threshold": float(threshold),
        "confusion_matrix": {"tn": tn, "fp": fp, "fn": fn, "tp": tp},
    }


def save_diagnostic_plots(y_true: np.ndarray, probabilities: np.ndarray, threshold: float, output_dir: Path) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    fraction_positive, mean_predicted = calibration_curve(y_true, probabilities, n_bins=10, strategy="quantile")
    axis_max = max(0.10, float(max(np.max(mean_predicted), np.max(fraction_positive))) * 1.25)
    fig, ax = plt.subplots(figsize=(6, 5))
    ax.plot([0, axis_max], [0, axis_max], "--", color="gray", label="Perfect calibration")
    ax.plot(mean_predicted, fraction_positive, marker="o", label="Rebuilt model")
    ax.set(xlabel="Mean predicted probability", ylabel="Observed fraud rate", title="Calibration curve (0–10% risk range)", xlim=(0, axis_max), ylim=(0, axis_max))
    ax.legend()
    fig.tight_layout()
    fig.savefig(output_dir / "calibration.png", dpi=160)
    plt.close(fig)

    matrix = confusion_matrix(y_true, probabilities >= threshold, labels=[0, 1])
    fig, ax = plt.subplots(figsize=(5, 4))
    image = ax.imshow(matrix, cmap="Blues")
    fig.colorbar(image, ax=ax)
    ax.set(xticks=[0, 1], yticks=[0, 1], xticklabels=["Legitimate", "Fraud"], yticklabels=["Legitimate", "Fraud"], xlabel="Predicted", ylabel="Actual", title=f"Confusion matrix at {threshold:.3f}")
    for row in range(2):
        for column in range(2):
            ax.text(column, row, f"{matrix[row, column]:,}", ha="center", va="center")
    fig.tight_layout()
    fig.savefig(output_dir / "confusion_matrix.png", dpi=160)
    plt.close(fig)
