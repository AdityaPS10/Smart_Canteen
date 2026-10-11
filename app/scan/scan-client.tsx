"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CircleCheck, Loader2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { QrScanner } from "@/components/qr-scanner";
import { fetchJson } from "@/hooks/use-live-data";
import { readCart } from "@/lib/cart";
import { formatTimeIST } from "@/lib/utils";

interface ScanResponse {
  canteen_id: string;
  expires_at: string;
  reused: boolean;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function ScanClient({ initialToken, canteenId }: { initialToken?: string; canteenId?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<ScanResponse | null>(null);
  const started = useRef(false);
  const expectedCanteen = canteenId && UUID_RE.test(canteenId) ? canteenId : undefined;

  const validate = useCallback(
    async (token: string) => {
      setBusy(true);
      setError(null);
      try {
        const res = await fetchJson<ScanResponse>("/api/scan/validate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, canteen_id: expectedCanteen }),
        });
        setDone(res);
        // Continue where the student left off, with the cart intact.
        const hasCart = Object.keys(readCart(res.canteen_id)).length > 0;
        setTimeout(
          () => router.replace(hasCart ? `/checkout?canteen=${res.canteen_id}` : `/menu/${res.canteen_id}`),
          900,
        );
      } catch (e) {
        setError((e as Error).message);
        setBusy(false);
      }
    },
    [expectedCanteen, router],
  );

  // Opened from the phone camera as /scan?t=TOKEN
  useEffect(() => {
    if (initialToken && !started.current) {
      started.current = true;
      validate(initialToken);
    }
  }, [initialToken, validate]);

  if (done) {
    return (
      <Alert variant="success">
        <AlertTitle className="flex items-center gap-2">
          <CircleCheck className="size-4 text-success" aria-hidden /> Checked in
        </AlertTitle>
        <AlertDescription>You can order until {formatTimeIST(done.expires_at)}. Continuing…</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-xs">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {busy ? (
        <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground" role="status">
          <Loader2 className="size-5 animate-spin" aria-hidden /> Checking the code…
        </div>
      ) : (
        <QrScanner autoStart={!initialToken} startLabel="Scan entrance QR" onResult={validate} />
      )}
      <p className="text-sm text-muted-foreground">Can&apos;t scan? Order at the cashier.</p>
    </div>
  );
}
