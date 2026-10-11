import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppHeader } from "@/components/app-header";
import { KitchenDisplay } from "./kitchen-display";

export const dynamic = "force-dynamic";

export default async function KitchenPage() {
  const session = await auth();
  if (session?.user?.role !== "food_server" || !session.user.canteenId) redirect("/staff/login");
  return (
    // The kitchen display always uses the dark theme.
    <div className="dark min-h-dvh bg-background text-foreground">
      <AppHeader
        wide
        links={[
          { href: "/staff/counter", label: "Counter" },
          { href: "/staff/kitchen", label: "Kitchen" },
        ]}
      />
      <KitchenDisplay canteenId={session.user.canteenId} />
    </div>
  );
}
