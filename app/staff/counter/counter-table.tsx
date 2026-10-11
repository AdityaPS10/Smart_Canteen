"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/status-badge";
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

  return (
    <Card className="p-2">
      {message && <p className="p-2 text-sm text-destructive">{message}</p>}
      {error && !data && <p className="p-2 text-destructive">{error.message}</p>}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>TOKEN ID</TableHead>
            <TableHead>Items</TableHead>
            <TableHead className="text-right">Qty</TableHead>
            <TableHead className="text-right">Marked as done</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data?.orders.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                No orders waiting.
              </TableCell>
            </TableRow>
          )}
          {data?.orders.map((o) => (
            <TableRow key={o.id} data-order-row className={cn(o.status === "READY" && "bg-success/10")}>
              <TableCell className="align-top">
                <div className="text-3xl font-black tabular-nums" aria-label={`Token ${o.token_number}`}>{o.token_number}</div>
                <StatusBadge status={o.status} />
              </TableCell>
              <TableCell className="align-top">
                <ul>
                  {o.items.map((i, idx) => (
                    <li key={idx} className="py-0.5">
                      {i.name}
                    </li>
                  ))}
                </ul>
              </TableCell>
              <TableCell className="text-right align-top">
                <ul>
                  {o.items.map((i, idx) => (
                    <li key={idx} className="py-0.5 tabular-nums">
                      {i.quantity}
                    </li>
                  ))}
                </ul>
              </TableCell>
              <TableCell className="text-right align-top">
                <Button
                  disabled={o.status !== "READY" || busy !== null}
                  onClick={() => done(o.id)}
                  title={o.status === "READY" ? undefined : "Enabled when the order is READY"}
                >
                  <Check /> Marked as done
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
