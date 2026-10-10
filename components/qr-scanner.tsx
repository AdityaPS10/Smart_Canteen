"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { Html5Qrcode } from "html5-qrcode";
import { Camera, ImageUp } from "lucide-react";
import { Button } from "@/components/ui/button";

interface QrScannerProps {
  onResult: (text: string) => void;
  startLabel?: string;
  /** Start the camera immediately on mount. */
  autoStart?: boolean;
  disabled?: boolean;
}

/** Camera QR scanner (html5-qrcode). Also accepts a photo of the QR as a fallback. */
export function QrScanner({ onResult, startLabel = "Scan QR", autoStart = false, disabled }: QrScannerProps) {
  const rawId = useId();
  const regionId = "qr-" + rawId.replace(/[^a-zA-Z0-9]/g, "");
  const fileRegionId = regionId + "-file";
  const [active, setActive] = useState(autoStart);
  const [error, setError] = useState<string | null>(null);
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  useEffect(() => {
    if (!active) return;
    let scanner: Html5Qrcode | null = null;
    let done = false;
    setError(null);

    import("html5-qrcode").then(({ Html5Qrcode }) => {
      if (done) return;
      scanner = new Html5Qrcode(regionId, { verbose: false });
      scanner
        .start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          (text) => {
            if (done) return;
            done = true;
            scanner?.stop().catch(() => {});
            setActive(false);
            onResultRef.current(text);
          },
          () => {},
        )
        .catch(() => {
          setError("Camera not available. Allow camera access, or upload a photo of the QR.");
          setActive(false);
        });
    });

    return () => {
      done = true;
      if (scanner?.isScanning) scanner.stop().catch(() => {});
    };
  }, [active, regionId]);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    const { Html5Qrcode } = await import("html5-qrcode");
    const reader = new Html5Qrcode(fileRegionId, { verbose: false });
    try {
      const text = await reader.scanFile(file, false);
      onResultRef.current(text);
    } catch {
      setError("No QR code found in that image.");
    } finally {
      reader.clear();
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        id={regionId}
        className={active ? "w-full max-w-sm mx-auto overflow-hidden rounded-lg border" : "hidden"}
      />
      <div id={fileRegionId} className="hidden" />
      <div className="flex flex-wrap gap-2">
        {active ? (
          <Button type="button" variant="outline" onClick={() => setActive(false)}>
            Stop camera
          </Button>
        ) : (
          <Button type="button" onClick={() => setActive(true)} disabled={disabled}>
            <Camera /> {startLabel}
          </Button>
        )}
        <Button type="button" variant="outline" asChild disabled={disabled}>
          <label className="cursor-pointer">
            <ImageUp /> From photo
            <input type="file" accept="image/*" className="hidden" onChange={onFile} disabled={disabled} />
          </label>
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
