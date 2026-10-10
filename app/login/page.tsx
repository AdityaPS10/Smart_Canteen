import { LoginPanel } from "@/components/login-panel";
import { isDemoMode, isGoogleConfigured } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const sp = await searchParams;
  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <LoginPanel
        variant="student"
        googleEnabled={isGoogleConfigured()}
        demoMode={isDemoMode()}
        callbackUrl={sp.callbackUrl}
        error={sp.error}
      />
    </main>
  );
}
