import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import {
  CANTEEN, ITEM, STUDENT1, STUDENT2, checkIn, confirm, expectDbError, fail, freshDb, one, placeOrder, rows,
  setNow, startAttempt, stockOf,
} from "../helpers/pg";

let db: PGlite;
beforeEach(async () => {
  db = await freshDb();
  await setNow(db, "2026-01-05T06:00:00Z");
  await checkIn(db, STUDENT1);
});

describe("placing an order", () => {
  it("ignores prices sent by the client and uses the server's prices", async () => {
    const r = await placeOrder(db, STUDENT1, [
      { menu_item_id: ITEM.masalaDosa, quantity: 2, price_paise: 1, unit_price_paise: 1, total_paise: 1 },
      { menu_item_id: ITEM.tea, quantity: 1, price_paise: 0 },
    ]);
    expect(r.created).toBe(true);
    expect(r.total_paise).toBe(2 * 5000 + 1000);
    const items = await rows<{ unit_price_paise: number }>(db, "select unit_price_paise from order_items where order_id=$1 order by unit_price_paise", [r.order_id]);
    expect(items.map((i) => i.unit_price_paise)).toEqual([1000, 5000]);
    const preview = await one<{ p: { total_paise: number } }>(db, "select preview_cart($1, $2::jsonb) as p", [
      CANTEEN, JSON.stringify([{ menu_item_id: ITEM.tea, quantity: 3, price_paise: 1 }]),
    ]);
    expect(preview.p.total_paise).toBe(3000);
  });

  it("creates the order PENDING_PAYMENT with no token and reserves stock", async () => {
    const before = await stockOf(db, ITEM.samosa);
    const r = await placeOrder(db, STUDENT1, [{ menu_item_id: ITEM.samosa, quantity: 3 }]);
    const o = await one<{ status: string; token_number: number | null }>(db, "select status, token_number from orders where id=$1", [r.order_id]);
    expect(o).toEqual({ status: "PENDING_PAYMENT", token_number: null });
    expect(await stockOf(db, ITEM.samosa)).toBe(before - 3);
  });

  it("requires an entrance check-in, verified on the server", async () => {
    await expectDbError(placeOrder(db, STUDENT2, [{ menu_item_id: ITEM.tea, quantity: 1 }]), "NO_CHECKIN");
  });

  it("rejects an expired check-in at the time of ordering", async () => {
    await setNow(db, "2026-01-05T06:10:30Z"); // check-in lasted 10 min
    await expectDbError(placeOrder(db, STUDENT1, [{ menu_item_id: ITEM.tea, quantity: 1 }]), "NO_CHECKIN");
  });

  it("two students buying the last item at the same time: only one succeeds", async () => {
    await checkIn(db, STUDENT2);
    await db.query("update menu_items set stock_count = 1 where id = $1", [ITEM.masalaDosa]);
    const results = await Promise.allSettled([
      placeOrder(db, STUDENT1, [{ menu_item_id: ITEM.masalaDosa, quantity: 1 }]),
      placeOrder(db, STUDENT2, [{ menu_item_id: ITEM.masalaDosa, quantity: 1 }]),
    ]);
    const ok = results.filter((r) => r.status === "fulfilled");
    const failed = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];
    expect(ok).toHaveLength(1);
    expect(failed).toHaveLength(1);
    expect((failed[0].reason as Error).message).toBe("SOLD_OUT");
    expect(await stockOf(db, ITEM.masalaDosa)).toBe(0);
    // sold out -> removed from the live menu
    const live = await rows<{ id: string }>(db, "select id from live_menu($1)", [CANTEEN]);
    expect(live.some((i) => i.id === ITEM.masalaDosa)).toBe(false);
  });

  it("an item sold out since it was added to the cart fails the whole order and reserves nothing", async () => {
    await db.query("update menu_items set stock_count = 1 where id = $1", [ITEM.idli]);
    const teaBefore = await stockOf(db, ITEM.tea);
    const err = await expectDbError(
      placeOrder(db, STUDENT1, [
        { menu_item_id: ITEM.tea, quantity: 2 },
        { menu_item_id: ITEM.idli, quantity: 2 },
      ]),
      "SOLD_OUT",
    );
    expect(err.detail).toBe("Idli (2 pcs)");
    expect(await stockOf(db, ITEM.tea)).toBe(teaBefore);
    expect(await stockOf(db, ITEM.idli)).toBe(1);
    expect((await rows(db, "select 1 from orders")).length).toBe(0);
  });

  it("double-clicking Pay (same client_request_id) creates a single order", async () => {
    const req = randomUUID();
    const before = await stockOf(db, ITEM.vada);
    const a = await placeOrder(db, STUDENT1, [{ menu_item_id: ITEM.vada, quantity: 2 }], req);
    const b = await placeOrder(db, STUDENT1, [{ menu_item_id: ITEM.vada, quantity: 2 }], req);
    expect(b.order_id).toBe(a.order_id);
    expect(b.created).toBe(false);
    expect(await stockOf(db, ITEM.vada)).toBe(before - 2);
  });
});

