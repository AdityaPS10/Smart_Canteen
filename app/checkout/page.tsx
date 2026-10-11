import { AppHeader } from "@/components/app-header";
import { PageHeader } from "@/components/page-header";
import { CheckoutClient } from "./checkout-client";

export default async function CheckoutPage({ searchParams }: { searchParams: Promise<{ canteen?: string }> }) {
  const { canteen } = await searchParams;
  return (
    <>
      <AppHeader links={[{ href: "/canteens", label: "Canteens" }]} />
      <main className="mx-auto flex max-w-xl flex-col gap-5 px-4 py-8">
        <PageHeader title="Your order" description="Check the items, then pay by UPI." />
        {canteen ? <CheckoutClient canteenId={canteen} /> : <p>Choose a canteen first.</p>}
      </main>
    </>
  );
}
