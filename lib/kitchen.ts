// Kitchen grouping and priority (spec section 8). Pure functions so they can be tested and swapped.

export interface KitchenItem {
  order_item_id: string;
  order_id: string;
  token_number: number;
  menu_item_id: string;
  name: string;
  quantity: number;
  status: "pending" | "preparing";
  ready_made: boolean;
  prep_minutes: number;
  paid_at: string;
}

export interface Batch {
  key: string;
  menu_item_id: string;
  name: string;
  status: "pending" | "preparing";
  ready_made: boolean;
  prep_minutes: number;
  window_start: string;
  window_end: string;
  total_quantity: number;
  tokens: number[];
  order_ids: string[];
  order_item_ids: string[];
  oldest_paid_at: string;
}

const IST_OFFSET_MS = (5 * 60 + 30) * 60_000;

/** Start of the grouping window containing `at`, aligned to the Asia/Kolkata clock (e.g. 10:00, 10:05 ...). */
export function windowStartMs(atMs: number, windowMinutes: number): number {
  const w = Math.max(1, windowMinutes) * 60_000;
  return Math.floor((atMs + IST_OFFSET_MS) / w) * w - IST_OFFSET_MS;
}

/**
 * Groups order items by menu item within grouping windows (by the order's paid_at).
 * Items that are already cooking form their own row, so "Start cooking" never touches them twice.
 * Batching is a view only: each order keeps its own items and status.
 */
export function groupIntoBatches(items: KitchenItem[], windowMinutes: number): Batch[] {
  const map = new Map<string, Batch>();
  for (const it of items) {
    const paidMs = Date.parse(it.paid_at);
    const start = windowStartMs(paidMs, windowMinutes);
    const key = `${it.menu_item_id}|${start}|${it.status}`;
    let b = map.get(key);
    if (!b) {
      b = {
        key,
        menu_item_id: it.menu_item_id,
        name: it.name,
        status: it.status,
        ready_made: it.ready_made,
        prep_minutes: it.prep_minutes,
        window_start: new Date(start).toISOString(),
        window_end: new Date(start + windowMinutes * 60_000).toISOString(),
        total_quantity: 0,
        tokens: [],
        order_ids: [],
        order_item_ids: [],
        oldest_paid_at: it.paid_at,
      };
      map.set(key, b);
    }
    b.total_quantity += it.quantity;
    if (!b.tokens.includes(it.token_number)) b.tokens.push(it.token_number);
    if (!b.order_ids.includes(it.order_id)) b.order_ids.push(it.order_id);
    b.order_item_ids.push(it.order_item_id);
    if (paidMs < Date.parse(b.oldest_paid_at)) b.oldest_paid_at = it.paid_at;
  }
  for (const b of map.values()) b.tokens.sort((x, y) => x - y);
  return [...map.values()];
}

/**
 * Priority scheduling, isolated so the policy can be changed in one place.
 * - ready_made items are handed over instantly (normally they are already ready at payment, so they
 *   never show up as cooking work; if one does, it goes first).
 * - other batches: oldest window first, then the longest-waiting order, then name.
 */
export function prioritizeBatches(batches: Batch[]): Batch[] {
  return [...batches].sort((a, b) => {
    if (a.ready_made !== b.ready_made) return a.ready_made ? -1 : 1;
    const w = Date.parse(a.window_start) - Date.parse(b.window_start);
    if (w !== 0) return w;
    const o = Date.parse(a.oldest_paid_at) - Date.parse(b.oldest_paid_at);
    if (o !== 0) return o;
    return a.name.localeCompare(b.name);
  });
}

export function kitchenQueue(items: KitchenItem[], windowMinutes: number): Batch[] {
  return prioritizeBatches(groupIntoBatches(items, windowMinutes));
}
