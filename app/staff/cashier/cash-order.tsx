"use client";

import { useState } from "react";
import { Banknote, Loader2, RotateCcw, UtensilsCrossed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Bill } from "@/components/bill";
import { EmptyState } from "@/components/empty-state";
import { QtyStepper } from "@/components/qty-stepper";
import { TokenChip } from "@/components/token-chip";
import { FetchError, fetchJson, useLiveData } from "@/hooks/use-live-data";
import { cn, formatPaise } from "@/lib/utils";
import type { PublicMenuItem } from "@/lib/types";

interface CashBill {
  order: { id: string; token_number: number; total_paise: number; status: string; paid_at: string };
  items: Array<{ id: string; name: string; unit_price_paise: number; quantity: number }>;
}

/** Cashier ordering screen: tap items, set quantities, see the total, press "Cash received". */
export function CashOrder({ canteenId }: { canteenId: string }) {
  const { data, reload } = useLiveData<{ items: PublicMenuItem[] }>(`/api/menu?canteenId=${canteenId}`, [
    { channel: `canteen:${canteenId}`, events: ["menu_changed"] },
  ]);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [customer, setCustomer] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bill, setBill] = useState<CashBill | null>(null);
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());

  const items = data?.items ?? [];
  const byId = new Map(items.map((i) => [i.id, i]));
  const lines = Object.entries(cart).filter(([id, q]) => q > 0 && byId.has(id));
  const total = lines.reduce((s, [id, q]) => s + byId.get(id)!.price_paise * q, 0);

  const setQty = (id: string, q: number) =>
    setCart((c) => {
      const next = { ...c };
      if (q <= 0) delete next[id];
      else next[id] = Math.min(q, 50);
      return next;
    });

  async function cashReceived() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetchJson<CashBill>("/api/cashier/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: lines.map(([menu_item_id, quantity]) => ({ menu_item_id, quantity })),
          customer_name: customer.trim() || undefined,
          client_request_id: requestId,
        }),
      });
      setBill(res);
    } catch (e) {
      setError((e as Error).message);
      if (e instanceof FetchError && (e.code === "SOLD_OUT" || e.code === "ITEM_UNAVAILABLE")) await reload();
    } finally {
      setBusy(false);
    }
  }

  function newOrder() {
    setBill(null);
    setCart({});
    setCustomer("");
    setError(null);
    setRequestId(crypto.randomUUID());
  }

  if (bill) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col gap-5 rounded-xl border bg-card p-6 shadow-sm">
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="text-sm font-medium uppercase tracking-widest text-muted-foreground">Token</span>
          <TokenChip token={bill.order.token_number} size="xl" tone="solid" className="min-w-36" />
          <span className="inline-flex items-center gap-1.5 rounded-full bg-success px-3 py-1 text-sm font-medium text-success-foreground">
            <Banknote className="size-4" aria-hidden /> Paid in cash
          </span>
        </div>
        <Bill
          lines={bill.items.map((i) => ({ key: i.id, name: i.name, unitPaise: i.unit_price_paise, quantity: i.quantity }))}
          totalPaise={bill.order.total_paise}
        />
        <Button size="xl" onClick={newOrder}>
          <RotateCcw /> New order
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
      <section aria-label="Menu" className="flex flex-col gap-3">
        {!data && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
        )}
        {data && items.length === 0 && (
          <EmptyState icon={<UtensilsCrossed />} title="Nothing is in stock" description="Add stock in Menu & stock." />
        )}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {items.map((i) => {
            const q = cart[i.id] ?? 0;
            return (
              <button
                key={i.id}
                type="button"
                onClick={() => setQty(i.id, q + 1)}
                className={cn(
                  "relative flex min-h-24 flex-col items-start justify-between gap-2 rounded-xl border bg-card p-4 text-left shadow-xs transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  q > 0 && "border-foreground ring-1 ring-foreground",
                )}
              >
                <span className="pr-8 font-semibold leading-snug">{i.name}</span>
                <span className="text-sm font-medium tabular-nums text-muted-foreground">{formatPaise(i.price_paise)}</span>
                {q > 0 && (
                  <span className="token-num absolute right-3 top-3 flex size-7 items-center justify-center rounded-full bg-primary text-sm text-primary-foreground">
                    {q}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </section>

      <aside className="flex h-fit flex-col gap-4 rounded-xl border bg-card p-5 shadow-sm lg:sticky lg:top-20">
        <h2 className="text-lg font-semibold">Cash order</h2>
        {lines.length === 0 ? (
          <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
            Tap items to add them.
          </p>
        ) : (
          <ul className="flex flex-col divide-y">
            {lines.map(([id, q]) => (
              <li key={id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="flex min-w-0 flex-col">
                  <span className="truncate font-medium">{byId.get(id)!.name}</span>
                  <span className="text-sm tabular-nums text-muted-foreground">
                    {formatPaise(byId.get(id)!.price_paise * q)}
                  </span>
                </div>
                <QtyStepper value={q} onChange={(v) => setQty(id, v)} label={byId.get(id)!.name} />
              </li>
            ))}
          </ul>
        )}
        <Input placeholder="Customer name (optional)" value={customer} onChange={(e) => setCustomer(e.target.value)} />
        <div className="flex items-baseline justify-between border-t-2 border-foreground/80 pt-3">
          <span className="font-semibold">Total</span>
          <span className="text-3xl font-semibold tabular-nums">{formatPaise(total)}</span>
        </div>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <Button size="xl" disabled={busy || lines.length === 0} onClick={cashReceived}>
          {busy ? <Loader2 className="animate-spin" /> : <Banknote />} Cash received
        </Button>
      </aside>
    </div>
  );
}

