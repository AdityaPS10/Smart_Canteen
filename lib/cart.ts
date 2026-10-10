"use client";

import { useCallback, useEffect, useState } from "react";

// The cart lives in this browser only (per canteen). Only menu_item_id + quantity are ever sent.
export type Cart = Record<string, number>;

const key = (canteenId: string) => `cart:${canteenId}`;

export function readCart(canteenId: string): Cart {
  try {
    const raw = localStorage.getItem(key(canteenId));
    const parsed = raw ? JSON.parse(raw) : {};
    const out: Cart = {};
    for (const [id, q] of Object.entries(parsed)) {
      if (typeof q === "number" && Number.isInteger(q) && q > 0) out[id] = Math.min(q, 50);
    }
    return out;
  } catch {
    return {};
  }
}

export function writeCart(canteenId: string, cart: Cart) {
  try {
    if (Object.keys(cart).length === 0) localStorage.removeItem(key(canteenId));
    else localStorage.setItem(key(canteenId), JSON.stringify(cart));
  } catch {
    /* storage unavailable: the cart just isn't remembered */
  }
}

export function cartLines(cart: Cart) {
  return Object.entries(cart)
    .filter(([, q]) => q > 0)
    .map(([menu_item_id, quantity]) => ({ menu_item_id, quantity }));
}

export function useCart(canteenId: string) {
  const [cart, setCart] = useState<Cart>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setCart(readCart(canteenId));
    setLoaded(true);
  }, [canteenId]);

  const update = useCallback(
    (fn: (c: Cart) => Cart) => {
      setCart((prev) => {
        const next = fn(prev);
        writeCart(canteenId, next);
        return next;
      });
    },
    [canteenId],
  );

  const setQty = useCallback(
    (id: string, qty: number) =>
      update((c) => {
        const next = { ...c };
        if (qty <= 0) delete next[id];
        else next[id] = Math.min(qty, 50);
        return next;
      }),
    [update],
  );

  /** Drops items that are no longer on the live menu. */
  const prune = useCallback(
    (availableIds: Set<string>) =>
      update((c) => {
        const next: Cart = {};
        for (const [id, q] of Object.entries(c)) if (availableIds.has(id)) next[id] = q;
        return next;
      }),
    [update],
  );

  const clear = useCallback(() => update(() => ({})), [update]);

  return { cart, loaded, setQty, prune, clear };
}
