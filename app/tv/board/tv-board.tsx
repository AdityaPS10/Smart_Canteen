"use client";

import { BellRing, Clock } from "lucide-react";
import { useLiveData } from "@/hooks/use-live-data";
import { KioskError } from "@/components/kiosk-error";
import { Skeleton } from "@/components/ui/skeleton";

export function TvBoard({ canteenId, kioskKey }: { canteenId: string; kioskKey: string }) {
  const { data, error } = useLiveData<{ in_queue: number[]; ready: number[] }>(
    `/api/tv/board?canteen=${encodeURIComponent(canteenId)}&key=${encodeURIComponent(kioskKey)}`,
    [{ channel: `canteen:${canteenId}`, events: ["orders_changed"] }],
  );

  if (error?.status === 403) return <KioskError message="Invalid kiosk key." />;

  return (
    <main className="grid min-h-dvh grid-cols-1 md:grid-cols-[2fr_3fr]">
      <section className="flex flex-col gap-6 border-b p-6 md:border-b-0 md:border-r md:p-10">
        <h2 className="flex items-center gap-3 text-3xl font-semibold text-muted-foreground md:text-5xl">
          <Clock className="size-8 md:size-12" aria-hidden /> In queue
        </h2>
        {!data && <Skeleton className="h-24 w-2/3" />}
        {data && data.in_queue.length === 0 && <p className="text-2xl text-muted-foreground">No orders waiting.</p>}
        <div className="flex flex-wrap gap-3 md:gap-4">
          {data?.in_queue.map((t) => (
            <span
              key={t}
              className="token-num flex min-w-20 items-center justify-center rounded-xl border-2 border-foreground/50 px-4 py-3 text-5xl md:min-w-28 md:text-7xl 2xl:min-w-36 2xl:text-8xl"
            >
              {t}
            </span>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-6 bg-success/10 p-6 md:p-10">
        <h2 className="flex items-center gap-3 text-3xl font-semibold text-success md:text-5xl">
          <BellRing className="size-8 md:size-12" aria-hidden /> Ready
        </h2>
        {!data && <Skeleton className="h-32 w-2/3" />}
        {data && data.ready.length === 0 && <p className="text-2xl text-muted-foreground">Nothing ready yet.</p>}
        <div className="flex flex-wrap gap-4 md:gap-6">
          {data?.ready.map((t) => (
            <span
              key={t}
              className="token-num flex min-w-24 items-center justify-center rounded-2xl bg-success px-5 py-4 text-6xl text-success-foreground md:min-w-36 md:text-8xl 2xl:min-w-48 2xl:text-9xl"
            >
              {t}
            </span>
          ))}
        </div>
        {data && data.ready.length > 0 && (
          <p className="mt-auto text-xl text-muted-foreground md:text-2xl">Show your token at the counter to collect.</p>
        )}
      </section>
    </main>
  );
}
