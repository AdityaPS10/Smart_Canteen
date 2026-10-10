import { rpc } from "@/lib/db";
import { handle, json, requireUser } from "@/lib/http";
import type { Order } from "@/lib/types";

// GET /api/orders/active  the student's current order, for the Home link
export const GET = handle(async () => {
  const user = await requireUser(["student"]);
  const [o] = await rpc<Order[]>("active_order_for_student", { p_student_id: user.userId });
  return json({ order: o ? { id: o.id, status: o.status, token_number: o.token_number } : null });
});
