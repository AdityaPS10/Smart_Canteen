"""Smart Canteen time-prediction service (spec section 12).

POST /predict  features -> minutes from payment to READY
POST /train    rebuilds the model from order history rows and saves it with joblib
GET  /health   whether a model is loaded

The service has no database access: the Next.js app sends the training rows (ml_training_rows()).
"""

from __future__ import annotations

import json
import os
import threading
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from sklearn.ensemble import GradientBoostingRegressor

HERE = Path(__file__).resolve().parent
MODEL_PATH = Path(os.environ.get("MODEL_PATH", HERE / "model.joblib"))
META_PATH = MODEL_PATH.with_name("model_meta.json")
FEATURES = ["hour", "weekday", "units_ahead", "items_count", "max_prep_minutes"]
MIN_TRAIN_ROWS = 10

app = FastAPI(title="Smart Canteen time prediction")
_lock = threading.Lock()
_state: dict = {"model": None, "meta": None}


class Features(BaseModel):
    hour: int = Field(ge=0, le=23)
    weekday: int = Field(ge=1, le=7)
    units_ahead: int = Field(ge=0, le=10_000)
    items_count: int = Field(ge=0, le=1_000)
    max_prep_minutes: int = Field(ge=0, le=240)


class TrainingRow(Features):
    minutes: float = Field(ge=0, le=24 * 60)
    is_sample: bool = False


class TrainRequest(BaseModel):
    rows: list[TrainingRow]


def _vector(f: Features) -> list[float]:
    return [float(getattr(f, name)) for name in FEATURES]


def _load() -> None:
    if MODEL_PATH.exists():
        _state["model"] = joblib.load(MODEL_PATH)
        _state["meta"] = json.loads(META_PATH.read_text()) if META_PATH.exists() else None


_load()


@app.get("/health")
def health() -> dict:
    return {"ok": True, "model": _state["model"] is not None, "meta": _state["meta"]}


@app.post("/predict")
def predict(f: Features) -> dict:
    model, meta = _state["model"], _state["meta"]
    if model is None or meta is None:
        raise HTTPException(status_code=503, detail="Model not trained yet")
    # Ready-made only orders have no cooking time.
    if f.max_prep_minutes == 0:
        minutes = 0.0
    else:
        minutes = float(model.predict(np.array([_vector(f)]))[0])
    return {
        "minutes": round(max(0.0, minutes), 2),
        "n_samples": meta["n_samples"],
        "sample_fraction": meta["sample_fraction"],
        "trained_at": meta["trained_at"],
    }


@app.post("/train")
def train(req: TrainRequest) -> dict:
    rows = req.rows
    if len(rows) < MIN_TRAIN_ROWS:
        raise HTTPException(status_code=422, detail=f"Need at least {MIN_TRAIN_ROWS} rows")
    X = np.array([_vector(r) for r in rows])
    y = np.array([r.minutes for r in rows])
    model = GradientBoostingRegressor(n_estimators=200, max_depth=3, learning_rate=0.05, random_state=0)
    model.fit(X, y)
    n_sample = sum(1 for r in rows if r.is_sample)
    meta = {
        "n_samples": len(rows),
        "n_sample_rows": n_sample,
        "sample_fraction": round(n_sample / len(rows), 4),
        "features": FEATURES,
        "trained_at": datetime.now(timezone.utc).isoformat(),
    }
    with _lock:
        tmp = MODEL_PATH.with_suffix(".tmp")
        joblib.dump(model, tmp)
        tmp.replace(MODEL_PATH)
        META_PATH.write_text(json.dumps(meta, indent=2))
        _state["model"], _state["meta"] = model, meta
    return meta
