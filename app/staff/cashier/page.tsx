import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppHeader } from "@/components/app-header";
import { CashierDashboard } from "./cashier-dashboard";

export const dynamic = "force-dynamic";

export default async function CashierPage() {
  const session = await auth();
  if (session?.user?.role !== "cashier" || !session.user.canteenId) redirect("/staff/login");
  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-6xl px-4 py-6">
        <h1 className="mb-4 text-2xl font-bold">Cash Counter</h1>
        <CashierDashboard canteenId={session.user.canteenId} />
      </main>
    </>
  );
}
