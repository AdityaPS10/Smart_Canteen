import { rpc } from "@/lib/db";
import { handle, json, requireStaff } from "@/lib/http";

// GET /api/cashier/payments  today's cash payments (time, token, amount, cashier) with running total
export const GET = handle(async () => {
  const user = await requireStaff(["cashier"]);
  const log = await rpc<unknown>("cashier_payments", { p_canteen_id: user.canteenId });
  return json(log);
});
