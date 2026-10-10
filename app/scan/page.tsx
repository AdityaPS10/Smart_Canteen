import { AppHeader } from "@/components/app-header";
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
      <main className="mx-auto flex max-w-xl flex-col gap-4 px-4 py-6">
        <h1 className="text-2xl font-bold">Scan entrance QR</h1>
        <ScanClient initialToken={t} canteenId={canteen} />
      </main>
    </>
  );
}
