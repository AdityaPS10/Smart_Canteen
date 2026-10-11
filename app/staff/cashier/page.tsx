import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppHeader } from "@/components/app-header";
import { PageHeader } from "@/components/page-header";
import { CashierDashboard } from "./cashier-dashboard";

export const dynamic = "force-dynamic";

export default async function CashierPage() {
  const session = await auth();
  if (session?.user?.role !== "cashier" || !session.user.canteenId) redirect("/staff/login");
  return (
    <>
      <AppHeader />
      <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 sm:py-8">
        <PageHeader eyebrow="Main canteen" title="Cash Counter" description="Take cash orders, keep the menu and stock up to date." />
        <CashierDashboard canteenId={session.user.canteenId} />
      </main>
    </>
  );
}
