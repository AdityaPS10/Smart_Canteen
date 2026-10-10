import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { handle } from "@/lib/http";
import { confirmPayment, failPayment } from "@/lib/order-service";
import { parseWebhook, verifyWebhookSignature } from "@/lib/razorpay";

// POST /api/payments/webhook  Razorpay webhook = source of truth for UPI payments.
// Invalid signature -> 400. Idempotent: a repeated delivery is acknowledged without side effects.
export const POST = handle(async (req: Request) => {
  const raw = await req.text();
  const secret = env.razorpayWebhookSecret() ?? "";
  if (!verifyWebhookSignature(raw, req.headers.get("x-razorpay-signature"), secret)) {
    return NextResponse.json({ error: "INVALID_SIGNATURE" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 });
  }

  const action = parseWebhook(body);
  if (action.kind === "success") {
    const r = await confirmPayment(action.gatewayOrderId, action.gatewayPaymentId, action.amountPaise);
    return NextResponse.json({ ok: true, result: r.result });
  }
  if (action.kind === "failure") {
    const r = await failPayment(action.gatewayOrderId, action.reason);
    return NextResponse.json({ ok: true, result: r.result });
  }
  return NextResponse.json({ ok: true, result: "ignored" });
});
