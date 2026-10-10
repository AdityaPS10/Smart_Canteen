import { createHmac } from "node:crypto";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { ITEM, STUDENT1, checkIn, freshDb, one, placeOrder, rows, setNow, startAttempt } from "../helpers/pg";
import { pgRpc } from "../helpers/rpc-shim";

// Run the real route handler against the real SQL (PGlite), with no network.
let db: PGlite;
vi.mock("@/lib/db", () => ({ rpc: (fn: string, args?: Record<string, unknown>) => pgRpc(db, fn, args) }));
vi.mock("@/auth", () => ({ auth: async () => null }));

const SECRET = "whsec_test_secret";
process.env.RAZORPAY_WEBHOOK_SECRET = SECRET;
process.env.NEXT_PUBLIC_SUPABASE_URL = "http://supabase.invalid";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test";
delete process.env.ML_URL;

const { POST } = await import("@/app/api/payments/webhook/route");

function webhook(body: object, signature?: string) {
  const raw = JSON.stringify(body);
  return POST(
    new Request("http://localhost/api/payments/webhook", {
      method: "POST",
      headers: { "x-razorpay-signature": signature ?? createHmac("sha256", SECRET).update(raw).digest("hex") },
      body: raw,
    }),
  );
}

const captured = (orderId: string, paymentId: string, amount: number) => ({
  event: "payment.captured",
  payload: { payment: { entity: { id: paymentId, order_id: orderId, amount } } },
});

beforeAll(() => {
  // Realtime broadcasts are best-effort; stub the network.
  vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 200 })));
});

beforeEach(async () => {
  db = await freshDb();
  await setNow(db, "2026-01-05T06:00:00Z");
  await checkIn(db, STUDENT1);
});

describe("POST /api/payments/webhook", () => {
  it("rejects an invalid signature with 400 and changes nothing", async () => {
    const r = await placeOrder(db, STUDENT1, [{ menu_item_id: ITEM.tea, quantity: 1 }]);
    const gid = await startAttempt(db, r.order_id, STUDENT1);
    const res = await webhook(captured(gid, "pay_1", r.total_paise), "0".repeat(64));
    expect(res.status).toBe(400);
    const o = await one<{ status: string }>(db, "select status from orders where id=$1", [r.order_id]);
    expect(o.status).toBe("PENDING_PAYMENT");
  });

  it("is idempotent: the same webhook delivered twice creates one token", async () => {
    const r = await placeOrder(db, STUDENT1, [{ menu_item_id: ITEM.masalaDosa, quantity: 1 }]);
    const gid = await startAttempt(db, r.order_id, STUDENT1);

    const first = await webhook(captured(gid, "pay_dup", r.total_paise));
    const second = await webhook(captured(gid, "pay_dup", r.total_paise));
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect((await first.json()).result).toBe("confirmed");
    expect((await second.json()).result).toBe("duplicate");

    const o = await one<{ status: string; token_number: number; estimated_minutes: number; estimate_source: string }>(
      db,
      "select status, token_number, estimated_minutes, estimate_source from orders where id=$1",
      [r.order_id],
    );
    expect(o.status).toBe("PAID");
    expect(o.token_number).toBe(1);
    // ML service is down in this test -> formula fallback was stored when the token was generated
    expect(o.estimate_source).toBe("formula");
    expect(o.estimated_minutes).toBeGreaterThan(0);
    expect(await rows(db, "select 1 from order_events where order_id=$1 and event='paid'", [r.order_id])).toHaveLength(1);
  });

  it("payment.failed counts an attempt; the third failure fails the order", async () => {
    const r = await placeOrder(db, STUDENT1, [{ menu_item_id: ITEM.tea, quantity: 1 }]);
    for (let i = 1; i <= 3; i++) {
      const gid = await startAttempt(db, r.order_id, STUDENT1);
      const res = await webhook({
        event: "payment.failed",
        payload: { payment: { entity: { id: `pay_f${i}`, order_id: gid, error_description: "declined" } } },
      });
      expect((await res.json()).result).toBe("failed");
    }
    const o = await one<{ status: string }>(db, "select status from orders where id=$1", [r.order_id]);
    expect(o.status).toBe("PAYMENT_FAILED");
  });
});
