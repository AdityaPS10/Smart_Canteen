import { KioskError } from "@/components/kiosk-error";
import { EntranceDisplay } from "./entrance-display";

export default async function EntrancePage({
  searchParams,
}: {
  searchParams: Promise<{ canteen?: string; key?: string }>;
}) {
  const { canteen, key } = await searchParams;
  if (!canteen || !key) return <KioskError message="Missing ?canteen=ID&key=KIOSK_KEY" />;
  return <EntranceDisplay canteenId={canteen} kioskKey={key} />;
}
