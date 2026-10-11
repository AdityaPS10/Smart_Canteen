"use client";

import { Zap } from "lucide-react";
import { useLiveData } from "@/hooks/use-live-data";
import { KioskError } from "@/components/kiosk-error";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPaise } from "@/lib/utils";
import type { PublicMenuItem } from "@/lib/types";

export function TvMenu({ canteenId, kioskKey }: { canteenId: string; kioskKey: string }) {
  const { data, error } = useLiveData<{ canteen: string; items: PublicMenuItem[] }>(
    `/api/tv/menu?canteen=${encodeURIComponent(canteenId)}&key=${encodeURIComponent(kioskKey)}`,
    [{ channel: `canteen:${canteenId}`, events: ["menu_changed"] }],
  );

  if (error?.status === 403) return <KioskError message="Invalid kiosk key." />;

  return (
    <main className="flex min-h-dvh flex-col gap-8 p-6 md:p-12">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b pb-6">
        <div className="flex flex-col gap-1">
          <p className="text-xl text-muted-foreground md:text-2xl">Available now</p>
          <h1 className="text-4xl font-semibold tracking-tight md:text-6xl">{data?.canteen ?? "Menu"}</h1>
        </div>
        <p className="flex items-center gap-2 text-lg text-muted-foreground md:text-xl">
          <Zap className="size-5" aria-hidden /> = ready to pick up
        </p>
      </header>

      {!data && (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
      )}
      {data && data.items.length === 0 && (
        <p className="text-3xl text-muted-foreground">Nothing available right now.</p>
      )}

      <ul className="grid gap-x-16 gap-y-1 md:grid-cols-2">
        {data?.items.map((i) => (
          <li
            key={i.id}
            className="flex items-baseline justify-between gap-6 border-b border-border py-4 text-3xl md:text-4xl"
          >
            <span className="flex items-center gap-3 font-semibold">
              {i.name}
              {i.ready_made && <Zap className="size-6 text-success md:size-7" aria-label="Ready to pick up" />}
            </span>
            <span className="shrink-0 tabular-nums text-muted-foreground">{formatPaise(i.price_paise)}</span>
          </li>
        ))}
      </ul>
    </main>
  );
}
