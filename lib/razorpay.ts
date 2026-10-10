import { createHmac, timingSafeEqual } from "node:crypto";

// Pure Razorpay helpers (no env access) so they can be unit-tested.

/** Razorpay signs the raw webhook body with HMAC-SHA256 (hex) using the webhook secret. */
export function verifyWebhookSignature(rawBody: string, signature: string | null, secret: string): boolean {
  if (!signature || !secret) return false;
  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature.trim(), "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

export type WebhookAction =
  | { kind: "success"; gatewayOrderId: string; gatewayPaymentId: string; amountPaise: number }
  | { kind: "failure"; gatewayOrderId: string; gatewayPaymentId: string; reason: string }
  | { kind: "ignore"; event: string };

interface PaymentEntity {
  id?: string;
  order_id?: string;
  amount?: number;
  error_description?: string;
  error_code?: string;
}

/** Maps a Razorpay webhook body to what we do with it. */
export function parseWebhook(body: unknown): WebhookAction {
  const b = body as { event?: string; payload?: { payment?: { entity?: PaymentEntity } } };
  const event = b?.event ?? "unknown";
  const p = b?.payload?.payment?.entity;
  if (!p?.id || !p.order_id) return { kind: "ignore", event };

  if (event === "payment.captured" || event === "order.paid") {
    if (typeof p.amount !== "number" || !Number.isInteger(p.amount)) return { kind: "ignore", event };
    return { kind: "success", gatewayOrderId: p.order_id, gatewayPaymentId: p.id, amountPaise: p.amount };
  }
  if (event === "payment.failed") {
    return {
      kind: "failure",
      gatewayOrderId: p.order_id,
      gatewayPaymentId: p.id,
      reason: p.error_description ?? p.error_code ?? "failed",
    };
  }
  return { kind: "ignore", event };
}
