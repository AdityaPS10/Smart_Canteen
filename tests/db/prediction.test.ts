import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { CANTEEN, ITEM, STUDENT1, STUDENT2, checkIn, confirm, freshDb, one, placeOrder, rows, setNow, startAttempt } from "../helpers/pg";

let db: PGlite;
beforeAll(async () => {
  db = await freshDb({ withSampleHistory: true });
  await setNow(db, "2026-01-05T06:31:00Z"); // 12:01 IST
  await checkIn(db, STUDENT1);
  await checkIn(db, STUDENT2);
});

async function paid(student: string, items: Array<{ menu_item_id: string; quantity: number }>) {
  const r = await placeOrder(db, student, items);
  await confirm(db, await startAttempt(db, r.order_id, student), `pay_${r.order_id}`, r.total_paise);
  return r.order_id;
}

describe("prediction data", () => {
  it("seeds a few hundred sample rows, all marked is_sample", async () => {
    const r = await rows<{ is_sample: boolean }>(db, "select * from ml_training_rows(5000) as t(x)");
    expect(r.length).toBe(300);
    const s = await one<{ n: number }>(db, "select count(*)::int n from order_events where is_sample");
    expect(s.n).toBe(900);
    const bad = await one<{ n: number }>(db, "select count(*)::int n from ml_training_rows(5000) r where (r->>'is_sample')::boolean is not true");
    expect(bad.n).toBe(0);
  });

  it("snapshots features at payment: queue ahead, items, longest prep (ready-made = 0)", async () => {
    await paid(STUDENT1, [{ menu_item_id: ITEM.masalaDosa, quantity: 3 }]); // 3 units x 6 min ahead
    const b = await paid(STUDENT2, [{ menu_item_id: ITEM.idli, quantity: 1 }, { menu_item_id: ITEM.juice, quantity: 2 }]);
    const f = await one<{ f: Record<string, number | boolean> }>(db, "select prediction_features($1) as f", [b]);
    expect(f.f).toMatchObject({
      hour: 12,
      units_ahead: 3,
      prep_minutes_ahead: 18,
      items_count: 3,
      max_prep_minutes: 4,
      all_ready_made: false,
      kitchen_staff_count: 2,
      ml_min_samples: 50,
    });
    expect(Number(f.f.window_remaining_minutes)).toBe(4); // window 12:00-12:05, now 12:01
  });

  it("stores the estimate on the order and turns completed orders into training rows", async () => {
    const id = await paid(STUDENT1, [{ menu_item_id: ITEM.tea, quantity: 1 }]);
    await db.query("select set_order_estimate($1, 7, 'formula')", [id]);
    const o = await one<{ estimated_minutes: number; estimate_source: string }>(db, "select estimated_minutes, estimate_source from orders where id=$1", [id]);
    expect(o).toEqual({ estimated_minutes: 7, estimate_source: "formula" });

    await setNow(db, "2026-01-05T06:35:00Z");
    const ids = (await rows<{ id: string }>(db, "select id from order_items where order_id=$1", [id])).map((x) => x.id);
    await db.query("select mark_batch_ready($1, $2)", [CANTEEN, ids]);
    const real = await rows<{ x: { minutes: string; is_sample: boolean } }>(
      db, "select x from ml_training_rows(5000) x where (x->>'is_sample')::boolean = false");
    expect(real).toHaveLength(1);
    expect(Number(real[0].x.minutes)).toBe(4);
  });

  it("the tick says when a retrain is due", async () => {
    await db.query("update settings set value='1' where key='ml_retrain_every_orders'");
    const t = await one<{ t: { completed_orders: number; retrain_due: boolean } }>(db, "select process_tick() as t");
    expect(t.t).toMatchObject({ completed_orders: 1, retrain_due: true });
    await db.query("select mark_ml_trained(1)");
    const t2 = await one<{ t: { retrain_due: boolean } }>(db, "select process_tick() as t");
    expect(t2.t.retrain_due).toBe(false);
  });
});