describe("payments, token and bill", () => {
  it("creates the token only when payment is confirmed", async () => {
    const r = await placeOrder(db, STUDENT1, [{ menu_item_id: ITEM.masalaDosa, quantity: 1 }, { menu_item_id: ITEM.juice, quantity: 1 }]);
    const gid = await startAttempt(db, r.order_id, STUDENT1);
    const res = await confirm(db, gid, "pay_1", r.total_paise);
    expect(res.result).toBe("confirmed");
    expect(res.status).toBe("PAID");
    expect(res.token_number).toBe(1);
    // ready_made juice is ready instantly, the dosa is not
    const items = await rows<{ name_snapshot: string; status: string }>(db, "select name_snapshot, status from order_items where order_id=$1 order by name_snapshot", [r.order_id]);
    expect(items).toEqual([
      { name_snapshot: "Juice", status: "ready" },
      { name_snapshot: "Masala dosa", status: "pending" },
    ]);
  });

  it("an order of only ready_made items becomes READY at once", async () => {
    const r = await placeOrder(db, STUDENT1, [{ menu_item_id: ITEM.vegPuff, quantity: 2 }, { menu_item_id: ITEM.biscuit, quantity: 1 }]);
    const gid = await startAttempt(db, r.order_id, STUDENT1);
    const res = await confirm(db, gid, "pay_rm", r.total_paise);
    expect(res.status).toBe("READY");
    const ev = await rows<{ event: string }>(db, "select event from order_events where order_id=$1 and event in ('paid','ready') order by id", [r.order_id]);
    expect(ev.map((e) => e.event)).toEqual(["paid", "ready"]);
  });

  it("webhook delivered twice is processed once", async () => {
    const r = await placeOrder(db, STUDENT1, [{ menu_item_id: ITEM.tea, quantity: 1 }]);
    const gid = await startAttempt(db, r.order_id, STUDENT1);
    const first = await confirm(db, gid, "pay_dup", r.total_paise);
    const second = await confirm(db, gid, "pay_dup", r.total_paise);
    expect(first.result).toBe("confirmed");
    expect(second.result).toBe("duplicate");
    const paid = await rows(db, "select 1 from order_events where order_id=$1 and event='paid'", [r.order_id]);
    expect(paid).toHaveLength(1);
    const pays = await rows(db, "select 1 from payments where gateway_payment_id='pay_dup'");
    expect(pays).toHaveLength(1);
  });

  it("allows at most 2 retries; the third failure ends the order and releases stock", async () => {
    const before = await stockOf(db, ITEM.samosa);
    const r = await placeOrder(db, STUDENT1, [{ menu_item_id: ITEM.samosa, quantity: 4 }]);
    expect(await stockOf(db, ITEM.samosa)).toBe(before - 4);

    let res = await fail(db, await startAttempt(db, r.order_id, STUDENT1));
    expect(res).toMatchObject({ status: "PENDING_PAYMENT", attempts_left: 2 });
    res = await fail(db, await startAttempt(db, r.order_id, STUDENT1));
    expect(res).toMatchObject({ status: "PENDING_PAYMENT", attempts_left: 1 });
    res = await fail(db, await startAttempt(db, r.order_id, STUDENT1));
    expect(res).toMatchObject({ status: "PAYMENT_FAILED", attempts_left: 0 });

    expect(await stockOf(db, ITEM.samosa)).toBe(before);
    const o = await one<{ token_number: number | null }>(db, "select token_number from orders where id=$1", [r.order_id]);
    expect(o.token_number).toBeNull();
    await expectDbError(startAttempt(db, r.order_id, STUDENT1), "NOT_PENDING");
  });

  it("refuses a 4th attempt while the order is still pending", async () => {
    const r = await placeOrder(db, STUDENT1, [{ menu_item_id: ITEM.tea, quantity: 1 }]);
    await startAttempt(db, r.order_id, STUDENT1);
    await startAttempt(db, r.order_id, STUDENT1);
    await startAttempt(db, r.order_id, STUDENT1);
    await expectDbError(startAttempt(db, r.order_id, STUDENT1), "RETRY_LIMIT");
  });

  it("a payment that succeeds after the order failed creates no token and is logged", async () => {
    const r = await placeOrder(db, STUDENT1, [{ menu_item_id: ITEM.tea, quantity: 1 }]);
    const g1 = await startAttempt(db, r.order_id, STUDENT1);
    const g2 = await startAttempt(db, r.order_id, STUDENT1);
    const g3 = await startAttempt(db, r.order_id, STUDENT1);
    await fail(db, g1);
    await fail(db, g2);
    await fail(db, g3);
    const late = await confirm(db, g3, "pay_late", r.total_paise);
    expect(late.result).toBe("late");
    const o = await one<{ status: string; token_number: number | null }>(db, "select status, token_number from orders where id=$1", [r.order_id]);
    expect(o).toEqual({ status: "PAYMENT_FAILED", token_number: null });
    const logged = await rows(db, "select 1 from order_events where order_id=$1 and event='late_payment_ignored'", [r.order_id]);
    expect(logged).toHaveLength(1);
  });

  it("a payment for the wrong amount does not confirm the order", async () => {
    const r = await placeOrder(db, STUDENT1, [{ menu_item_id: ITEM.tea, quantity: 1 }]);
    const gid = await startAttempt(db, r.order_id, STUDENT1);
    const res = await confirm(db, gid, "pay_x", 1);
    expect(res.result).toBe("amount_mismatch");
    const o = await one<{ status: string }>(db, "select status from orders where id=$1", [r.order_id]);
    expect(o.status).toBe("PENDING_PAYMENT");
  });
});
