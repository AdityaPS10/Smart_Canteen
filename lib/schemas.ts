import { z } from "zod";

/** A cart line. Anything else the browser sends (e.g. a price) is stripped and ignored. */
export const cartLineSchema = z.object({
  menu_item_id: z.uuid(),
  quantity: z.number().int().min(1).max(50),
});

export const cartSchema = z.array(cartLineSchema).min(1, "Your cart is empty.").max(30);

export const canteenIdSchema = z.uuid();

const name = z.string().trim().min(1).max(80);
const pricePaise = z.number().int().min(1).max(10_000_00);
const stock = z.number().int().min(0).max(100_000);
const prep = z.number().int().min(0).max(240);

export const menuCreateSchema = z.object({
  name,
  price_paise: pricePaise,
  stock_count: stock,
  ready_made: z.boolean().default(false),
  holds_well: z.boolean().default(false),
  prep_minutes: prep.default(0),
});

export const menuUpdateSchema = z.object({
  id: z.uuid(),
  name: name.optional(),
  price_paise: pricePaise.optional(),
  stock_count: stock.optional(),
  ready_made: z.boolean().optional(),
  holds_well: z.boolean().optional(),
  prep_minutes: prep.optional(),
  active: z.boolean().optional(),
});

/** Merges duplicate lines for the same item. */
export function normalizeCart(lines: z.infer<typeof cartSchema>) {
  const m = new Map<string, number>();
  for (const l of lines) m.set(l.menu_item_id, (m.get(l.menu_item_id) ?? 0) + l.quantity);
  return [...m.entries()].map(([menu_item_id, quantity]) => ({ menu_item_id, quantity }));
}
