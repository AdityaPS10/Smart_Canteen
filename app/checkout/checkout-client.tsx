"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, QrCode, ShoppingBag, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Bill } from "@/components/bill";
import { EmptyState } from "@/components/empty-state";
import { StickyBottomBar } from "@/components/sticky-bottom-bar";
import { FetchError, fetchJson } from "@/hooks/use-live-data";
import { cartLines, useCart } from "@/lib/cart";
import { launchPayment } from "@/lib/pay-client";
import type { PaymentInfo } from "@/lib/payment-info";
import { formatPaise } from "@/lib/utils";

interface Line {
  menu_item_id: string;
  name: string;
  unit_price_paise: number;
  quantity: number;
  line_total_paise: number;
}

interface Preview {
  lines: Line[];
  total_paise: number;
  checked_in: boolean;
}

export function CheckoutClient({ canteenId }: { canteenId: string }) {
  const router = useRouter();
  const { cart, loaded, clear } = useCart(canteenId);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<FetchError | null>(null);
  const [paying, setPaying] = useState(false);
  // Same id for repeated clicks: the server creates at most one order for it.
  const [requestId] = useState(() => crypto.randomUUID());

  const lines = cartLines(cart);
  const cartKey = JSON.stringify(lines);

  const loadPreview = useCallback(async () => {
    const items = JSON.parse(cartKey);
    if (items.length === 0) return;
    try {
      setPreview(
        await fetchJson<Preview>("/api/orders/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ canteen_id: canteenId, items }),
        }),
      );
      setError(null);
    } catch (e) {
      setPreview(null);
      setError(e as FetchError);
    }
  }, [canteenId, cartKey]);

  useEffect(() => {
    if (loaded) loadPreview();
  }, [loaded, loadPreview]);

  async function pay() {
    if (paying) return;
    setPaying(true);
    setError(null);
    try {
      const res = await fetchJson<{ order_id: string; payment: PaymentInfo | null }>("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ canteen_id: canteenId, items: lines, client_request_id: requestId }),
      });
      clear(); // stock is reserved for this order now
      if (res.payment) await launchPayment(res.payment, (url) => router.push(url));
      else router.push(`/orders/${res.order_id}`);
    } catch (e) {
      setPaying(false);
      setError(e as FetchError);
      if (e instanceof FetchError && e.code !== "NO_CHECKIN") loadPreview();
    }
  }

  if (!loaded) return <CheckoutSkeleton />;

  if (lines.length === 0 && !paying) {
    return (
      <EmptyState
        icon={<ShoppingBag />}
        title="Your cart is empty"
        description="Add dishes from the live menu first."
        action={
          <Button asChild variant="outline">
            <Link href={`/menu/${canteenId}`}>Back to the menu</Link>
          </Button>
        }
      />
    );
  }

  const needsScan = error?.code === "NO_CHECKIN" || (preview !== null && !preview.checked_in);
  const soldOut = error?.code === "SOLD_OUT" || error?.code === "ITEM_UNAVAILABLE";

  return (
    <div className="flex flex-col gap-5 pb-28">
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

      {error && !needsScan && (
        <Alert variant="destructive">
          <AlertDescription className="flex flex-col gap-2">
            <span>{error.message}</span>
            {soldOut && (
              <Link className="font-medium underline underline-offset-4" href={`/menu/${canteenId}`}>
                Update my cart
              </Link>
            )}
          </AlertDescription>
        </Alert>
      )}

      {preview ? (
        <section className="rounded-xl border bg-card p-5 shadow-xs">
          <Bill
            lines={preview.lines.map((l) => ({
              key: l.menu_item_id,
              name: l.name,
              unitPaise: l.unit_price_paise,
              quantity: l.quantity,
            }))}
            totalPaise={preview.total_paise}
          />
          <p className="mt-3 text-sm text-muted-foreground">Total calculated by the canteen from current prices.</p>
        </section>
      ) : (
        !error && <CheckoutSkeleton />
      )}

      <Link
        href={`/menu/${canteenId}`}
        className="self-center rounded-md px-3 py-2 text-sm font-medium text-muted-foreground underline underline-offset-4 hover:text-foreground"
      >
        Change items
      </Link>

      <StickyBottomBar>
        <div className="flex flex-col">
          <span className="text-sm text-muted-foreground">To pay</span>
          <span className="text-xl font-semibold tabular-nums">{preview ? formatPaise(preview.total_paise) : "…"}</span>
        </div>
        <Button size="xl" onClick={pay} disabled={paying || !preview || needsScan}>
          {paying ? <Loader2 className="animate-spin" /> : <Smartphone />}
          {paying ? (
            "Opening UPI…"
          ) : (
            <>
              Pay by UPI<span className="hidden sm:inline"> (GPay / PhonePe)</span>
            </>
          )}
        </Button>
      </StickyBottomBar>
    </div>
  );
}

function CheckoutSkeleton() {
  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-5" aria-label="Loading">
      <Skeleton className="h-5 w-2/3" />
      <Skeleton className="h-5 w-1/2" />
      <Skeleton className="mt-2 h-8 w-full" />
    </div>
  );
}

