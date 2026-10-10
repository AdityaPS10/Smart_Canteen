"use client";

import { useLiveData } from "@/hooks/use-live-data";
import { KioskError } from "@/components/kiosk-error";

export function TvBoard({ canteenId, kioskKey }: { canteenId: string; kioskKey: string }) {
  const { data, error } = useLiveData<{ in_queue: number[]; ready: number[] }>(
    `/api/tv/board?canteen=${encodeURIComponent(canteenId)}&key=${encodeURIComponent(kioskKey)}`,
    [{ channel: `canteen:${canteenId}`, events: ["orders_changed"] }],
  );

  if (error?.status === 403) return <KioskError message="Invalid kiosk key." />;

  return (
    <main className="grid min-h-dvh grid-cols-1 md:grid-cols-2">
      <section className="flex flex-col gap-6 p-6 md:p-10">
        <h2 className="text-4xl font-bold text-muted-foreground md:text-6xl">In queue</h2>
        <div className="flex flex-wrap gap-4">
          {data?.in_queue.map((t) => (
            <span key={t} className="rounded-xl border-2 px-5 py-2 text-5xl font-bold tabular-nums md:text-7xl">
              {t}
            </span>
          ))}
        </div>
      </section>
      <section className="flex flex-col gap-6 bg-success/15 p-6 md:p-10">
        <h2 className="text-4xl font-bold text-success md:text-6xl">Ready</h2>
        <div className="flex flex-wrap gap-4">
          {data?.ready.map((t) => (
            <span
              key={t}
              className="rounded-xl bg-success px-5 py-2 text-5xl font-black tabular-nums text-white md:text-8xl"
            >
              {t}
            </span>
          ))}
        </div>
      </section>
    </main>
  );
}
