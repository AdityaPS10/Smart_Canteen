import "server-only";
import { randomUUID } from "node:crypto";
import { rpc } from "./db";
import { env, paymentMode } from "./env";
import { AppError } from "./errors";
import { broadcast, canteenSignal, orderSignal } from "./realtime";
import type { PaymentInfo } from "./payment-info";
import type { Order } from "./types";

/** Asks Razorpay (test mode) for an order for the server-calculated amount, or makes a MOCK id. */
async function createGatewayOrder(orderId: string, amountPaise: number, attemptNo: number): Promise<string> {
  if (paymentMode() === "mock") return `mock_${randomUUID()}`;
  const auth = Buffer.from(`${env.razorpayKeyId()}:${env.razorpayKeySecret()}`).toString("base64");
  let res: Response;
  try {
    res = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: amountPaise,
        currency: "INR",
        receipt: `${orderId.slice(0, 30)}-${attemptNo}`,
        notes: { order_id: orderId },
      }),
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    throw new AppError("PAYMENT_GATEWAY");
  }
  if (!res.ok) {
    console.error("[razorpay] order create failed", res.status, await res.text().catch(() => ""));
    throw new AppError("PAYMENT_GATEWAY");
  }
  const body = (await res.json()) as { id?: string };
  if (!body.id) throw new AppError("PAYMENT_GATEWAY");
  return body.id;
}

/** Starts one UPI attempt (counts toward the retry limit). */
export async function startPayment(orderId: string, studentId: string): Promise<PaymentInfo> {
  const o = await rpc<Order>("can_start_payment", { p_order_id: orderId, p_student_id: studentId });
  const gatewayOrderId = await createGatewayOrder(o.id, o.total_paise, o.payment_attempts + 1);
  const p = await rpc<{ gateway_order_id: string; amount_paise: number }>("start_payment_attempt", {
    p_order_id: orderId,
    p_student_id: studentId,
    p_gateway_order_id: gatewayOrderId,
  });
  return paymentInfo(orderId, p.gateway_order_id, p.amount_paise);
}

export function paymentInfo(orderId: string, gatewayOrderId: string, amountPaise: number): PaymentInfo {
  const mode = gatewayOrderId.startsWith("mock_") ? "mock" : "razorpay";
  return {
    mode,
    order_id: orderId,
    gateway_order_id: gatewayOrderId,
    amount_paise: amountPaise,
    ...(mode === "razorpay" ? { key_id: env.razorpayKeyId() } : {}),
  };
}

export interface ConfirmResult {
  result: "confirmed" | "duplicate" | "late" | "amount_mismatch" | "unknown";
  order_id?: string;
  status?: string;
  token_number?: number;
  canteen_id?: string;
}

export interface FailResult {
  result: "failed" | "ignored" | "unknown";
  order_id?: string;
  status?: string;
  canteen_id?: string;
  attempts_left?: number;
}

export async function confirmPayment(gatewayOrderId: string, gatewayPaymentId: string, amountPaise: number) {
  const r = await rpc<ConfirmResult>("confirm_payment", {
    p_gateway_order_id: gatewayOrderId,
    p_gateway_payment_id: gatewayPaymentId,
    p_amount_paise: amountPaise,
  });
  if (r.result === "late") console.warn("[payments] payment after order failed; no token created", r.order_id);
  if (r.result === "amount_mismatch") console.warn("[payments] amount mismatch", r.order_id);
  if (r.result === "unknown") console.warn("[payments] unknown gateway order", gatewayOrderId);
  if (r.result === "confirmed" && r.order_id && r.canteen_id) {
    await afterTokenCreated(r.order_id, r.canteen_id, r.status ?? "PAID");
  }
  return r;
}

export async function failPayment(gatewayOrderId: string, reason: string) {
  const r = await rpc<FailResult>("fail_payment", { p_gateway_order_id: gatewayOrderId, p_reason: reason });
  if (r.result === "failed" && r.order_id && r.canteen_id) {
    await broadcast([orderSignal(r.order_id, r.status ?? "PENDING_PAYMENT"), canteenSignal(r.canteen_id, "menu_changed")]);
  }
  return r;
}

/** Token and bill created (UPI or cash): tell every screen. */
export async function afterTokenCreated(orderId: string, canteenId: string, status: string) {
  await broadcast([
    canteenSignal(canteenId, "orders_changed"),
    canteenSignal(canteenId, "menu_changed"),
    orderSignal(orderId, status),
  ]);
}
