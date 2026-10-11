"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronRight, Store } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { fetchJson } from "@/hooks/use-live-data";

export function CanteenList() {
  const [canteens, setCanteens] = useState<Array<{ id: string; name: string }> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchJson<{ canteens: Array<{ id: string; name: string }> }>("/api/canteens")
      .then((d) => setCanteens(d.canteens))
      .catch((e: Error) => setError(e.message));
  }, []);

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }
  if (!canteens) {
    return (
      <div className="flex flex-col gap-3" aria-label="Loading canteens">
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-20 w-full rounded-xl" />
      </div>
    );
  }
  if (canteens.length === 0) {
    return <EmptyState icon={<Store />} title="No canteens are open" description="Please check again later." />;
  }

  return (
    <div className="flex flex-col gap-3">
      {canteens.map((c) => (
        <Link
          key={c.id}
          href={`/menu/${c.id}`}
          className="group flex items-center gap-4 rounded-xl border bg-card p-4 shadow-xs transition-colors hover:bg-accent"
        >
          <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-muted">
            <Store className="size-5" aria-hidden />
          </span>
          <span className="flex flex-1 flex-col">
            <span className="text-lg font-semibold">{c.name}</span>
            <span className="text-sm text-muted-foreground">View live menu</span>
          </span>
          <ChevronRight className="size-5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        </Link>
      ))}
    </div>
  );
}
