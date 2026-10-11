import { LoginPanel } from "@/components/login-panel";
import { isDemoMode, isGoogleConfigured } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function StaffLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const sp = await searchParams;
  return (
    <main className="flex min-h-dvh items-center justify-center bg-muted/40 px-4 py-10">
      <LoginPanel
        variant="staff"
        googleEnabled={isGoogleConfigured()}
        demoMode={isDemoMode()}
        callbackUrl={sp.callbackUrl}
        error={sp.error}
      />
    </main>
  );
}
