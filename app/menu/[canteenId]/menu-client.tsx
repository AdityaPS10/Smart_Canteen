"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, QrCode, ShoppingBag, UtensilsCrossed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { EmptyState } from "@/components/empty-state";
import { ItemCard, ItemCardSkeleton } from "@/components/item-card";
import { PageHeader } from "@/components/page-header";
import { QtyStepper } from "@/components/qty-stepper";
import { StickyBottomBar } from "@/components/sticky-bottom-bar";
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
    <main className="mx-auto flex max-w-xl flex-col gap-5 px-4 pb-36 pt-6 md:max-w-4xl">
      <PageHeader title="Live menu" description="Only dishes in stock are shown. Sold-out items disappear." />

      {notice && (
        <Alert variant="warning">
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      )}

      {needsScan && (
        <Alert variant="warning">
          <AlertTitle className="flex items-center gap-2">
            <QrCode className="size-4" aria-hidden /> Entrance QR not scanned
          </AlertTitle>
          <AlertDescription className="flex flex-col gap-3">
            <span>Scan the QR on the display at the canteen entrance, or order at the cashier.</span>
            <Button className="self-start" onClick={() => router.push(`/scan?canteen=${canteenId}`)}>
              <QrCode /> Scan
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {error && !data && (
        <Alert variant="destructive">
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      )}

      {!data && !error && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2" aria-label="Loading menu">
          {Array.from({ length: 6 }, (_, i) => (
            <ItemCardSkeleton key={i} />
          ))}
        </div>
      )}

      {data && items.length === 0 && (
        <EmptyState
          icon={<UtensilsCrossed />}
          title="Nothing is available right now"
          description="Dishes appear here as soon as the cashier adds stock."
        />
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {items.map((item) => (
          <ItemCard
            key={item.id}
            name={item.name}
            pricePaise={item.price_paise}
            readyMade={item.ready_made}
            selected={(cart[item.id] ?? 0) > 0}
          >
            <QtyStepper value={cart[item.id] ?? 0} onChange={(q) => setQty(item.id, q)} label={item.name} />
          </ItemCard>
        ))}
      </div>

      {count > 0 && (
        <StickyBottomBar innerClassName="md:max-w-4xl">
          <div className="flex flex-col">
            <span className="text-sm text-muted-foreground">
              {count} item{count === 1 ? "" : "s"}
            </span>
            <span className="text-xl font-semibold tabular-nums">{formatPaise(displayTotal)}</span>
          </div>
          <Button size="xl" className="min-w-36" onClick={onOrder} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" /> : <ShoppingBag />} Order
          </Button>
        </StickyBottomBar>
      )}
    </main>
  );
}
