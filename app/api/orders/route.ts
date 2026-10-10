import { z } from "zod";
import { rpc } from "@/lib/db";
import { handle, json, parseBody, requireUser } from "@/lib/http";
import { paymentInfo, startPayment } from "@/lib/order-service";
import { broadcast, canteenSignal } from "@/lib/realtime";
import { cartSchema, normalizeCart } from "@/lib/schemas";

const bodySchema = z.object({
  canteen_id: z.uuid(),
  items: cartSchema,
  client_request_id: z.uuid(),
});

interface PlaceResult {
  order_id: string;
  created: boolean;
  total_paise: number;
  status: string;
}

// POST /api/orders  student order: needs a valid check-in (checked in SQL). Only menu_item_id + quantity
// are accepted; the total comes from the server's prices. Creates the order PENDING_PAYMENT, reserves
// stock, then opens a payment attempt for the server total.
export const POST = handle(async (req: Request) => {
  const user = await requireUser(["student"]);
  const body = await parseBody(req, bodySchema);

  const placed = await rpc<PlaceResult>("place_order", {
    p_canteen_id: body.canteen_id,
    p_student_id: user.userId,
    p_items: normalizeCart(body.items),
    p_client_request_id: body.client_request_id,
  });

  if (placed.created) await broadcast([canteenSignal(body.canteen_id, "menu_changed")]);

  if (placed.status !== "PENDING_PAYMENT") {
    return json({ order_id: placed.order_id, total_paise: placed.total_paise, payment: null });
  }

  // Double-click / resubmit: reuse the attempt that is already open instead of starting another.
  if (!placed.created) {
    const existing = await rpc<{ open_gateway_order_id: string | null }>("get_order", { p_order_id: placed.order_id });
    if (existing.open_gateway_order_id) {
      return json({
        order_id: placed.order_id,
        total_paise: placed.total_paise,
        payment: paymentInfo(placed.order_id, existing.open_gateway_order_id, placed.total_paise),
      });
    }
  }

  const payment = await startPayment(placed.order_id, user.userId);
  return json({ order_id: placed.order_id, total_paise: placed.total_paise, payment }, { status: 201 });
});
