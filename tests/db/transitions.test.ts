import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { ITEM, expectDbError, freshDb, insertOrder, one, rows } from "../helpers/pg";

let db: PGlite;
beforeAll(async () => {
  db = await freshDb();
});

const to = (id: string, status: string) =>
  one<{ status: string; token_number: number | null }>(
    db,
    "select status, token_number from transition_order($1, $2)",
    [id, status],
  );

describe("order status transitions", () => {
  it("follows the allowed path PENDING_PAYMENT -> PAID -> PREPARING -> READY -> GIVEN", async () => {
    const id = await insertOrder(db, [{ menuItemId: ITEM.masalaDosa, quantity: 1 }]);
    const paid = await to(id, "PAID");
    expect(paid.status).toBe("PAID");
    expect(paid.token_number).toBeGreaterThan(0);
    expect((await to(id, "PREPARING")).status).toBe("PREPARING");
    expect((await to(id, "READY")).status).toBe("READY");
    expect((await to(id, "GIVEN")).status).toBe("GIVEN");

    const events = await rows<{ event: string }>(db, "select event from order_events where order_id=$1 order by id", [id]);
    expect(events.map((e) => e.event)).toEqual(["paid", "preparing", "ready", "given"]);
    const o = await one<Record<string, string | null>>(db, "select * from orders where id=$1", [id]);
    expect(o.paid_at && o.ready_at && o.given_at).toBeTruthy();
  });

  it("allows READY -> EXPIRED and PENDING_PAYMENT -> PAYMENT_FAILED", async () => {
    const a = await insertOrder(db, [{ menuItemId: ITEM.vegPuff, quantity: 1 }]);
    await to(a, "PAID");
    await to(a, "READY"); // all ready_made
    expect((await to(a, "EXPIRED")).status).toBe("EXPIRED");

    const b = await insertOrder(db, [{ menuItemId: ITEM.tea, quantity: 1 }]);
    const failed = await to(b, "PAYMENT_FAILED");
    expect(failed.status).toBe("PAYMENT_FAILED");
    expect(failed.token_number).toBeNull();
  });

  it("rejects illegal transitions", async () => {
    const id = await insertOrder(db, [{ menuItemId: ITEM.tea, quantity: 1 }]);
    await expectDbError(to(id, "READY"), "ILLEGAL_TRANSITION"); // unpaid -> ready
    await expectDbError(to(id, "GIVEN"), "ILLEGAL_TRANSITION");
    await expectDbError(to(id, "PREPARING"), "ILLEGAL_TRANSITION");
    await to(id, "PAID");
    await expectDbError(to(id, "PAID"), "ILLEGAL_TRANSITION"); // twice
    await expectDbError(to(id, "READY"), "ILLEGAL_TRANSITION"); // PAID->READY needs all ready_made
    await expectDbError(to(id, "GIVEN"), "ILLEGAL_TRANSITION");
    await expectDbError(to(id, "PAYMENT_FAILED"), "ILLEGAL_TRANSITION");
    await to(id, "PREPARING");
    await expectDbError(to(id, "EXPIRED"), "ILLEGAL_TRANSITION");
    await to(id, "READY");
    await to(id, "GIVEN");
    await expectDbError(to(id, "EXPIRED"), "ILLEGAL_TRANSITION"); // terminal
    await expectDbError(to(id, "BOGUS"), "ILLEGAL_TRANSITION");
  });

  it("never gives an unpaid order a token (check constraint)", async () => {
    const id = await insertOrder(db, [{ menuItemId: ITEM.tea, quantity: 1 }]);
    await expect(db.query("update orders set token_number = 99 where id = $1", [id])).rejects.toThrow();
  });

  it("assigns token numbers sequentially per canteen per day", async () => {
    const a = await insertOrder(db, [{ menuItemId: ITEM.tea, quantity: 1 }]);
    const b = await insertOrder(db, [{ menuItemId: ITEM.tea, quantity: 1 }]);
    const ta = (await to(a, "PAID")).token_number!;
    const tb = (await to(b, "PAID")).token_number!;
    expect(tb).toBe(ta + 1);
  });
});
