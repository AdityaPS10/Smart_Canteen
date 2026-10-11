"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchJson } from "@/hooks/use-live-data";
import { formatPaise } from "@/lib/utils";

/** MOCK UPI payment page (PAYMENT_MODE=mock). Uses the same server functions as the real webhook. */
export function MockPayClient({ orderId, gatewayOrderId }: { orderId: string; gatewayOrderId: string }) {
  const router = useRouter();
  const [amount, setAmount] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchJson<{ order: { total_paise: number } }>(`/api/orders/${orderId}`)
      .then((d) => setAmount(d.order.total_paise))
      .catch((e: Error) => setError(e.message));
  }, [orderId]);

  async function send(result: "success" | "fail") {
    setBusy(true);
    setError(null);
    try {
      await fetchJson("/api/payments/mock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_id: orderId, gateway_order_id: gatewayOrderId, result }),
      });
      router.replace(`/orders/${orderId}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-muted/40 px-4 py-10">
      <Card className="w-full max-w-sm border-4 border-dashed border-warning shadow-md">
        <CardHeader className="items-center gap-2 text-center">
          <span className="rounded-md bg-warning px-3 py-1 text-sm font-black tracking-widest text-warning-foreground">
            MOCK PAYMENT
          </span>
          <CardTitle className="pt-1 text-xl">UPI (GPay / PhonePe)</CardTitle>
          <p className="text-sm text-muted-foreground">Test mode. No real money moves.</p>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="py-2 text-center text-5xl font-semibold tabular-nums">
            {amount === null ? "…" : formatPaise(amount)}
          </p>
          <Button size="xl" variant="success" disabled={busy || amount === null} onClick={() => send("success")}>
            Pay success
          </Button>
          <Button size="xl" variant="destructive" disabled={busy || amount === null} onClick={() => send("fail")}>
            Pay fail
          </Button>
          {error && <p className="text-center text-sm font-medium text-danger">{error}</p>}
        </CardContent>
      </Card>
    </main>
  );
}
