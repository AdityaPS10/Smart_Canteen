"use client";

import { useEffect, useState } from "react";
import { ChefHat, CheckCheck, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchJson, useLiveData } from "@/hooks/use-live-data";
import type { Batch } from "@/lib/kitchen";
import { formatTimeIST, minutesSince } from "@/lib/utils";

interface KitchenData {
  batches: Batch[];
  spare_pool: Array<{ menu_item_id: string; name: string; quantity: number }>;
  window_minutes: number;
}

export function KitchenDisplay({ canteenId }: { canteenId: string }) {
  const { data, error, reload } = useLiveData<KitchenData>("/api/kitchen/batches", [
    { channel: `canteen:${canteenId}`, events: ["orders_changed"] },
  ]);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(t);
  }, []);

  async function act(batch: Batch, action: "start" | "ready") {
    setBusyKey(batch.key + action);
    setMessage(null);
    try {
      await fetchJson(`/api/kitchen/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_item_ids: batch.order_item_ids }),
      });
      await reload();
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <main className="mx-auto grid max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[1fr_280px]">
      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <h1 className="text-2xl font-bold">Kitchen</h1>
          {data && (
            <span className="text-sm text-muted-foreground">
              Grouped in {data.window_minutes}-minute windows · oldest first
            </span>
          )}
        </div>
        {message && <p className="text-sm text-destructive">{message}</p>}
        {error && !data && <p className="text-destructive">{error.message}</p>}
        {data && data.batches.length === 0 && (
          <Card className="p-10 text-center text-muted-foreground">Nothing to cook right now.</Card>
        )}
        {data?.batches.map((b) => (
          <Card key={b.key} className={b.status === "preparing" ? "border-warning" : undefined}>
            <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="text-3xl font-black tabular-nums">{b.total_quantity}×</span>
                  <span className="text-2xl font-bold">{b.name}</span>
                  {b.status === "preparing" && <Badge variant="warning">Cooking</Badge>}
                  {b.ready_made && <Badge variant="secondary">Ready made</Badge>}
                </div>
                <div className="flex flex-wrap items-center gap-1.5 text-sm">
                  <span className="text-muted-foreground">Tokens</span>
                  {b.tokens.map((t) => (
                    <Badge key={t} variant="outline" className="text-sm tabular-nums">
                      {t}
                    </Badge>
                  ))}
                </div>
                <div className="flex flex-wrap gap-x-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="size-3.5" /> waiting {minutesSince(b.oldest_paid_at, now)} min
                  </span>
                  <span>
                    window {formatTimeIST(b.window_start)}–{formatTimeIST(b.window_end)}
                  </span>
                </div>
              </div>
              <div className="flex gap-2">
                {b.status === "pending" && (
                  <Button variant="outline" disabled={busyKey !== null} onClick={() => act(b, "start")}>
                    <ChefHat /> Start cooking
                  </Button>
                )}
                <Button disabled={busyKey !== null} onClick={() => act(b, "ready")}>
                  <CheckCheck /> Mark ready
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </section>

      <aside>
        <Card>
          <CardHeader>
            <CardTitle>Spare pool</CardTitle>
          </CardHeader>
          <CardContent>
            {!data || data.spare_pool.length === 0 ? (
              <p className="text-sm text-muted-foreground">Empty</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {data.spare_pool.map((s) => (
                  <li key={s.menu_item_id} className="flex justify-between">
                    <span>{s.name}</span>
                    <span className="font-semibold tabular-nums">{s.quantity}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </aside>
    </main>
  );
}
