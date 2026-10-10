import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import {
  CANTEEN, CASHIER, ITEM, SERVER, STUDENT1, checkIn, confirm, expectDbError, freshDb, one, placeOrder, rows, setNow,
  startAttempt, stockOf,
} from "../helpers/pg";

let db: PGlite;
beforeEach(async () => {
  db = await freshDb();
  await setNow(db, "2026-01-05T06:00:00Z");
});

const cash = async (items: unknown[], requestId: string = randomUUID(), cashier = CASHIER) =>
  (
    await one<{ r: { order_id: string; created: boolean; status: string; token_number: number } }>(
      db,
      "select cashier_create_order($1, $2, $3::jsonb, 'Walk-in', $4) as r",
      [CANTEEN, cashier, JSON.stringify(items), requestId],
    )
  ).r;

describe("cash counter", () => {
  it("creates the order PAID with a cash payment row and a token, no entrance QR needed", async () => {
    const before = await stockOf(db, ITEM.samosa);
    const r = await cash([{ menu_item_id: ITEM.samosa, quantity: 2, price_paise: 1 }]);
    expect(r.status).toBe("PAID");
    expect(r.token_number).toBe(1);
    expect(await stockOf(db, ITEM.samosa)).toBe(before - 2);
    const p = await one<{ method: string; status: string; amount_paise: number; cashier_id: string }>(
      db,
      "select method, status, amount_paise, cashier_id from payments where order_id=$1",
      [r.order_id],
    );
    expect(p).toEqual({ method: "cash", status: "success", amount_paise: 3000, cashier_id: CASHIER });
  });

  it("joins the same kitchen queue as app orders, in payment order", async () => {
    await checkIn(db, STUDENT1);
    const app = await placeOrder(db, STUDENT1, [{ menu_item_id: ITEM.masalaDosa, quantity: 1 }]);
    await confirm(db, await startAttempt(db, app.order_id, STUDENT1), "pay_a", app.total_paise);
    await setNow(db, "2026-01-05T06:00:30Z");
    const c = await cash([{ menu_item_id: ITEM.masalaDosa, quantity: 1 }]);
    const k = await rows<{ token_number: number }>(db, "select token_number from kitchen_items($1)", [CANTEEN]);
    expect(k.map((x) => x.token_number)).toEqual([1, c.token_number]);
    expect(c.token_number).toBe(2);
  });

  it("an item that just sold out fails the cash order and creates nothing", async () => {
    await db.query("update menu_items set stock_count = 0 where id = $1", [ITEM.vada]);
    await expectDbError(cash([{ menu_item_id: ITEM.tea, quantity: 1 }, { menu_item_id: ITEM.vada, quantity: 1 }]), "SOLD_OUT");
    expect(await rows(db, "select 1 from orders")).toHaveLength(0);
    expect(await rows(db, "select 1 from payments")).toHaveLength(0);
  });

  it("a repeated request creates one order", async () => {
    const id = randomUUID();
    const a = await cash([{ menu_item_id: ITEM.tea, quantity: 1 }], id);
    const b = await cash([{ menu_item_id: ITEM.tea, quantity: 1 }], id);
    expect(b.order_id).toBe(a.order_id);
    expect(b.created).toBe(false);
  });

  it("only a cashier of this canteen can create cash orders", async () => {
    await expectDbError(cash([{ menu_item_id: ITEM.tea, quantity: 1 }], randomUUID(), SERVER), "FORBIDDEN");
  });

  it("payments log lists today's cash payments with a running total", async () => {
    await cash([{ menu_item_id: ITEM.tea, quantity: 1 }]); // 1000
    await setNow(db, "2026-01-05T06:01:00Z");
    await cash([{ menu_item_id: ITEM.masalaDosa, quantity: 1 }]); // 5000
    const log = await one<{ l: { total_paise: number; payments: Array<{ token_number: number; running_total_paise: number; cashier: string }> } }>(
      db,
      "select cashier_payments($1) as l",
      [CANTEEN],
    );
    expect(log.l.total_paise).toBe(6000);
    expect(log.l.payments.map((p) => [p.token_number, Number(p.running_total_paise)])).toEqual([
      [2, 6000],
      [1, 1000],
    ]);
    expect(log.l.payments[0].cashier).toBe("Demo Cashier");
  });
});
