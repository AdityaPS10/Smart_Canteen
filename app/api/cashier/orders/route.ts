import { z } from "zod";
import { rpc } from "@/lib/db";
import { handle, json, parseBody, requireStaff } from "@/lib/http";
import { afterTokenCreated } from "@/lib/order-service";
import { cartSchema, normalizeCart } from "@/lib/schemas";

const bodySchema = z.object({
  items: cartSchema,
  customer_name: z.string().trim().max(60).optional(),
  client_request_id: z.uuid(),
});

interface CashResult {
  order_id: string;
  created: boolean;
  status: string;
  token_number: number;
  canteen_id?: string;
}

// POST /api/cashier/orders  "Cash received": PAID with a cash payment row, token and bill created
export const POST = handle(async (req: Request) => {
  const user = await requireStaff(["cashier"]);
  const body = await parseBody(req, bodySchema);
  const r = await rpc<CashResult>("cashier_create_order", {
    p_canteen_id: user.canteenId,
    p_cashier_id: user.userId,
    p_items: normalizeCart(body.items),
    p_customer_name: body.customer_name ?? null,
    p_client_request_id: body.client_request_id,
  });
  if (r.created) await afterTokenCreated(r.order_id, user.canteenId, r.status);
  const detail = await rpc<unknown>("get_order", { p_order_id: r.order_id });
  return json(detail, { status: r.created ? 201 : 200 });
});
