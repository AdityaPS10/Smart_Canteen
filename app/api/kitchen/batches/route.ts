import { rpc } from "@/lib/db";
import { handle, json, requireStaff } from "@/lib/http";
import { kitchenQueue, type KitchenItem } from "@/lib/kitchen";
import { getSettings } from "@/lib/settings";

// GET /api/kitchen/batches  grouped + prioritized cooking work, and the spare pool
export const GET = handle(async () => {
  const user = await requireStaff(["food_server"]);
  const [items, spare, settings] = await Promise.all([
    rpc<KitchenItem[]>("kitchen_items", { p_canteen_id: user.canteenId }),
    rpc<Array<{ menu_item_id: string; name: string; quantity: number }>>("spare_pool_summary", {
      p_canteen_id: user.canteenId,
    }),
    getSettings(),
  ]);
  const windowMinutes = settings.grouping_window_minutes;
  return json({
    batches: kitchenQueue(items, windowMinutes),
    spare_pool: spare,
    window_minutes: windowMinutes,
    server_now: new Date().toISOString(),
  });
});
