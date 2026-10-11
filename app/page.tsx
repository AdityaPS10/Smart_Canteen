import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { auth } from "@/auth";
import { landingFor } from "@/lib/access";
import { AppHeader } from "@/components/app-header";
import { ActiveOrderLink } from "@/components/active-order-link";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await auth();
  if (!session?.user?.role) redirect("/login");
  if (session.user.role !== "student") redirect(landingFor(session.user.role));

  return (
    <>
      <AppHeader />
      <main className="mx-auto flex max-w-xl flex-col gap-6 px-4 py-8">
        <PageHeader
          title={`Hi ${session.user.name?.split(" ")[0] ?? "there"}`}
          description="See what's available right now and order ahead."
        />
        <ActiveOrderLink />
        <Button asChild size="xl">
          <Link href="/canteens">
            Choose canteen and order <ArrowRight />
          </Link>
        </Button>
      </main>
    </>
  );
}
