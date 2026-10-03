"""The explicit serving contract for a trained rebuilt model bundle."""

from __future__ import annotations

import math
from datetime import datetime

import pandas as pd


def build_serving_frame(
    *,
    amount: float,
    category: str,
    hour: int,
    day_of_week: int,
    distance_from_home_km: float,
    city_pop: int,
    customer_prior_count: int,
    customer_prior_avg_amount: float,
    customer_merchant_prior_count: int,
    month: int | None = None,
) -> pd.DataFrame:
    """Build one rebuilt-model row from values a feature store can supply.

    The caller is responsible for calculating history fields before the current
    transaction. This function refuses to fabricate a merchant risk or target
    encoding from a browser input.
    """
    safe_hour = max(0, min(23, int(hour)))
    safe_day = max(0, min(6, int(day_of_week)))
    safe_month = max(1, min(12, int(month if month is not None else datetime.now().month)))
    safe_amount = max(0.0, float(amount))
    prior_average = max(0.01, float(customer_prior_avg_amount))
    prior_merchant_count = max(0, int(customer_merchant_prior_count))
    return pd.DataFrame(
        [{
            "amount_log": math.log1p(safe_amount),
            "city_pop_log": math.log1p(max(0, int(city_pop))),
            "distance_from_home_km": max(0.0, float(distance_from_home_km)),
            "transaction_hour": safe_hour,
            "day_of_week": safe_day,
            "is_weekend": int(safe_day >= 5),
            "month": safe_month,
            "customer_prior_count": max(0, int(customer_prior_count)),
            "customer_prior_avg_amount": prior_average,
            "amount_to_customer_avg": min(1000.0, safe_amount / prior_average),
            "customer_merchant_prior_count": prior_merchant_count,
            "is_new_to_merchant": int(prior_merchant_count == 0),
            "category": category,
        }]
    )
