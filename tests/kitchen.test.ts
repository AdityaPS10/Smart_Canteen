import { describe, expect, it } from "vitest";
import { groupIntoBatches, kitchenQueue, prioritizeBatches, windowStartMs, type KitchenItem } from "@/lib/kitchen";

const DOSA = "dosa-id";
const TEA = "tea-id";
let n = 0;

function item(menuItemId: string, paidAt: string, opts: Partial<KitchenItem> = {}): KitchenItem {
  n++;
  return {
    order_item_id: `oi-${n}`,
    order_id: `o-${n}`,
    token_number: n,
    menu_item_id: menuItemId,
    name: menuItemId === DOSA ? "Masala dosa" : "Tea",
    quantity: 1,
    status: "pending",
    ready_made: false,
    prep_minutes: 6,
    paid_at: paidAt,
    ...opts,
  };
}

// 10:00 IST = 04:30 UTC
describe("kitchen grouping", () => {
  it("aligns windows to the Asia/Kolkata clock", () => {
    const at = Date.parse("2026-01-05T04:33:20Z"); // 10:03:20 IST
    expect(new Date(windowStartMs(at, 5)).toISOString()).toBe("2026-01-05T04:30:00.000Z"); // 10:00 IST
    // a 7-minute window still lines up with IST midnight
    const s = windowStartMs(at, 7);
    expect(((s + 330 * 60_000) / 60_000) % 7).toBe(0);
  });

  it("5 dosas from different students in one window make ONE batch of 5", () => {
    const items = ["04:30:05", "04:31:00", "04:32:10", "04:33:59", "04:34:59"].map((t) =>
      item(DOSA, `2026-01-05T${t}Z`),
    );
    const batches = groupIntoBatches(items, 5);
    expect(batches).toHaveLength(1);
    expect(batches[0].total_quantity).toBe(5);
    expect(batches[0].tokens).toHaveLength(5);
    expect(batches[0].order_ids).toHaveLength(5); // orders are never merged
  });

  it("a dosa paid after the window closes starts a NEW batch, even if it is a single dosa", () => {
    const items = [
      ...["04:30:05", "04:31:00", "04:32:10", "04:33:59", "04:34:59"].map((t) => item(DOSA, `2026-01-05T${t}Z`)),
      item(DOSA, "2026-01-05T04:35:00Z"),
    ];
    const batches = kitchenQueue(items, 5);
    expect(batches).toHaveLength(2);
    expect(batches.map((b) => b.total_quantity)).toEqual([5, 1]); // oldest window first
  });

  it("adds up quantities and keeps different items apart", () => {
    const items = [
      item(DOSA, "2026-01-05T04:30:05Z", { quantity: 2 }),
      item(DOSA, "2026-01-05T04:31:05Z", { quantity: 3 }),
      item(TEA, "2026-01-05T04:31:10Z", { quantity: 4 }),
    ];
    const batches = groupIntoBatches(items, 5);
    expect(batches.map((b) => [b.name, b.total_quantity]).sort()).toEqual([
      ["Masala dosa", 5],
      ["Tea", 4],
    ]);
  });

  it("keeps items already cooking separate from new pending ones in the same window", () => {
    const items = [
      item(DOSA, "2026-01-05T04:30:05Z", { status: "preparing" }),
      item(DOSA, "2026-01-05T04:31:05Z"),
    ];
    expect(groupIntoBatches(items, 5)).toHaveLength(2);
  });
});

describe("priority", () => {
  it("orders batches oldest window first, ready_made first", () => {
    const later = item(TEA, "2026-01-05T04:41:00Z");
    const older = item(DOSA, "2026-01-05T04:30:30Z");
    const rm = item("puff", "2026-01-05T04:44:00Z", { ready_made: true, prep_minutes: 0, name: "Veg puff" });
    const q = prioritizeBatches(groupIntoBatches([later, older, rm], 5));
    expect(q.map((b) => b.name)).toEqual(["Veg puff", "Masala dosa", "Tea"]);
  });
});
