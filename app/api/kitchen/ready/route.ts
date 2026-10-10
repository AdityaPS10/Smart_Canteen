import { rpc } from "@/lib/db";
import { handle, json, parseBody, requireStaff } from "@/lib/http";
import { batchActionSchema, signalOrders } from "@/lib/kitchen-actions";

// POST /api/kitchen/ready  "Mark ready": items ready; orders whose items are all ready become READY
export const POST = handle(async (req: Request) => {
  const user = await requireStaff(["food_server"]);
  const body = await parseBody(req, batchActionSchema);
  const r = await rpc<{ order_ids: string[]; ready_order_ids: string[] }>("mark_batch_ready", {
    p_canteen_id: user.canteenId,
    p_order_item_ids: body.order_item_ids,
  });
  await signalOrders(user.canteenId, r.order_ids, "CHANGED");
  return json(r);
});
