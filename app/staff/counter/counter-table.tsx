"use client";

import { useState } from "react";
import { Check, Inbox, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { EmptyState } from "@/components/empty-state";
import { StatusChip } from "@/components/status-chip";
import { TokenChip } from "@/components/token-chip";
import { fetchJson, useLiveData } from "@/hooks/use-live-data";
import { cn } from "@/lib/utils";
import type { OrderStatus } from "@/lib/types";

interface CounterOrder {
  id: string;
  token_number: number;
  status: OrderStatus;
  source: "app" | "cashier";
  items: Array<{ name: string; quantity: number; status: string }>;
}

export function CounterTable({ canteenId }: { canteenId: string }) {
  const { data, error, reload } = useLiveData<{ orders: CounterOrder[] }>("/api/counter/orders", [
    { channel: `canteen:${canteenId}`, events: ["orders_changed"] },
  ]);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function done(orderId: string) {
    setBusy(orderId);
    setMessage(null);
    try {
      await fetchJson("/api/counter/done", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_id: orderId }),
      });
      await reload();
    } catch (e) {
      setMessage((e as Error).message);
      reload();
    } finally {
      setBusy(null);
    }
  }

  const orders = data?.orders ?? [];
  const readyCount = orders.filter((o) => o.status === "READY").length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-3 text-sm">
        <span className="inline-flex items-center gap-2 rounded-full border-2 border-foreground bg-card px-3 py-1 font-semibold">
          {orders.length} waiting
        </span>
        <span className="inline-flex items-center gap-2 rounded-full bg-success px-3 py-1 font-semibold text-success-foreground">
          {readyCount} ready to hand over
        </span>
      </div>

      {message && (
        <Alert variant="destructive">
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}
      {error && !data && (
        <Alert variant="destructive">
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      )}

      <div className="overflow-hidden rounded-xl border-2 border-foreground bg-card">
        {/* Columns per spec: TOKEN ID | Items | Qty | Marked as done (stacked on phones) */}
        <div
          className={cn(
            COLS,
            "hidden border-b-2 border-foreground bg-foreground px-4 py-3 text-sm font-semibold uppercase tracking-wide text-background md:grid",
          )}
          aria-hidden
        >
          <span>Token ID</span>
          <span>Items</span>
          <span className="text-right">
            Qty
          </span>
          <span className="text-right">
            Marked as done
          </span>
        </div>

        {!data && !error && (
          <div className="flex flex-col gap-2 p-4">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        )}

        {data && orders.length === 0 && (
          <EmptyState
            className="m-4 border-foreground/40"
            icon={<Inbox />}
            title="No orders waiting"
            description="New paid orders appear here instantly."
          />
        )}

        <ul className="divide-y-2 divide-foreground/15">
          {orders.map((o) => {
            const ready = o.status === "READY";
            return (
              <li
                key={o.id}
                data-order-row
                className={cn(COLS, "grid grid-cols-[auto_1fr] gap-x-4 gap-y-3 px-4 py-4", ready && "bg-success/10")}
              >
                <div className="flex flex-col items-start gap-2">
                  <TokenChip token={o.token_number} size="md" tone={ready ? "success" : "outline"} />
                  <StatusChip status={o.status} />
                </div>
                <ul className="flex flex-col gap-1.5 text-base">
                  {o.items.map((i, idx) => (
                    <li key={idx} className="flex justify-between gap-3 font-medium">
                      <span>{i.name}</span>
                      <span className="token-num text-lg md:hidden">× {i.quantity}</span>
                    </li>
                  ))}
                </ul>
                <ul className="hidden flex-col gap-1.5 text-right md:flex">
                  {o.items.map((i, idx) => (
                    <li key={idx} className="token-num text-lg">
                      {i.quantity}
                    </li>
                  ))}
                </ul>
                <div className="col-span-2 flex md:col-span-1 md:justify-end">
                  <Button
                    size="lg"
                    variant={ready ? "success" : "outline"}
                    className="w-full md:w-auto"
                    disabled={!ready || busy !== null}
                    onClick={() => done(o.id)}
                    title={ready ? undefined : "Enabled when the order is READY"}
                  >
                    {busy === o.id ? <Loader2 className="animate-spin" /> : <Check />} Marked as done
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

const COLS = "md:grid-cols-[9rem_1fr_4rem_13rem] md:items-start";

