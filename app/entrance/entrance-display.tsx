"use client";

import { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { QrCode } from "lucide-react";
import { useLiveData } from "@/hooks/use-live-data";
import { KioskError } from "@/components/kiosk-error";
import { Skeleton } from "@/components/ui/skeleton";

interface Current {
  code_id: string;
  url: string;
  expires_at: string;
  server_now: string;
}

export function EntranceDisplay({ canteenId, kioskKey }: { canteenId: string; kioskKey: string }) {
  const { data, error, reload } = useLiveData<Current>(
    `/api/entrance/current?canteen=${encodeURIComponent(canteenId)}&key=${encodeURIComponent(kioskKey)}`,
    [{ channel: `canteen:${canteenId}`, events: ["entrance_changed"] }],
  );
  const [now, setNow] = useState(() => Date.now());
  const offset = useRef(0);
  const refreshedFor = useRef<string | null>(null);

  // Align the countdown with the server clock.
  useEffect(() => {
    if (data) offset.current = Date.parse(data.server_now) - Date.now();
  }, [data]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  const remainingMs = data ? Date.parse(data.expires_at) - (now + offset.current) : 0;
  const seconds = Math.max(0, Math.ceil(remainingMs / 1000));

  // When the countdown ends, fetch the next code (once per code).
  useEffect(() => {
    if (data && remainingMs <= 0 && refreshedFor.current !== data.code_id) {
      refreshedFor.current = data.code_id;
      reload();
    }
  }, [data, remainingMs, reload]);

  if (error?.status === 403) return <KioskError message="Invalid kiosk key." />;

  // Fraction of this code's lifetime left, for the countdown bar.
  const totalMs = data ? Math.max(1000, Date.parse(data.expires_at) - Date.parse(data.server_now)) : 1;
  const left = data ? Math.min(1, Math.max(0, remainingMs / totalMs)) : 0;

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 p-6 md:gap-8">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="flex items-center gap-3 text-4xl font-semibold tracking-tight md:text-6xl">
          <QrCode className="size-9 md:size-14" aria-hidden /> Scan to order
        </h1>
        <p className="text-lg text-muted-foreground md:text-2xl">Use your phone camera or the app&apos;s Scan button.</p>
      </div>

      {/* QR needs dark modules on a light field to scan reliably: light panel from the theme tokens. */}
      <div className="rounded-3xl bg-foreground p-5 text-background shadow-2xl md:p-6">
        {data ? (
          <QRCodeSVG
            value={data.url}
            size={420}
            level="M"
            marginSize={2}
            fgColor="currentColor"
            bgColor="transparent"
            className="h-auto w-[min(80vw,58vh)]"
          />
        ) : (
          <Skeleton className="aspect-square w-[min(80vw,58vh)] bg-background/10" />
        )}
      </div>

      <div className="flex w-[min(80vw,58vh)] flex-col items-center gap-3">
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
          <div
            className="h-full rounded-full bg-foreground transition-[width] duration-300 ease-linear"
            style={{ width: `${left * 100}%` }}
          />
        </div>
        <p className="text-2xl tabular-nums md:text-3xl" aria-live="polite">
          New code in <span className="token-num">{seconds}</span>s
        </p>
      </div>
    </main>
  );
}
