import { AppHeader } from "@/components/app-header";
import { ActiveOrderLink } from "@/components/active-order-link";
import { CanteenList } from "./canteen-list";

export default function CanteensPage() {
  return (
    <>
      <AppHeader />
      <main className="mx-auto flex max-w-xl flex-col gap-4 px-4 py-6">
        <ActiveOrderLink />
        <h1 className="text-2xl font-bold">Choose a canteen</h1>
        <CanteenList />
      </main>
    </>
  );
}
