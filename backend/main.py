"""FastAPI scoring service for the legacy baseline and rebuilt calibrated bundle."""

from __future__ import annotations

import pickle
import sys
import os
import json
from datetime import datetime
from pathlib import Path

import joblib
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

BASE = Path(__file__).resolve().parent
REPOSITORY = BASE.parent
MODELS = BASE / "models"
sys.path.insert(0, str(REPOSITORY / "src"))
from fraudguard.serving import build_serving_frame  # noqa: E402


def _load_legacy():
    with (MODELS / "fraud_model.pkl").open("rb") as file:
        model = pickle.load(file)
    with (MODELS / "features.pkl").open("rb") as file:
        features = list(pickle.load(file))
    with (MODELS / "threshold.pkl").open("rb") as file:
        threshold = float(pickle.load(file))
    return {"kind": "legacy", "model": model, "features": features, "threshold": threshold}


def _load_model():
    """Prefer a reviewed rebuilt bundle; preserve legacy inference until it exists."""
    rebuilt_path = Path(os.environ.get("FRAUD_MODEL_BUNDLE", MODELS / "model_bundle.joblib"))
    if rebuilt_path.exists():
        bundle = joblib.load(rebuilt_path)
        required = {"preprocessor", "model", "calibrator", "threshold"}
        if not required.issubset(bundle):
            raise RuntimeError(f"Rebuilt model bundle lacks: {sorted(required.difference(bundle))}")
        return {"kind": "rebuilt", **bundle}
    return _load_legacy()


LOADED = _load_model()
MODEL = LOADED["model"]
THRESHOLD = float(LOADED["threshold"])
LEGACY_FEATURES = LOADED.get("features", [])
LEGACY_CATEGORIES = [feature.removeprefix("cat_") for feature in LEGACY_FEATURES if feature.startswith("cat_")]


def _model_card() -> dict:
    card_path = MODELS / "model_card.json"
    if not card_path.exists():
        return {}
    try:
        return json.loads(card_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}

