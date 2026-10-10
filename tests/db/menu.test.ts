import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { CANTEEN, ITEM, expectDbError, freshDb, one, rows } from "../helpers/pg";

let db: PGlite;
beforeAll(async () => {
  db = await freshDb();
});

const live = () => rows<{ id: string; name: string }>(db, "select * from live_menu($1)", [CANTEEN]);

describe("menu and stock", () => {
  it("shows only active items with stock above 0", async () => {
    expect((await live()).some((i) => i.id === ITEM.samosa)).toBe(true);
    await db.query("select menu_update_item($1, $2, p_stock_count => 0)", [CANTEEN, ITEM.samosa]);
    expect((await live()).some((i) => i.id === ITEM.samosa)).toBe(false);
    await db.query("select menu_update_item($1, $2, p_stock_count => 5)", [CANTEEN, ITEM.samosa]);
    expect((await live()).some((i) => i.id === ITEM.samosa)).toBe(true);
    await db.query("select menu_update_item($1, $2, p_active => false)", [CANTEEN, ITEM.samosa]);
    expect((await live()).some((i) => i.id === ITEM.samosa)).toBe(false);
  });

  it("lets the cashier add a dish with a count and edit its price", async () => {
    const m = await one<{ id: string; prep_minutes: number }>(
      db,
      "select * from menu_add_item($1, 'Pav bhaji', 6000, 15, false, false, 7)",
      [CANTEEN],
    );
    expect(m.prep_minutes).toBe(7);
    expect((await live()).some((i) => i.id === m.id)).toBe(true);
    const u = await one<{ price_paise: number; stock_count: number }>(
      db,
      "select * from menu_update_item($1, $2, p_price_paise => 6500)",
      [CANTEEN, m.id],
    );
    expect(u).toMatchObject({ price_paise: 6500, stock_count: 15 });
    await expectDbError(db.query("select menu_add_item($1, 'pav bhaji', 100, 1, false, false, 1)", [CANTEEN]), "BAD_REQUEST");
  });

  it("rejects negative stock and edits for another canteen", async () => {
    await expect(db.query("select menu_update_item($1, $2, p_stock_count => -1)", [CANTEEN, ITEM.tea])).rejects.toThrow();
    await expectDbError(
      db.query("select menu_update_item($1, $2, p_price_paise => 1)", ["00000000-0000-4000-8000-0000000000ff", ITEM.tea]),
      "NOT_FOUND",
    );
  });
});
