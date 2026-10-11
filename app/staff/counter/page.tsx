import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppHeader } from "@/components/app-header";
import { PageHeader } from "@/components/page-header";
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
      <main className="mx-auto flex max-w-5xl flex-col gap-5 px-4 py-6 sm:py-8">
        <PageHeader
          eyebrow="Food server"
          title="Counter"
          description="Find the student's token and press Marked as done when you hand the food over."
        />
        <CounterTable canteenId={session.user.canteenId} />
      </main>
    </>
  );
}
