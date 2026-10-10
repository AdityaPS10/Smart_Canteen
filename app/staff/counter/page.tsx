import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppHeader } from "@/components/app-header";
import { CounterTable } from "./counter-table";

export const dynamic = "force-dynamic";

export default async function CounterPage() {
  const session = await auth();
  if (session?.user?.role !== "food_server" || !session.user.canteenId) redirect("/staff/login");
  return (
    <>
      <AppHeader
        links={[
          { href: "/staff/counter", label: "Counter" },
          { href: "/staff/kitchen", label: "Kitchen" },
        ]}
      />
      <main className="mx-auto max-w-5xl px-4 py-6">
        <h1 className="mb-4 text-2xl font-bold">Food server</h1>
        <CounterTable canteenId={session.user.canteenId} />
      </main>
    </>
  );
}
