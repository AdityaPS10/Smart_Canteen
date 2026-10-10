"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BellRing, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/status-badge";
import { fetchJson, useLiveData } from "@/hooks/use-live-data";
import { estimateRange } from "@/lib/estimate";
import { launchPayment } from "@/lib/pay-client";
import type { PaymentInfo } from "@/lib/payment-info";
import { fireReadyAlert } from "@/lib/ready-alert";
import { formatPaise, formatTimeIST } from "@/lib/utils";
import type { Order } from "@/lib/types";

interface Detail {
  order: Omit<Order, "student_id">;
  items: Array<{ id: string; name: string; unit_price_paise: number; quantity: number; status: string }>;
  payments: Array<{ attempt_no: number; method: string; status: string }>;
  open_gateway_order_id: string | null;
  attempts_left: number;
  payment_mode: "mock" | "razorpay";
  razorpay_key_id: string | null;
}

export function OrderClient({ orderId }: { orderId: string }) {
  const router = useRouter();
  const { data, error, reload } = useLiveData<Detail>(`/api/orders/${orderId}`, [
    { channel: `order:${orderId}`, events: ["order_changed"] },
  ]);
  const [busy, setBusy] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const lastStatus = useRef<string | null>(null);

  const order = data?.order;

  // Ready alert: fire once when we see the order become READY.
  useEffect(() => {
    if (!order) return;
    if (lastStatus.current && lastStatus.current !== "READY" && order.status === "READY") {
      fireReadyAlert(order.token_number);
    }
    lastStatus.current = order.status;
  }, [order]);

  // After the final payment failure the app returns to the home page.
  useEffect(() => {
    if (order?.status !== "PAYMENT_FAILED") return;
    const t = setTimeout(() => router.replace("/"), 6000);
    return () => clearTimeout(t);
  }, [order?.status, router]);

  if (error && !data) return <p className="p-6 text-destructive">{error.message}</p>;
  if (!data || !order) return <p className="p-6 text-muted-foreground">Loading…</p>;

  const navigate = (url: string) => (url === `/orders/${orderId}` ? reload() : router.push(url));

  async function resumePayment() {
    if (!data?.open_gateway_order_id) return;
    const info: PaymentInfo = {
      mode: data.payment_mode,
      order_id: orderId,
      gateway_order_id: data.open_gateway_order_id,
      amount_paise: data.order.total_paise,
      key_id: data.razorpay_key_id ?? undefined,
    };
    setPayError(null);
    await launchPayment(info, navigate).catch((e: Error) => setPayError(e.message));
  }

  async function retry() {
    setBusy(true);
    setPayError(null);
    try {
      const { payment } = await fetchJson<{ payment: PaymentInfo }>("/api/payments/retry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_id: orderId }),
      });
      await launchPayment(payment, navigate);
    } catch (e) {
      setPayError((e as Error).message);
      reload();
    } finally {
      setBusy(false);
    }
  }

  const lastPayment = data.payments[data.payments.length - 1];
  const waitingKitchen = order.status === "PAID" || order.status === "PREPARING";

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-4 px-4 py-6">
      {order.status === "READY" && (
        <Alert variant="success" className="border-2">
          <AlertTitle className="flex items-center gap-2 text-lg">
            <BellRing className="size-5" /> Your order is ready!
          </AlertTitle>
          <AlertDescription>
            Show token {order.token_number} at the counter. Please collect it within 10 minutes
            {order.ready_at ? ` (ready at ${formatTimeIST(order.ready_at)})` : ""}.
          </AlertDescription>
        </Alert>
      )}

      {order.status === "PAYMENT_FAILED" && (
        <Alert variant="destructive">
          <AlertTitle>Payment failed</AlertTitle>
          <AlertDescription>No token was created for this order and its items were released. Returning to the home page…</AlertDescription>
        </Alert>
      )}

      {order.status === "EXPIRED" && (
        <Alert variant="destructive">
          <AlertTitle>Order expired</AlertTitle>
          <AlertDescription>The order was not collected within 10 minutes of being ready.</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="items-center text-center">
          {order.token_number ? (
            <>
              <span className="text-sm uppercase tracking-widest text-muted-foreground">Token</span>
              <span className="text-8xl font-black tabular-nums leading-none">{order.token_number}</span>
            </>
          ) : (
            <span className="text-muted-foreground">No token yet. A token is created after payment.</span>
          )}
          <StatusBadge status={order.status} className="mt-2 text-sm" />
          {waitingKitchen && order.estimated_minutes !== null && (
            <EstimateLine minutes={order.estimated_minutes} sample={order.estimate_source === "ml_sample"} />
          )}
        </CardHeader>
      </Card>

      {order.status === "PENDING_PAYMENT" && (
        <Card>
          <CardContent className="flex flex-col gap-3 pt-5">
            {data.open_gateway_order_id ? (
              <>
                <p className="text-sm text-muted-foreground">Waiting for payment confirmation…</p>
                <Button size="lg" onClick={resumePayment}>
                  <Smartphone /> Pay by UPI
                </Button>
              </>
            ) : data.attempts_left > 0 ? (
              <>
                {lastPayment?.status === "failed" && (
                  <p className="text-sm text-destructive">
                    Payment failed. You can retry {data.attempts_left} more time{data.attempts_left === 1 ? "" : "s"}.
                  </p>
                )}
                <Button size="lg" onClick={retry} disabled={busy}>
                  <Smartphone /> Retry payment
                </Button>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Waiting for the payment result…</p>
            )}
            {payError && <p className="text-sm text-destructive">{payError}</p>}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Bill</CardTitle>
          <p className="text-xs text-muted-foreground">
            {order.paid_at ? `Paid ${formatTimeIST(order.paid_at)} · ` : ""}Order {order.id.slice(0, 8)}
          </p>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((i) => (
                <TableRow key={i.id}>
                  <TableCell>
                    {i.name}
                    <div className="text-xs text-muted-foreground">{formatPaise(i.unit_price_paise)} each</div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{i.quantity}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatPaise(i.unit_price_paise * i.quantity)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={2} className="font-bold">
                  Total
                </TableCell>
                <TableCell className="text-right text-lg font-bold tabular-nums">{formatPaise(order.total_paise)}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>
    </main>
  );
}

function EstimateLine({ minutes, sample }: { minutes: number; sample: boolean }) {
  const { low, high } = estimateRange(minutes);
  return (
    <p className="mt-2 text-sm">
      Estimated ready in {low} to {high} min
      {sample && <span className="text-muted-foreground"> · estimate (sample data)</span>}
    </p>
  );
}
