"use client";

import { useEffect, useState } from "react";
import { Archive, ChefHat, CheckCheck, Clock, Flame, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { EmptyState } from "@/components/empty-state";
import { TokenChip } from "@/components/token-chip";
import { fetchJson, useLiveData } from "@/hooks/use-live-data";
import type { Batch } from "@/lib/kitchen";
import { cn, formatTimeIST, minutesSince } from "@/lib/utils";

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

  const batches = data?.batches ?? [];
  const units = batches.reduce((s, b) => s + b.total_quantity, 0);

  return (
    <main className="mx-auto grid max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[1fr_300px] 2xl:max-w-[110rem]">
      <section className="flex min-w-0 flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium text-muted-foreground">Food server</p>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Kitchen</h1>
          </div>
          {data && (
            <div className="flex flex-wrap gap-2 text-sm">
              <span className="rounded-full border px-3 py-1 font-medium">
                {units} to cook · {batches.length} batch{batches.length === 1 ? "" : "es"}
              </span>
              <span className="rounded-full border px-3 py-1 text-muted-foreground">
                {data.window_minutes}-min windows · oldest first
              </span>
            </div>
          )}
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
        {!data && !error && (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-36 w-full rounded-xl" />
            ))}
          </div>
        )}
        {data && batches.length === 0 && (
          <EmptyState icon={<ChefHat />} title="Nothing to cook right now" description="Paid orders appear here, grouped by dish." />
        )}

        <div className="grid gap-3 2xl:grid-cols-2">
          {batches.map((b, idx) => {
            const waited = minutesSince(b.oldest_paid_at, now);
            const tone = waited >= 10 ? "danger" : waited >= 5 ? "warning" : "normal";
            const cooking = b.status === "preparing";
            return (
              <article
                key={b.key}
                data-batch
                className={cn(
                  "flex flex-col gap-4 rounded-xl border-2 bg-card p-4 sm:p-5",
                  tone === "danger" ? "border-danger" : tone === "warning" ? "border-warning" : "border-border",
                )}
              >
                <div className="flex items-start gap-4">
                  <span className="token-num flex size-16 shrink-0 items-center justify-center rounded-lg bg-primary text-4xl text-primary-foreground sm:size-20 sm:text-5xl">
                    {b.total_quantity}
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      {idx === 0 && (
                        <span className="rounded-md bg-primary px-2 py-0.5 text-sm font-semibold text-primary-foreground">
                          Next
                        </span>
                      )}
                      <h2 className="text-xl font-semibold sm:text-2xl">{b.name}</h2>
                      {cooking && (
                        <span className="inline-flex items-center gap-1 rounded-md border border-foreground/40 px-2 py-0.5 text-sm font-medium">
                          <Flame className="size-3.5" aria-hidden /> Cooking
                        </span>
                      )}
                      {b.ready_made && <Badge variant="secondary">Ready made</Badge>}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 font-medium",
                          tone === "danger"
                            ? "bg-danger text-danger-foreground"
                            : tone === "warning"
                              ? "bg-warning text-warning-foreground"
                              : "bg-muted text-foreground",
                        )}
                      >
                        <Clock className="size-3.5" aria-hidden /> waiting {waited} min
                      </span>
                      <span className="text-muted-foreground">
                        window {formatTimeIST(b.window_start)}–{formatTimeIST(b.window_end)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-muted-foreground">Tokens</span>
                  {b.tokens.map((t) => (
                    <TokenChip key={t} token={t} size="sm" tone="muted" />
                  ))}
                </div>

                <div className="grid grid-cols-1 gap-2 sm:flex sm:justify-end">
                  {b.status === "pending" && (
                    <Button size="lg" variant="outline" disabled={busyKey !== null} onClick={() => act(b, "start")}>
                      {busyKey === b.key + "start" ? <Loader2 className="animate-spin" /> : <ChefHat />} Start cooking
                    </Button>
                  )}
                  <Button size="lg" variant="success" disabled={busyKey !== null} onClick={() => act(b, "ready")}>
                    {busyKey === b.key + "ready" ? <Loader2 className="animate-spin" /> : <CheckCheck />} Mark ready
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <aside className="flex h-fit flex-col gap-3 rounded-xl border bg-card p-5 lg:sticky lg:top-20">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Archive className="size-4" aria-hidden /> Spare pool
        </h2>
        {!data ? (
          <Skeleton className="h-16 w-full" />
        ) : data.spare_pool.length === 0 ? (
          <p className="text-sm text-muted-foreground">Empty. Uncollected food that holds well appears here.</p>
        ) : (
          <ul className="flex flex-col divide-y">
            {data.spare_pool.map((s) => (
              <li key={s.menu_item_id} className="flex items-center justify-between py-2">
                <span className="font-medium">{s.name}</span>
                <span className="token-num text-xl">{s.quantity}</span>
              </li>
            ))}
          </ul>
        )}
      </aside>
    </main>
  );
}

