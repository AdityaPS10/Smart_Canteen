"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { UtensilsCrossed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { QrScanner } from "@/components/qr-scanner";

interface LoginPanelProps {
  variant: "student" | "staff";
  googleEnabled: boolean;
  demoMode: boolean;
  callbackUrl?: string;
  error?: string;
}

const DEMO_ROLES = [
  { role: "student", label: "Login as student" },
  { role: "food_server", label: "Login as food server" },
  { role: "cashier", label: "Login as cashier" },
] as const;

/** Only same-site relative paths are allowed as a post-login destination. */
function safeCallback(url?: string): string {
  return url && url.startsWith("/") && !url.startsWith("//") ? url : "/landing";
}

function Divider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 text-sm text-muted-foreground">
      <span className="h-px flex-1 bg-border" />
      {label}
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

export function LoginPanel({ variant, googleEnabled, demoMode, callbackUrl, error }: LoginPanelProps) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(
    error === "AccessDenied" ? "Use your college Google account." : error ? "Login failed. Try again." : null,
  );
  const target = safeCallback(callbackUrl);

  async function credentialsLogin(provider: "idcard" | "demo", fields: Record<string, string>) {
    setBusy(true);
    setMessage(null);
    const res = await signIn(provider, { ...fields, redirect: false });
    if (res?.error) {
      setBusy(false);
      setMessage(provider === "idcard" ? "This ID card is not registered." : "Demo login failed.");
      return;
    }
    window.location.assign(target);
  }

  const isStaff = variant === "staff";

  return (
    <div className="flex w-full max-w-md flex-col gap-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
          <UtensilsCrossed className="size-6" aria-hidden />
        </span>
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">{isStaff ? "Staff login" : "Smart Canteen"}</h1>
          <p className="text-sm text-muted-foreground sm:text-base">
            {isStaff ? "Food servers and cashiers: scan your staff ID card." : "Log in to see the live menu and order."}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-5 rounded-xl border bg-card p-5 shadow-sm sm:p-6">
        {message && (
          <Alert variant="destructive">
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        )}

        {googleEnabled && (
          <>
            <Button size="lg" variant="outline" disabled={busy} onClick={() => signIn("google", { redirectTo: target })}>
              Continue with Google {isStaff ? "" : "(college email)"}
            </Button>
            <Divider label="or" />
          </>
        )}

        <div className="flex flex-col gap-3">
          <p className="text-sm font-medium">{isStaff ? "Scan staff ID card QR" : "Scan college ID card QR"}</p>
          <QrScanner
            startLabel={isStaff ? "Scan staff ID card" : "Scan college ID card"}
            disabled={busy}
            onResult={(code) => credentialsLogin("idcard", { code: code.trim() })}
          />
        </div>

        {demoMode && (
          <div className="flex flex-col gap-3">
            <Divider label="Demo mode" />
            <div className="grid grid-cols-1 gap-2">
              {DEMO_ROLES.map((d) => (
                <Button
                  key={d.role}
                  variant="secondary"
                  disabled={busy}
                  onClick={() => credentialsLogin("demo", { role: d.role })}
                >
                  {d.label}
                </Button>
              ))}
            </div>
          </div>
        )}
      </div>

      <p className="text-center text-sm text-muted-foreground">
        {isStaff ? (
          <>
            Student?{" "}
            <a className="font-medium text-foreground underline underline-offset-4" href="/login">
              Student login
            </a>
          </>
        ) : (
          <>
            Canteen staff?{" "}
            <a className="font-medium text-foreground underline underline-offset-4" href="/staff/login">
              Staff login
            </a>
          </>
        )}
      </p>
    </div>
  );
}
