import { describe, expect, it } from "vitest";
import { formatPaise, parseRupeesToPaise } from "@/lib/utils";
import { cartSchema, normalizeCart } from "@/lib/schemas";

describe("money", () => {
  it("parses rupees into integer paise", () => {
    expect(parseRupeesToPaise("12")).toBe(1200);
    expect(parseRupeesToPaise("12.5")).toBe(1250);
    expect(parseRupeesToPaise("0.07")).toBe(7);
    expect(parseRupeesToPaise("12.345")).toBeNull();
    expect(parseRupeesToPaise("-1")).toBeNull();
    expect(parseRupeesToPaise("abc")).toBeNull();
  });

  it("formats paise", () => {
    expect(formatPaise(1500)).toBe("₹15");
    expect(formatPaise(1250)).toBe("₹12.50");
  });
});

describe("cart validation", () => {
  it("strips any client price and merges duplicate lines", () => {
    const id = "00000000-0000-4000-8000-000000001001";
    const parsed = cartSchema.parse([
      { menu_item_id: id, quantity: 2, price_paise: 1 },
      { menu_item_id: id, quantity: 1, unit_price_paise: 1 },
    ]);
    expect(parsed[0]).not.toHaveProperty("price_paise");
    expect(normalizeCart(parsed)).toEqual([{ menu_item_id: id, quantity: 3 }]);
  });

  it("rejects bad quantities and empty carts", () => {
    const id = "00000000-0000-4000-8000-000000001001";
    expect(() => cartSchema.parse([])).toThrow();
    expect(() => cartSchema.parse([{ menu_item_id: id, quantity: 0 }])).toThrow();
    expect(() => cartSchema.parse([{ menu_item_id: id, quantity: 1.5 }])).toThrow();
    expect(() => cartSchema.parse([{ menu_item_id: "x", quantity: 1 }])).toThrow();
  });
});
