import { KioskError } from "@/components/kiosk-error";
import { TvMenu } from "./tv-menu";

export default async function TvMenuPage({
  searchParams,
}: {
  searchParams: Promise<{ canteen?: string; key?: string }>;
}) {
  const { canteen, key } = await searchParams;
  if (!canteen || !key) return <KioskError message="Missing ?canteen=ID&key=KIOSK_KEY" />;
  return <TvMenu canteenId={canteen} kioskKey={key} />;
}
