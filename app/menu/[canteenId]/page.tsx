import { AppHeader } from "@/components/app-header";
import { MenuClient } from "./menu-client";

export default async function MenuPage({ params }: { params: Promise<{ canteenId: string }> }) {
  const { canteenId } = await params;
  return (
    <>
      <AppHeader links={[{ href: "/canteens", label: "Canteens" }]} />
      <MenuClient canteenId={canteenId} />
    </>
  );
}
