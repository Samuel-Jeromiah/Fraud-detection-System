"""Point-in-time feature engineering shared by training and serving contracts."""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd


NUMERIC_FEATURES = [
    "amount_log",
    "city_pop_log",
    "distance_from_home_km",
    "transaction_hour",
    "day_of_week",
    "is_weekend",
    "month",
    "customer_prior_count",
    "customer_prior_avg_amount",
    "amount_to_customer_avg",
    "customer_merchant_prior_count",
    "is_new_to_merchant",
]
CATEGORICAL_FEATURES = ["category"]
MODEL_FEATURES = NUMERIC_FEATURES + CATEGORICAL_FEATURES


@dataclass(frozen=True)
class FeatureBuildResult:
    features: pd.DataFrame
    labels: pd.Series
    timestamps: pd.Series
    sources: pd.Series


def _haversine_km(lat1: pd.Series, lon1: pd.Series, lat2: pd.Series, lon2: pd.Series) -> np.ndarray:
    """Vectorized great-circle distance, avoiding slow row-wise apply."""
    earth_radius_km = 6371.0088
    lat1_rad, lon1_rad = np.radians(lat1), np.radians(lon1)
    lat2_rad, lon2_rad = np.radians(lat2), np.radians(lon2)
    delta_lat = lat2_rad - lat1_rad
    delta_lon = lon2_rad - lon1_rad
    a = np.sin(delta_lat / 2) ** 2 + np.cos(lat1_rad) * np.cos(lat2_rad) * np.sin(delta_lon / 2) ** 2
    return 2 * earth_radius_km * np.arcsin(np.sqrt(a))


def build_feature_table(raw: pd.DataFrame, fallback_prior_amount: float | None = None) -> FeatureBuildResult:
    """Create features using the current event and events strictly earlier in order.

    No aggregate in this function uses ``is_fraud``. The raw label is carried only
    as the output series. The input must include all chronologically earlier data
    that should be visible to the later scoring period (for example, development
    rows before external test rows).
    """
    required = {
        "timestamp", "cc_num", "merchant", "category", "amt", "lat", "long",
        "city_pop", "merch_lat", "merch_long", "is_fraud", "source",
    }
    missing = required.difference(raw.columns)
    if missing:
        raise ValueError(f"Cannot build features; missing: {sorted(missing)}")

    work = raw.sort_values("timestamp", kind="stable").reset_index(drop=True).copy()
    default_amount = float(fallback_prior_amount if fallback_prior_amount is not None else work["amt"].median())

    # cumcount is the number of earlier rows in the same group. The cumsum is
    # reduced by the current amount, so the present event cannot influence its
    # own historical average.
    customer_group = work.groupby("cc_num", sort=False)["amt"]
    prior_count = customer_group.cumcount().astype("float64")
    prior_sum = customer_group.cumsum() - work["amt"]
    prior_avg = (prior_sum / prior_count.replace(0, np.nan)).fillna(default_amount)
    prior_merchant_count = work.groupby(["cc_num", "merchant"], sort=False).cumcount().astype("float64")

    features = pd.DataFrame(index=work.index)
    features["amount_log"] = np.log1p(work["amt"].clip(lower=0))
    features["city_pop_log"] = np.log1p(work["city_pop"].clip(lower=0))
    features["distance_from_home_km"] = _haversine_km(work["lat"], work["long"], work["merch_lat"], work["merch_long"])
    features["transaction_hour"] = work["timestamp"].dt.hour.astype("int16")
    features["day_of_week"] = work["timestamp"].dt.dayofweek.astype("int16")
    features["is_weekend"] = (features["day_of_week"] >= 5).astype("int8")
    features["month"] = work["timestamp"].dt.month.astype("int16")
    features["customer_prior_count"] = prior_count
    features["customer_prior_avg_amount"] = prior_avg
    features["amount_to_customer_avg"] = (work["amt"] / prior_avg.clip(lower=0.01)).clip(upper=1000)
    features["customer_merchant_prior_count"] = prior_merchant_count
    features["is_new_to_merchant"] = (prior_merchant_count == 0).astype("int8")
    features["category"] = work["category"].astype("string")

    return FeatureBuildResult(
        features=features[MODEL_FEATURES],
        labels=work["is_fraud"].astype("int8"),
        timestamps=work["timestamp"],
        sources=work["source"],
    )
