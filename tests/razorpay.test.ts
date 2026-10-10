import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { parseWebhook, verifyWebhookSignature } from "@/lib/razorpay";

const SECRET = "whsec_test";
const sign = (body: string) => createHmac("sha256", SECRET).update(body).digest("hex");

describe("Razorpay webhook", () => {
  const body = JSON.stringify({
    event: "payment.captured",
    payload: { payment: { entity: { id: "pay_1", order_id: "order_1", amount: 6000 } } },
  });

  it("accepts a valid signature and rejects anything else", () => {
    expect(verifyWebhookSignature(body, sign(body), SECRET)).toBe(true);
    expect(verifyWebhookSignature(body + " ", sign(body), SECRET)).toBe(false);
    expect(verifyWebhookSignature(body, "deadbeef", SECRET)).toBe(false);
    expect(verifyWebhookSignature(body, null, SECRET)).toBe(false);
    expect(verifyWebhookSignature(body, sign(body), "")).toBe(false);
  });

  it("maps events to actions", () => {
    expect(parseWebhook(JSON.parse(body))).toEqual({
      kind: "success",
      gatewayOrderId: "order_1",
      gatewayPaymentId: "pay_1",
      amountPaise: 6000,
    });
    expect(
      parseWebhook({
        event: "payment.failed",
        payload: { payment: { entity: { id: "pay_2", order_id: "order_1", error_description: "declined" } } },
      }),
    ).toEqual({ kind: "failure", gatewayOrderId: "order_1", gatewayPaymentId: "pay_2", reason: "declined" });
    expect(parseWebhook({ event: "payment.authorized", payload: { payment: { entity: { id: "p", order_id: "o", amount: 1 } } } }).kind).toBe("ignore");
    expect(parseWebhook({}).kind).toBe("ignore");
  });
});
