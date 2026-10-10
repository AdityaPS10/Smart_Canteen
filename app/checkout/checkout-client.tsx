"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { QrCode, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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

  if (!loaded) return null;

  if (lines.length === 0 && !paying) {
    return (
      <p>
        Your cart is empty.{" "}
        <Link className="underline" href={`/menu/${canteenId}`}>
          Back to the menu
        </Link>
      </p>
    );
  }

  const needsScan = error?.code === "NO_CHECKIN" || (preview !== null && !preview.checked_in);
  const soldOut = error?.code === "SOLD_OUT" || error?.code === "ITEM_UNAVAILABLE";

  return (
    <div className="flex flex-col gap-4">
      {needsScan && (
        <Alert variant="warning">
          <AlertTitle>Entrance QR not scanned</AlertTitle>
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
              <Link className="underline" href={`/menu/${canteenId}`}>
                Update my cart
              </Link>
            )}
          </AlertDescription>
        </Alert>
      )}

      {preview && (
        <Card>
          <CardContent className="pt-5">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.lines.map((l) => (
                  <TableRow key={l.menu_item_id}>
                    <TableCell>
                      {l.name}
                      <div className="text-xs text-muted-foreground">{formatPaise(l.unit_price_paise)} each</div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{l.quantity}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatPaise(l.line_total_paise)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={2} className="font-bold">
                    Total
                  </TableCell>
                  <TableCell className="text-right text-lg font-bold tabular-nums">
                    {formatPaise(preview.total_paise)}
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </CardContent>
        </Card>
      )}

      <Button size="lg" onClick={pay} disabled={paying || !preview || needsScan}>
        <Smartphone /> {paying ? "Opening UPI…" : "Pay by UPI (GPay / PhonePe)"}
      </Button>
      <Link href={`/menu/${canteenId}`} className="text-center text-sm text-muted-foreground underline">
        Change items
      </Link>
    </div>
  );
}
