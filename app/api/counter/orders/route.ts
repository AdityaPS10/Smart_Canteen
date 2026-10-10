import { rpc } from "@/lib/db";
import { handle, json, requireStaff } from "@/lib/http";

// GET /api/counter/orders  food-server table rows (token, items, qty, status)
export const GET = handle(async () => {
  const user = await requireStaff(["food_server"]);
  const orders = await rpc<unknown[]>("counter_orders", { p_canteen_id: user.canteenId });
  return json({ orders });
});
