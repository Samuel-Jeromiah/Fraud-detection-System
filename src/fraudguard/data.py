"""Loading, validation, and time-window assignment for the raw CSV files."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

import pandas as pd


RAW_COLUMNS = [
    "trans_date_trans_time",
    "cc_num",
    "merchant",
    "category",
    "amt",
    "lat",
    "long",
    "city_pop",
    "unix_time",
    "merch_lat",
    "merch_long",
    "is_fraud",
]


@dataclass(frozen=True)
class DataPaths:
    train: Path
    test: Path


def project_root() -> Path:
    return Path(__file__).resolve().parents[2]


def resolve_data_paths(data_dir: str | Path | None = None) -> DataPaths:
    """Find the CSVs in an explicit directory, FRAUD_DATA_DIR, or project root."""
    root = Path(data_dir or os.environ.get("FRAUD_DATA_DIR", project_root()))
    paths = DataPaths(root / "fraudTrain.csv", root / "fraudTest.csv")
    missing = [str(path) for path in (paths.train, paths.test) if not path.exists()]
    if missing:
        raise FileNotFoundError(
            "Raw data files are required. Set FRAUD_DATA_DIR or pass --data-dir. "
            f"Missing: {', '.join(missing)}"
        )
    return paths


def read_transactions(path: Path, source: str, nrows: int | None = None) -> pd.DataFrame:
    """Read only allowed raw columns and normalize chronology."""
    frame = pd.read_csv(path, usecols=RAW_COLUMNS, parse_dates=["trans_date_trans_time"], nrows=nrows)
    missing = set(RAW_COLUMNS).difference(frame.columns)
    if missing:
        raise ValueError(f"{path.name} is missing columns: {sorted(missing)}")
    if frame[RAW_COLUMNS].isna().any().any():
        bad = frame[RAW_COLUMNS].isna().sum()
        raise ValueError(f"{path.name} contains missing values: {bad[bad.gt(0)].to_dict()}")
    if not set(frame["is_fraud"].unique()).issubset({0, 1}):
        raise ValueError(f"{path.name} has a non-binary is_fraud label")
    frame = frame.rename(columns={"trans_date_trans_time": "timestamp"})
    frame["source"] = source
    return frame.sort_values("timestamp", kind="stable").reset_index(drop=True)


def load_raw_data(data_dir: str | Path | None = None, nrows: int | None = None) -> tuple[pd.DataFrame, pd.DataFrame]:
    paths = resolve_data_paths(data_dir)
    return read_transactions(paths.train, "development", nrows), read_transactions(paths.test, "test", nrows)


def summarize_transactions(frame: pd.DataFrame) -> dict:
    return {
        "rows": int(len(frame)),
        "fraud_rows": int(frame["is_fraud"].sum()),
        "fraud_rate": float(frame["is_fraud"].mean()),
        "start": frame["timestamp"].min().isoformat(),
        "end": frame["timestamp"].max().isoformat(),
        "categories": sorted(frame["category"].unique().tolist()),
        "missing_values": int(frame.drop(columns=["source"]).isna().sum().sum()),
    }


def audit_raw_data(data_dir: str | Path | None = None) -> dict:
    """Return serializable source checks without exposing PII values."""
    train, test = load_raw_data(data_dir)

    return {"development": summarize_transactions(train), "test": summarize_transactions(test)}


def assign_development_windows(development: pd.DataFrame) -> pd.Series:
    """Assign chronological windows: fit 60%, early-stop 10%, calibrate 15%, threshold 15%."""
    ordered = development.sort_values("timestamp", kind="stable").reset_index(drop=True)
    n_rows = len(ordered)
    cut_fit = int(n_rows * 0.60)
    cut_early = int(n_rows * 0.70)
    cut_calibration = int(n_rows * 0.85)
    labels = pd.Series("threshold_validation", index=ordered.index, dtype="object")
    labels.iloc[:cut_fit] = "fit"
    labels.iloc[cut_fit:cut_early] = "early_stopping"
    labels.iloc[cut_early:cut_calibration] = "calibration"
    return labels
