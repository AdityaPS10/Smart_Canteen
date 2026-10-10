import { rpc } from "@/lib/db";
import { handle, json, requireKiosk } from "@/lib/http";
import { canteenIdSchema } from "@/lib/schemas";
import type { Canteen, PublicMenuItem } from "@/lib/types";

// GET /api/tv/menu?canteen=ID&key=KIOSK_KEY  (no personal data)
export const GET = handle(async (req: Request) => {
  requireKiosk(req);
  const canteenId = canteenIdSchema.parse(new URL(req.url).searchParams.get("canteen"));
  const [items, canteens] = await Promise.all([
    rpc<PublicMenuItem[]>("live_menu", { p_canteen_id: canteenId }),
    rpc<Canteen[]>("list_canteens"),
  ]);
  return json({ canteen: canteens.find((c) => c.id === canteenId)?.name ?? "Canteen", items });
});
