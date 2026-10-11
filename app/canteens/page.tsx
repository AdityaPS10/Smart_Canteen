import { AppHeader } from "@/components/app-header";
import { ActiveOrderLink } from "@/components/active-order-link";
import { PageHeader } from "@/components/page-header";
import { CanteenList } from "./canteen-list";

export default function CanteensPage() {
  return (
    <>
      <AppHeader />
      <main className="mx-auto flex max-w-xl flex-col gap-6 px-4 py-8">
        <ActiveOrderLink />
        <PageHeader title="Choose a canteen" description="Menus update live as dishes sell out." />
        <CanteenList />
      </main>
    </>
  );
}
