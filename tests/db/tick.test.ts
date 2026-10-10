import { beforeEach, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import {
  CANTEEN, ITEM, STUDENT1, checkIn, confirm, freshDb, one, placeOrder, rows, setNow, startAttempt, stockOf,
} from "../helpers/pg";

let db: PGlite;
const at = (hhmmss: string) => `2026-01-05T06:${hhmmss}Z`;

beforeEach(async () => {
  db = await freshDb();
  await setNow(db, at("00:00"));
  await checkIn(db, STUDENT1);
});

type Tick = { payment_timeouts: string[]; expired: string[]; extended: number; spare_pool: number; wasted: number };
const tick = async () => (await one<{ t: Tick }>(db, "select process_tick() as t")).t;
const status = async (id: string) => (await one<{ status: string }>(db, "select status from orders where id=$1", [id])).status;

/** A READY order at 06:00 with Samosa x2 (holds well) and Masala dosa x1 (does not). */
async function readyOrder() {
  const r = await placeOrder(db, STUDENT1, [
    { menu_item_id: ITEM.samosa, quantity: 2 },
    { menu_item_id: ITEM.masalaDosa, quantity: 1 },
  ]);
  await confirm(db, await startAttempt(db, r.order_id, STUDENT1), `pay_${r.order_id}`, r.total_paise);
  const ids = (await rows<{ id: string }>(db, "select id from order_items where order_id=$1", [r.order_id])).map((x) => x.id);
  await db.query("select mark_batch_ready($1, $2)", [CANTEEN, ids]);
  expect(await status(r.order_id)).toBe("READY");
  return r.order_id;
}

describe("the 10-minute rule", () => {
  it("expires an uncollected order, waits, then sends holds-well items to the spare pool and the rest to waste", async () => {
    const id = await readyOrder();

    await setNow(db, at("09:59"));
    expect((await tick()).expired).toEqual([]);
    expect(await status(id)).toBe("READY");

    await setNow(db, at("10:00")); // arrival window passed
    expect((await tick()).expired).toEqual([id]);
    expect(await status(id)).toBe("EXPIRED");

    await setNow(db, at("19:59")); // still in "wait 10 minutes"
    let t = await tick();
    expect([t.wasted, t.spare_pool, t.extended]).toEqual([0, 0, 0]);

    await setNow(db, at("20:00")); // holds well? NO -> wasted; YES -> wait some more
    t = await tick();
    expect([t.wasted, t.spare_pool, t.extended]).toEqual([1, 0, 1]);
    const wasted = await rows<{ quantity: number; value_paise: number }>(db, "select quantity, value_paise from wasted_items");
    expect(wasted).toEqual([{ quantity: 1, value_paise: 5000 }]);

    await setNow(db, at("24:59"));
    expect((await tick()).spare_pool).toBe(0);

    await setNow(db, at("25:00")); // extra 5 minutes done -> spare pool
    expect((await tick()).spare_pool).toBe(1);
    const pool = await rows<{ name: string; quantity: string }>(db, "select name, quantity from spare_pool_summary($1)", [CANTEEN]);
    expect(pool.map((p) => [p.name, Number(p.quantity)])).toEqual([["Samosa", 2]]);

    const items = await rows<{ name_snapshot: string; disposition: string }>(
      db, "select name_snapshot, disposition from order_items where order_id=$1 order by name_snapshot", [id]);
    expect(items).toEqual([
      { name_snapshot: "Masala dosa", disposition: "wasted" },
      { name_snapshot: "Samosa", disposition: "spare_pool" },
    ]);
  });

  it("does not expire an order that was given in time", async () => {
    const id = await readyOrder();
    await setNow(db, at("05:00"));
    await db.query("select mark_given($1, $2)", [CANTEEN, id]);
    await setNow(db, at("30:00"));
    await tick();
    expect(await status(id)).toBe("GIVEN");
    expect(await rows(db, "select 1 from wasted_items")).toHaveLength(0);
  });

  it("broadcasts from SQL via realtime.send() when it exists (pg_cron path), with no personal data", async () => {
    await db.exec(`
      create schema if not exists realtime;
      create table realtime.sent (topic text, event text, payload jsonb);
      create function realtime.send(payload jsonb, event text, topic text, private boolean) returns void
        language sql as $$ insert into realtime.sent values (topic, event, payload) $$;`);
    const id = await readyOrder();
    await setNow(db, at("10:00"));
    await tick();
    const sent = await rows<{ topic: string; event: string; payload: Record<string, unknown> }>(db, "select * from realtime.sent order by topic, event");
    expect(sent.map((s) => `${s.topic} ${s.event}`)).toEqual([
      `canteen:${CANTEEN} menu_changed`,
      `canteen:${CANTEEN} orders_changed`,
      `order:${id} order_changed`,
    ]);
    expect(sent[2].payload).toEqual({ status: "EXPIRED" });
  });

  it("is idempotent: running twice at the same time changes nothing more", async () => {
    await readyOrder();
    await setNow(db, at("10:00"));
    await tick();
    expect((await tick()).expired).toEqual([]);
    await setNow(db, at("30:00"));
    await tick(); // waste + extend
    await tick(); // spare pool (extra wait already over at 30:00)
    const again = await tick();
    expect([again.wasted, again.spare_pool, again.extended]).toEqual([0, 0, 0]);
    expect(await rows(db, "select 1 from wasted_items")).toHaveLength(1);
    expect(await rows(db, "select 1 from spare_pool")).toHaveLength(1);
  });
});

describe("payment timeout", () => {
  it("fails an unpaid order after payment_timeout_minutes and releases stock; a late success gets no token", async () => {
    const before = await stockOf(db, ITEM.vada);
    const r = await placeOrder(db, STUDENT1, [{ menu_item_id: ITEM.vada, quantity: 3 }]);
    const gid = await startAttempt(db, r.order_id, STUDENT1);

    await setNow(db, at("02:59"));
    expect((await tick()).payment_timeouts).toEqual([]);
    await setNow(db, at("03:00"));
    expect((await tick()).payment_timeouts).toEqual([r.order_id]);
    expect(await status(r.order_id)).toBe("PAYMENT_FAILED");
    expect(await stockOf(db, ITEM.vada)).toBe(before);
    expect((await tick()).payment_timeouts).toEqual([]); // idempotent

    const late = await confirm(db, gid, "pay_late", r.total_paise);
    expect(late.result).toBe("late");
    const o = await one<{ token_number: number | null }>(db, "select token_number from orders where id=$1", [r.order_id]);
    expect(o.token_number).toBeNull();
  });
});
