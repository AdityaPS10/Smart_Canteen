import importlib
import random

from fastapi.testclient import TestClient


def make_client(tmp_path, monkeypatch):
    monkeypatch.setenv("MODEL_PATH", str(tmp_path / "model.joblib"))
    import app as app_module

    importlib.reload(app_module)
    return TestClient(app_module.app)


def rows(n, sample=True):
    rnd = random.Random(1)
    out = []
    for _ in range(n):
        ahead, prep = rnd.randint(0, 20), rnd.choice([2, 3, 4, 6])
        out.append(
            {
                "hour": rnd.choice([9, 12, 13, 16]),
                "weekday": rnd.randint(1, 7),
                "units_ahead": ahead,
                "items_count": rnd.randint(1, 4),
                "max_prep_minutes": prep,
                "minutes": prep + ahead * 1.1,
                "is_sample": sample,
            }
        )
    return out


def test_predict_before_training_is_503(tmp_path, monkeypatch):
    c = make_client(tmp_path, monkeypatch)
    assert c.get("/health").json()["model"] is False
    r = c.post("/predict", json={"hour": 12, "weekday": 2, "units_ahead": 3, "items_count": 1, "max_prep_minutes": 4})
    assert r.status_code == 503


def test_train_then_predict(tmp_path, monkeypatch):
    c = make_client(tmp_path, monkeypatch)
    meta = c.post("/train", json={"rows": rows(200)}).json()
    assert meta["n_samples"] == 200 and meta["sample_fraction"] == 1.0
    assert (tmp_path / "model.joblib").exists()

    busy = c.post("/predict", json={"hour": 13, "weekday": 3, "units_ahead": 18, "items_count": 2, "max_prep_minutes": 6}).json()
    quiet = c.post("/predict", json={"hour": 9, "weekday": 3, "units_ahead": 0, "items_count": 1, "max_prep_minutes": 2}).json()
    assert busy["minutes"] > quiet["minutes"]
    assert busy["sample_fraction"] == 1.0

    ready_made = c.post("/predict", json={"hour": 9, "weekday": 3, "units_ahead": 5, "items_count": 1, "max_prep_minutes": 0}).json()
    assert ready_made["minutes"] == 0


def test_train_rejects_too_few_rows(tmp_path, monkeypatch):
    c = make_client(tmp_path, monkeypatch)
    assert c.post("/train", json={"rows": rows(3)}).status_code == 422