app = FastAPI(
    title="FraudGuard API",
    description="Academic fraud-risk scorer. Scores require a reviewed model bundle and point-in-time inputs.",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ScoreRequest(BaseModel):
    amount: float = Field(default=100.0, ge=0)
    category: str = "shopping_net"
    hour: int = Field(default=14, ge=0, le=23)
    day_of_week: int = Field(default=2, ge=0, le=6)
    distance_from_home_km: float | None = Field(default=None, ge=0)
    # Legacy alias retained only while the original artifact remains available.
    distance_from_home: float | None = Field(default=None, ge=0)
    city_pop: int = Field(default=50_000, ge=0)
    customer_prior_count: int = Field(default=0, ge=0)
    customer_prior_avg_amount: float | None = Field(default=None, ge=0)
    customer_avg_amt: float | None = Field(default=None, ge=0)
    customer_merchant_prior_count: int | None = Field(default=None, ge=0)
    merchant_visit_count: int | None = Field(default=None, ge=0)
    month: int | None = Field(default=None, ge=1, le=12)
    # Fields below exist solely so the legacy model endpoint remains usable.
    age: int = Field(default=35, ge=0, le=120)
    gender: str = "Male"
    merchant_risk: float = Field(default=0.5, ge=0, le=1)
    is_new_merchant: bool = False


def _legacy_vector(request: ScoreRequest) -> pd.DataFrame:
    """Legacy 31-column vector, retained only until a rebuilt bundle is deployed."""
    now = datetime.now()
    amount = float(request.amount)
    average = float(request.customer_avg_amt or request.customer_prior_avg_amount or 50.0)
    distance = float(request.distance_from_home if request.distance_from_home is not None else request.distance_from_home_km or 0.0)
    merchant_visits = int(request.merchant_visit_count if request.merchant_visit_count is not None else request.customer_merchant_prior_count or 0)
    values = {
        "amt": amount, "city_pop": float(request.city_pop),
        "unix_time": float(datetime(now.year, now.month, now.day, request.hour).timestamp()),
        "trans_hour": request.hour, "trans_day_of_week": request.day_of_week,
        "is_weekend": int(request.day_of_week >= 5), "trans_month": request.month or now.month,
        "distance_from_home": distance, "customer_avg_amt": average,
        "amt_deviation": amount - average, "amt_ratio": amount / (average + 0.01),
        "category_avg_amt": average, "merchant_visit_count": merchant_visits,
        "is_new_merchant": int(request.is_new_merchant), "age": request.age,
        "gender_encoded": int(request.gender.lower().startswith("m")), "merchant_encoded": request.merchant_risk,
    }
    row = {feature: 0.0 for feature in LEGACY_FEATURES}
    row.update({key: value for key, value in values.items() if key in row})
    category_key = f"cat_{request.category}"
    if category_key in row:
        row[category_key] = 1.0
    return pd.DataFrame([[row[feature] for feature in LEGACY_FEATURES]], columns=LEGACY_FEATURES)


def _risk_tier(probability: float) -> str:
    if probability < THRESHOLD * 0.4:
        return "LOW"
    if probability < THRESHOLD:
        return "MEDIUM"
    if probability < THRESHOLD + 0.25:
        return "HIGH"
    return "CRITICAL"


def _categories() -> list[str]:
    if LOADED["kind"] == "legacy":
        return LEGACY_CATEGORIES
    encoder = LOADED["preprocessor"].named_transformers_["category"].named_steps["one_hot"]
    return [str(value) for value in encoder.categories_[0]]


@app.get("/")
def root():
    return {"service": "FraudGuard API", "status": "ok", "model_status": LOADED["kind"], "docs": "/docs"}


@app.get("/api/health")
def health():
    return {"status": "ok", "model_status": LOADED["kind"]}


@app.get("/api/metadata")
def metadata():
    if LOADED["kind"] == "legacy":
        importance = {feature: float(weight) for feature, weight in zip(LEGACY_FEATURES, getattr(MODEL, "feature_importances_", []))}
        return {
            "model_status": "legacy_baseline_not_calibrated",
            "threshold": THRESHOLD, "n_features": len(LEGACY_FEATURES), "features": LEGACY_FEATURES,
            "categories": _categories(), "feature_importance": importance,
        }
    feature_names = [str(name) for name in LOADED["preprocessor"].get_feature_names_out()]
    importance = {name: float(value) for name, value in zip(feature_names, getattr(MODEL, "feature_importances_", []))}
    calibration_method = LOADED.get("calibration_method", "unknown")
    card = _model_card()
    return {
        "model_status": "rebuilt_calibrated" if calibration_method != "uncalibrated_identity" else "rebuilt_probability_checked",
        "threshold": THRESHOLD, "n_features": len(feature_names), "features": feature_names,
        "categories": _categories(), "feature_importance": importance,
        "minimum_recall_policy": LOADED.get("minimum_recall"),
        "calibration_method": calibration_method,
        "final_test_metrics": card.get("final_test_metrics"),
    }


@app.post("/api/score")
def score(request: ScoreRequest):
    average = float(request.customer_prior_avg_amount or request.customer_avg_amt or LOADED.get("fallback_prior_amount", 50.0))
    visits = int(request.customer_merchant_prior_count if request.customer_merchant_prior_count is not None else request.merchant_visit_count or 0)
    distance = request.distance_from_home_km if request.distance_from_home_km is not None else request.distance_from_home
    if distance is None:
        raise HTTPException(status_code=422, detail="distance_from_home_km is required for rebuilt scoring")
    if LOADED["kind"] == "rebuilt":
        frame = build_serving_frame(
            amount=request.amount, category=request.category, hour=request.hour, day_of_week=request.day_of_week,
            distance_from_home_km=distance, city_pop=request.city_pop, customer_prior_count=request.customer_prior_count,
            customer_prior_avg_amount=average, customer_merchant_prior_count=visits, month=request.month,
        )
        raw_probability = float(MODEL.predict_proba(LOADED["preprocessor"].transform(frame))[0][1])
        calibrator = LOADED["calibrator"]
        probability = float(calibrator.predict_proba([[raw_probability]])[0][1]) if hasattr(calibrator, "predict_proba") else float(calibrator.predict([raw_probability])[0])
    else:
        probability = float(MODEL.predict_proba(_legacy_vector(request))[0][1])

    ratio = request.amount / max(average, 0.01)
    factors = [
        {"factor": "Amount vs. prior average", "value": f"${request.amount:,.0f} · {ratio:.1f}x average", "signal": "high" if ratio >= 2 else "normal"},
        {"factor": "Distance from home", "value": f"{distance:,.1f} km", "signal": "high" if distance > 80 else "normal"},
        {"factor": "Prior transactions", "value": f"{request.customer_prior_count:,}", "signal": "normal"},
        {"factor": "Prior visits to merchant", "value": f"{visits:,}", "signal": "medium" if visits == 0 else "normal"},
        {"factor": "Transaction hour", "value": f"{request.hour:02d}:00", "signal": "high" if request.hour < 6 else "normal"},
    ]
    return {
        "probability": probability, "threshold": THRESHOLD, "is_fraud": bool(probability >= THRESHOLD),
        "risk_tier": _risk_tier(probability), "confidence": max(probability, 1 - probability),
        "model_status": LOADED["kind"], "factors": factors,
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
