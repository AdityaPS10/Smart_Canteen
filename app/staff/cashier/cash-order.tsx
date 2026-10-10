"use client";

import { useState } from "react";
import { Banknote, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableFooter, TableRow } from "@/components/ui/table";
import { QtyStepper } from "@/components/qty-stepper";
import { FetchError, fetchJson, useLiveData } from "@/hooks/use-live-data";
import { cn, formatPaise } from "@/lib/utils";
import type { PublicMenuItem } from "@/lib/types";

interface Bill {
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
  const [bill, setBill] = useState<Bill | null>(null);
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
      const res = await fetchJson<Bill>("/api/cashier/orders", {
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
      <Card className="mx-auto w-full max-w-md">
        <CardHeader className="items-center text-center">
          <span className="text-sm uppercase tracking-widest text-muted-foreground">Token</span>
          <span className="text-8xl font-black tabular-nums leading-none">{bill.order.token_number}</span>
          <span className="text-sm text-muted-foreground">Paid in cash · {bill.order.status}</span>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Table>
            <TableBody>
              {bill.items.map((i) => (
                <TableRow key={i.id}>
                  <TableCell>{i.name}</TableCell>
                  <TableCell className="text-right tabular-nums">×{i.quantity}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatPaise(i.unit_price_paise * i.quantity)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={2} className="font-bold">
                  Total
                </TableCell>
                <TableCell className="text-right font-bold tabular-nums">{formatPaise(bill.order.total_paise)}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
          <Button size="lg" onClick={newOrder}>
            <RotateCcw /> New order
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
        {items.map((i) => (
          <button
            key={i.id}
            type="button"
            onClick={() => setQty(i.id, (cart[i.id] ?? 0) + 1)}
            className={cn(
              "flex flex-col items-start gap-1 rounded-xl border bg-card p-4 text-left shadow-sm transition-colors hover:bg-muted/50",
              cart[i.id] && "border-primary ring-2 ring-primary/30",
            )}
          >
            <span className="font-semibold">{i.name}</span>
            <span className="text-sm text-muted-foreground">{formatPaise(i.price_paise)}</span>
            {cart[i.id] ? <span className="text-sm font-bold text-primary">×{cart[i.id]}</span> : null}
          </button>
        ))}
        {data && items.length === 0 && <p className="text-muted-foreground">Nothing is in stock.</p>}
      </div>

      <Card className="h-fit lg:sticky lg:top-20">
        <CardHeader>
          <CardTitle>Cash order</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {lines.length === 0 && <p className="text-sm text-muted-foreground">Tap items to add them.</p>}
          {lines.map(([id, q]) => (
            <div key={id} className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-medium">{byId.get(id)!.name}</span>
                <span className="text-xs text-muted-foreground">{formatPaise(byId.get(id)!.price_paise * q)}</span>
              </div>
              <QtyStepper value={q} onChange={(v) => setQty(id, v)} />
            </div>
          ))}
          <Input placeholder="Customer name (optional)" value={customer} onChange={(e) => setCustomer(e.target.value)} />
          <div className="flex items-baseline justify-between border-t pt-3">
            <span className="font-semibold">Total</span>
            <span className="text-2xl font-bold tabular-nums">{formatPaise(total)}</span>
          </div>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <Button size="lg" disabled={busy || lines.length === 0} onClick={cashReceived}>
            <Banknote /> Cash received
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
