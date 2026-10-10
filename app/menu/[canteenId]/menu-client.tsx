"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { QrCode, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { QtyStepper } from "@/components/qty-stepper";
import { FetchError, fetchJson, useLiveData } from "@/hooks/use-live-data";
import { cartLines, useCart } from "@/lib/cart";
import { formatPaise } from "@/lib/utils";
import type { PublicMenuItem } from "@/lib/types";

interface PreviewResponse {
  total_paise: number;
  checked_in: boolean;
}

export function MenuClient({ canteenId }: { canteenId: string }) {
  const router = useRouter();
  const { data, error, reload } = useLiveData<{ items: PublicMenuItem[] }>(
    `/api/menu?canteenId=${encodeURIComponent(canteenId)}`,
    [{ channel: `canteen:${canteenId}`, events: ["menu_changed"] }],
  );
  const { cart, loaded, setQty, prune } = useCart(canteenId);
  const [notice, setNotice] = useState<string | null>(null);
  const [needsScan, setNeedsScan] = useState(false);
  const [busy, setBusy] = useState(false);

  const items = useMemo(() => data?.items ?? [], [data]);

  // Sold-out items disappear from the menu: drop them from the cart and say so.
  useEffect(() => {
    if (!data || !loaded) return;
    const available = new Set(items.map((i) => i.id));
    if (Object.keys(cart).some((id) => !available.has(id))) {
      prune(available);
      setNotice("Something in your cart sold out and was removed.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, loaded]);

  // Client-side display only. The server recalculates the real total.
  const displayTotal = items.reduce((s, i) => s + (cart[i.id] ?? 0) * i.price_paise, 0);
  const count = Object.values(cart).reduce((a, b) => a + b, 0);

  async function onOrder() {
    setBusy(true);
    setNotice(null);
    try {
      const preview = await fetchJson<PreviewResponse>("/api/orders/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ canteen_id: canteenId, items: cartLines(cart) }),
      });
      if (preview.checked_in) {
        router.push(`/checkout?canteen=${canteenId}`);
      } else {
        setNeedsScan(true);
        setBusy(false);
      }
    } catch (e) {
      setBusy(false);
      if (e instanceof FetchError && (e.code === "SOLD_OUT" || e.code === "ITEM_UNAVAILABLE")) {
        await reload();
      }
      setNotice((e as Error).message);
    }
  }

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 px-4 pb-32 pt-6">
      <h1 className="text-2xl font-bold">Live menu</h1>

      {notice && (
        <Alert variant="warning">
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      )}

      {needsScan && (
        <Alert variant="warning">
          <AlertTitle>Entrance QR not scanned</AlertTitle>
          <AlertDescription className="flex flex-col gap-3">
            <span>Scan the QR on the display at the canteen entrance, or order at the cashier.</span>
            <Button
              className="self-start"
              onClick={() => router.push(`/scan?next=${encodeURIComponent(`/checkout?canteen=${canteenId}`)}`)}
            >
              <QrCode /> Scan
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {error && !data && <p className="text-destructive">{error.message}</p>}
      {!data && !error && <p className="text-muted-foreground">Loading menu…</p>}
      {data && items.length === 0 && <p className="text-muted-foreground">Nothing is available right now.</p>}

      <div className="flex flex-col gap-3">
        {items.map((item) => (
          <Card key={item.id} className="flex items-center justify-between gap-3 p-4">
            <div className="flex min-w-0 flex-col">
              <span className="truncate font-semibold">{item.name}</span>
              <span className="flex items-center gap-2 text-sm text-muted-foreground">
                {formatPaise(item.price_paise)}
                {item.ready_made && <Badge variant="secondary">Ready to pick up</Badge>}
              </span>
            </div>
            <QtyStepper value={cart[item.id] ?? 0} onChange={(q) => setQty(item.id, q)} />
          </Card>
        ))}
      </div>

      {count > 0 && (
        <div className="fixed inset-x-0 bottom-0 border-t bg-background/95 p-4 backdrop-blur">
          <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
            <div className="flex flex-col">
              <span className="text-sm text-muted-foreground">{count} item(s)</span>
              <span className="text-lg font-bold">{formatPaise(displayTotal)}</span>
            </div>
            <Button size="lg" onClick={onOrder} disabled={busy}>
              <ShoppingBag /> Order
            </Button>
          </div>
        </div>
      )}
    </main>
  );
}
