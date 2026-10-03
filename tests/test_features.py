from __future__ import annotations

import pandas as pd

from fraudguard.features import build_feature_table


def _raw_rows(labels=(0, 1)) -> pd.DataFrame:
    return pd.DataFrame(
        {
            "timestamp": pd.to_datetime(["2020-01-01 08:00:00", "2020-01-01 09:00:00", "2020-01-01 10:00:00"]),
            "cc_num": [1, 1, 2],
            "merchant": ["A", "A", "B"],
            "category": ["food_dining", "food_dining", "travel"],
            "amt": [10.0, 30.0, 8.0],
            "lat": [42.0, 42.0, 40.0],
            "long": [-71.0, -71.0, -74.0],
            "city_pop": [1000, 1000, 500],
            "merch_lat": [42.1, 42.1, 40.1],
            "merch_long": [-71.1, -71.1, -74.1],
            "is_fraud": list(labels) + [0],
            "source": ["development", "development", "development"],
        }
    )


def test_history_features_only_use_prior_transactions():
    built = build_feature_table(_raw_rows(), fallback_prior_amount=20.0).features
    assert built.loc[0, "customer_prior_count"] == 0
    assert built.loc[0, "customer_prior_avg_amount"] == 20.0
    assert built.loc[1, "customer_prior_count"] == 1
    assert built.loc[1, "customer_prior_avg_amount"] == 10.0
    assert built.loc[1, "customer_merchant_prior_count"] == 1
    assert built.loc[1, "is_new_to_merchant"] == 0


def test_labels_cannot_change_features():
    first = build_feature_table(_raw_rows(labels=(0, 1)), fallback_prior_amount=20.0).features
    second = build_feature_table(_raw_rows(labels=(1, 0)), fallback_prior_amount=20.0).features
    pd.testing.assert_frame_equal(first, second)
