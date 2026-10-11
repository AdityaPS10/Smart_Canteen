"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BellRing, Clock, Loader2, Receipt, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Bill } from "@/components/bill";
import { StatusChip } from "@/components/status-chip";
import { TokenChip } from "@/components/token-chip";
import { fetchJson, useLiveData } from "@/hooks/use-live-data";
import { estimateRange } from "@/lib/estimate";
import { launchPayment } from "@/lib/pay-client";
import type { PaymentInfo } from "@/lib/payment-info";
import { fireReadyAlert } from "@/lib/ready-alert";
import { formatTimeIST } from "@/lib/utils";
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

  if (error && !data) {
    return (
      <main className="mx-auto max-w-xl px-4 py-8">
        <Alert variant="destructive">
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      </main>
    );
  }
  if (!data || !order) return <OrderSkeleton />;

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
  const isReady = order.status === "READY";

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-5 px-4 py-6 sm:py-8">
      {isReady && (
        <div
          role="alert"
          className="flex items-start gap-4 rounded-xl bg-success p-5 text-success-foreground shadow-md"
        >
          <BellRing className="mt-0.5 size-7 shrink-0 animate-pulse" aria-hidden />
          <div className="flex flex-col gap-1">
            <p className="text-xl font-semibold">Your order is ready!</p>
            <p className="text-base">
              Show token {order.token_number} at the counter. Please collect it within 10 minutes
              {order.ready_at ? ` (ready at ${formatTimeIST(order.ready_at)})` : ""}.
            </p>
          </div>
        </div>
      )}

      {order.status === "PAYMENT_FAILED" && (
        <Alert variant="destructive">
          <AlertTitle>Payment failed</AlertTitle>
          <AlertDescription>
            No token was created for this order and its items were released. Returning to the home page…
          </AlertDescription>
        </Alert>
      )}

      {order.status === "EXPIRED" && (
        <Alert variant="destructive">
          <AlertTitle>Order expired</AlertTitle>
          <AlertDescription>The order was not collected within 10 minutes of being ready.</AlertDescription>
        </Alert>
      )}

      <section className="flex flex-col items-center gap-4 rounded-xl border bg-card px-5 py-8 text-center shadow-xs">
        {order.token_number ? (
          <>
            <span className="text-sm font-medium uppercase tracking-widest text-muted-foreground">Token</span>
            <TokenChip
              token={order.token_number}
              size="xl"
              tone={isReady ? "success" : order.status === "GIVEN" ? "muted" : "solid"}
              className="min-w-36 sm:h-32 sm:text-8xl"
            />
          </>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <span className="flex size-14 items-center justify-center rounded-full bg-muted">
              <Receipt className="size-6 text-muted-foreground" aria-hidden />
            </span>
            <p className="max-w-xs text-sm text-muted-foreground">No token yet. A token is created after payment.</p>
          </div>
        )}
        <StatusChip status={order.status} size="lg" />
        {waitingKitchen && order.estimated_minutes !== null && (
          <EstimateLine minutes={order.estimated_minutes} sample={order.estimate_source === "ml_sample"} />
        )}
      </section>

      {order.status === "PENDING_PAYMENT" && (
        <section className="flex flex-col gap-3 rounded-xl border bg-card p-5 shadow-xs">
          {data.open_gateway_order_id ? (
            <>
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" aria-hidden /> Waiting for payment confirmation…
              </p>
              <Button size="xl" onClick={resumePayment}>
                <Smartphone /> Pay by UPI
              </Button>
            </>
          ) : data.attempts_left > 0 ? (
            <>
              {lastPayment?.status === "failed" && (
                <p className="text-sm font-medium text-danger">
                  Payment failed. You can retry {data.attempts_left} more time{data.attempts_left === 1 ? "" : "s"}.
                </p>
              )}
              <Button size="xl" onClick={retry} disabled={busy}>
                {busy ? <Loader2 className="animate-spin" /> : <Smartphone />} Retry payment
              </Button>
            </>
          ) : (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden /> Waiting for the payment result…
            </p>
          )}
          {payError && <p className="text-sm font-medium text-danger">{payError}</p>}
        </section>
      )}

      <section className="flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-xs">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-lg font-semibold">Bill</h2>
          <p className="text-sm text-muted-foreground">
            {order.paid_at ? `Paid ${formatTimeIST(order.paid_at)} · ` : ""}#{order.id.slice(0, 8)}
          </p>
        </div>
        <Bill
          lines={data.items.map((i) => ({
            key: i.id,
            name: i.name,
            unitPaise: i.unit_price_paise,
            quantity: i.quantity,
          }))}
          totalPaise={order.total_paise}
        />
      </section>
    </main>
  );
}

function EstimateLine({ minutes, sample }: { minutes: number; sample: boolean }) {
  const { low, high } = estimateRange(minutes);
  return (
    <div className="flex flex-col items-center gap-0.5">
      <p className="flex items-center gap-1.5 text-base font-medium">
        <Clock className="size-4" aria-hidden /> Estimated ready in {low} to {high} min
      </p>
      {sample && <p className="text-sm text-muted-foreground">estimate (sample data)</p>}
    </div>
  );
}

function OrderSkeleton() {
  return (
    <main className="mx-auto flex max-w-xl flex-col gap-5 px-4 py-8" aria-label="Loading order">
      <div className="flex flex-col items-center gap-4 rounded-xl border bg-card px-5 py-8">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-28 w-36 rounded-2xl" />
        <Skeleton className="h-7 w-28 rounded-full" />
      </div>
      <Skeleton className="h-48 w-full rounded-xl" />
    </main>
  );
}

