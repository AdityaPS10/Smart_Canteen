import { AppHeader } from "@/components/app-header";
import { OrderClient } from "./order-client";

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <>
      <AppHeader links={[{ href: "/canteens", label: "Canteens" }]} />
      <OrderClient orderId={id} />
    </>
  );
}
