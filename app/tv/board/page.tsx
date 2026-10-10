import { KioskError } from "@/components/kiosk-error";
import { TvBoard } from "./tv-board";

export default async function TvBoardPage({
  searchParams,
}: {
  searchParams: Promise<{ canteen?: string; key?: string }>;
}) {
  const { canteen, key } = await searchParams;
  if (!canteen || !key) return <KioskError message="Missing ?canteen=ID&key=KIOSK_KEY" />;
  return <TvBoard canteenId={canteen} kioskKey={key} />;
}
