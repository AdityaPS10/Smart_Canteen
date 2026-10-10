"use client";

import { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useLiveData } from "@/hooks/use-live-data";
import { KioskError } from "@/components/kiosk-error";

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

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-white p-6 text-black">
      <h1 className="text-center text-3xl font-bold md:text-5xl">Scan to order</h1>
      <div className="rounded-2xl bg-white p-4 shadow-lg">
        {data ? (
          <QRCodeSVG value={data.url} size={420} level="M" marginSize={2} className="h-auto w-[min(80vw,60vh)]" />
        ) : (
          <div className="flex h-[min(80vw,60vh)] w-[min(80vw,60vh)] items-center justify-center text-xl">Loading…</div>
        )}
      </div>
      <p className="text-2xl tabular-nums md:text-3xl">New code in {seconds}s</p>
      <p className="text-center text-lg text-neutral-600">Use your phone camera or the app&apos;s Scan button.</p>
    </main>
  );
}
