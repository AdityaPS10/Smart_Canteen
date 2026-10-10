import { z } from "zod";
import { rpc } from "@/lib/db";
import { handle, json, parseBody, requireStaff } from "@/lib/http";
import { signalOrders } from "@/lib/kitchen-actions";

const bodySchema = z.object({ order_id: z.uuid() });

// POST /api/counter/done  "Marked as done": READY -> GIVEN (rejected for any other status)
export const POST = handle(async (req: Request) => {
  const user = await requireStaff(["food_server"]);
  const { order_id } = await parseBody(req, bodySchema);
  const o = await rpc<{ id: string; status: string }>("mark_given", { p_canteen_id: user.canteenId, p_order_id: order_id });
  await signalOrders(user.canteenId, [o.id], o.status);
  return json({ order_id: o.id, status: o.status });
});
