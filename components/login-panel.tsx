"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-2xl">{isStaff ? "Staff login" : "Smart Canteen"}</CardTitle>
        <CardDescription>
          {isStaff ? "Food servers and cashiers: scan your staff ID card." : "Log in to see the live menu and order."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {message && (
          <Alert variant="destructive">
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        )}

        {googleEnabled && (
          <Button size="lg" variant="outline" disabled={busy} onClick={() => signIn("google", { redirectTo: target })}>
            Continue with Google {isStaff ? "" : "(college email)"}
          </Button>
        )}

        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">{isStaff ? "Scan staff ID card QR" : "Scan college ID card QR"}</p>
          <QrScanner
            startLabel={isStaff ? "Scan staff ID card" : "Scan college ID card"}
            disabled={busy}
            onResult={(code) => credentialsLogin("idcard", { code: code.trim() })}
          />
        </div>

        {demoMode && (
          <div className="flex flex-col gap-2 border-t pt-4">
            <p className="text-xs text-muted-foreground">Demo mode</p>
            <div className="flex flex-wrap gap-2">
              {DEMO_ROLES.map((d) => (
                <Button
                  key={d.role}
                  size="sm"
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

        <p className="text-center text-sm text-muted-foreground">
          {isStaff ? (
            <a className="underline" href="/login">Student login</a>
          ) : (
            <a className="underline" href="/staff/login">Staff login</a>
          )}
        </p>
      </CardContent>
    </Card>
  );
}
