"use client";

import { useLiveData } from "@/hooks/use-live-data";
import { KioskError } from "@/components/kiosk-error";
import { formatPaise } from "@/lib/utils";
import type { PublicMenuItem } from "@/lib/types";

export function TvMenu({ canteenId, kioskKey }: { canteenId: string; kioskKey: string }) {
  const { data, error } = useLiveData<{ canteen: string; items: PublicMenuItem[] }>(
    `/api/tv/menu?canteen=${encodeURIComponent(canteenId)}&key=${encodeURIComponent(kioskKey)}`,
    [{ channel: `canteen:${canteenId}`, events: ["menu_changed"] }],
  );

  if (error?.status === 403) return <KioskError message="Invalid kiosk key." />;

  return (
    <main className="min-h-dvh p-6 md:p-10">
      <h1 className="mb-8 text-4xl font-bold md:text-6xl">{data?.canteen ?? "Menu"}</h1>
      {data && data.items.length === 0 && <p className="text-3xl text-muted-foreground">Nothing available right now.</p>}
      <ul className="grid gap-x-12 gap-y-4 md:grid-cols-2">
        {data?.items.map((i) => (
          <li key={i.id} className="flex items-baseline justify-between gap-4 border-b pb-3 text-3xl md:text-4xl">
            <span className="font-semibold">{i.name}</span>
            <span className="tabular-nums text-muted-foreground">{formatPaise(i.price_paise)}</span>
          </li>
        ))}
      </ul>
    </main>
  );
}
