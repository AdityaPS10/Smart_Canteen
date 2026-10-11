import { AppHeader } from "@/components/app-header";
import { PageHeader } from "@/components/page-header";
import { ScanClient } from "./scan-client";

export default async function ScanPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string; canteen?: string }>;
}) {
  const { t, canteen } = await searchParams;
  return (
    <>
      <AppHeader links={[{ href: "/canteens", label: "Canteens" }]} />
      <main className="mx-auto flex max-w-xl flex-col gap-5 px-4 py-8">
        <PageHeader
          title="Scan entrance QR"
          description="Point your camera at the QR on the display at the canteen entrance."
        />
        <ScanClient initialToken={t} canteenId={canteen} />
      </main>
    </>
  );
}
