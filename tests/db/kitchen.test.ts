import { beforeEach, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import {
  CANTEEN, ITEM, STUDENT1, STUDENT2, checkIn, confirm, expectDbError, freshDb, one, placeOrder, rows, setNow,
  startAttempt,
} from "../helpers/pg";

let db: PGlite;
beforeEach(async () => {
  db = await freshDb();
  await setNow(db, "2026-01-05T04:30:00Z");
  await checkIn(db, STUDENT1);
  await checkIn(db, STUDENT2);
});

async function paidOrder(student: string, items: Array<{ menu_item_id: string; quantity: number }>) {
  const r = await placeOrder(db, student, items);
  const gid = await startAttempt(db, r.order_id, student);
  await confirm(db, gid, `pay_${r.order_id}`, r.total_paise);
  return r.order_id;
}

const status = async (id: string) => (await one<{ status: string }>(db, "select status from orders where id=$1", [id])).status;
const itemIds = async (orderIds: string[], menuItemId: string) =>
  (await rows<{ id: string }>(db, "select id from order_items where order_id = any($1) and menu_item_id=$2", [orderIds, menuItemId])).map((r) => r.id);

describe("kitchen actions", () => {
  it("lists only items still to cook (ready_made never appears)", async () => {
    await paidOrder(STUDENT1, [{ menu_item_id: ITEM.masalaDosa, quantity: 1 }, { menu_item_id: ITEM.juice, quantity: 1 }]);
    const k = await rows<{ name: string }>(db, "select * from kitchen_items($1)", [CANTEEN]);
    expect(k.map((r) => r.name)).toEqual(["Masala dosa"]);
  });

  it("start cooking makes orders PREPARING; mark ready makes each order READY only when all its items are ready", async () => {
    const a = await paidOrder(STUDENT1, [{ menu_item_id: ITEM.masalaDosa, quantity: 2 }]);
    const b = await paidOrder(STUDENT2, [{ menu_item_id: ITEM.masalaDosa, quantity: 1 }, { menu_item_id: ITEM.tea, quantity: 1 }]);
    const dosaItems = await itemIds([a, b], ITEM.masalaDosa);

    await db.query("select start_batch($1, $2)", [CANTEEN, dosaItems]);
    expect(await status(a)).toBe("PREPARING");
    expect(await status(b)).toBe("PREPARING");

    const r = await one<{ r: { ready_order_ids: string[] } }>(db, "select mark_batch_ready($1, $2) as r", [CANTEEN, dosaItems]);
    expect(r.r.ready_order_ids).toEqual([a]);
    expect(await status(a)).toBe("READY");
    expect(await status(b)).toBe("PREPARING"); // tea still pending: orders are never merged

    await db.query("select mark_batch_ready($1, $2)", [CANTEEN, await itemIds([b], ITEM.tea)]);
    expect(await status(b)).toBe("READY");
    const o = await one<{ ready_at: string | null }>(db, "select ready_at from orders where id=$1", [b]);
    expect(o.ready_at).not.toBeNull();
  });

  it("mark ready without starting goes PAID -> PREPARING -> READY", async () => {
    const a = await paidOrder(STUDENT1, [{ menu_item_id: ITEM.tea, quantity: 1 }]);
    await db.query("select mark_batch_ready($1, $2)", [CANTEEN, await itemIds([a], ITEM.tea)]);
    const ev = await rows<{ event: string }>(db, "select event from order_events where order_id=$1 and event in ('paid','preparing','ready') order by id", [a]);
    expect(ev.map((e) => e.event)).toEqual(["paid", "preparing", "ready"]);
  });

  it("the food server can mark an order Given only when READY", async () => {
    const a = await paidOrder(STUDENT1, [{ menu_item_id: ITEM.tea, quantity: 1 }]);
    await expectDbError(db.query("select mark_given($1, $2)", [CANTEEN, a]), "ILLEGAL_TRANSITION");
    await db.query("select mark_batch_ready($1, $2)", [CANTEEN, await itemIds([a], ITEM.tea)]);
    await db.query("select mark_given($1, $2)", [CANTEEN, a]);
    expect(await status(a)).toBe("GIVEN");
    await expectDbError(db.query("select mark_given($1, $2)", [CANTEEN, a]), "ILLEGAL_TRANSITION");
  });

  it("TV board and counter show tokens in queue and ready", async () => {
    const a = await paidOrder(STUDENT1, [{ menu_item_id: ITEM.tea, quantity: 1 }]);
    await paidOrder(STUDENT2, [{ menu_item_id: ITEM.vegPuff, quantity: 1 }]); // ready_made -> READY at once
    const board = await one<{ b: { in_queue: number[]; ready: number[] } }>(db, "select tv_board($1) as b", [CANTEEN]);
    expect(board.b).toEqual({ in_queue: [1], ready: [2] });
    const counter = await one<{ c: Array<{ id: string; status: string }> }>(db, "select counter_orders($1) as c", [CANTEEN]);
    expect(counter.c.map((o) => o.status)).toEqual(["READY", "PAID"]);
    expect(counter.c[1].id).toBe(a);
  });
});
