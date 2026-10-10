import "server-only";
import { rpc } from "./db";
import { env } from "./env";
import { formulaEstimate, type PredictionFeatures } from "./prediction-formula";

interface MlPrediction {
  minutes: number;
  n_samples: number;
  sample_fraction: number;
}

async function mlFetch<T>(path: string, init?: RequestInit, timeoutMs = 1500): Promise<T | null> {
  const base = env.mlUrl();
  if (!base) return null;
  try {
    const res = await fetch(`${base.replace(/\/$/, "")}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null; // ML service down -> caller falls back
  }
}

/** Called when the token is generated: predict, store estimated_minutes + source on the order. */
export async function estimateAndStore(orderId: string): Promise<void> {
  const f = await rpc<PredictionFeatures>("prediction_features", { p_order_id: orderId });

  let minutes: number;
  let source: "formula" | "ml" | "ml_sample" = "formula";

  if (f.all_ready_made) {
    minutes = 0;
  } else {
    const ml = await mlFetch<MlPrediction>("/predict", {
      method: "POST",
      body: JSON.stringify({
        hour: f.hour,
        weekday: f.weekday,
        units_ahead: f.units_ahead,
        items_count: f.items_count,
        max_prep_minutes: f.max_prep_minutes,
      }),
    });
    if (ml && Number.isFinite(ml.minutes) && ml.n_samples >= f.ml_min_samples) {
      minutes = Math.max(1, Math.round(ml.minutes));
      source = ml.sample_fraction > 0.5 ? "ml_sample" : "ml";
    } else {
      minutes = formulaEstimate(f);
    }
  }

  await rpc("set_order_estimate", { p_order_id: orderId, p_minutes: minutes, p_source: source });
}

/** Does the ML service currently have a trained model? null = service unreachable. */
export async function mlHasModel(): Promise<boolean | null> {
  const h = await mlFetch<{ model: boolean }>("/health");
  return h ? h.model : null;
}

/** Rebuilds the model from order history (POST /train). Returns true on success. */
export async function retrainModel(completedOrders: number): Promise<boolean> {
  const rows = await rpc<Array<Record<string, unknown>>>("ml_training_rows", { p_limit: 5000 });
  const r = await mlFetch<{ n_samples: number }>(
    "/train",
    { method: "POST", body: JSON.stringify({ rows }) },
    30_000,
  );
  if (!r) return false;
  await rpc("mark_ml_trained", { p_completed_count: completedOrders });
  return true;
}
