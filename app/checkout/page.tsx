import { AppHeader } from "@/components/app-header";
import { CheckoutClient } from "./checkout-client";

export default async function CheckoutPage({ searchParams }: { searchParams: Promise<{ canteen?: string }> }) {
  const { canteen } = await searchParams;
  return (
    <>
      <AppHeader links={[{ href: "/canteens", label: "Canteens" }]} />
      <main className="mx-auto flex max-w-xl flex-col gap-4 px-4 py-6">
        <h1 className="text-2xl font-bold">Your order</h1>
        {canteen ? <CheckoutClient canteenId={canteen} /> : <p>Choose a canteen first.</p>}
      </main>
    </>
  );
}
