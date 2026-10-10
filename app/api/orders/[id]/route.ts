import { z } from "zod";
import { rpc } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { handle, json, requireUser } from "@/lib/http";
import { env, paymentMode } from "@/lib/env";
import type { Order } from "@/lib/types";

interface OrderDetail {
  order: Order;
  items: unknown[];
  payments: unknown[];
  open_gateway_order_id: string | null;
  attempts_left: number;
}

// GET /api/orders/[id]  only the owner student, or staff of that canteen
export const GET = handle(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const id = z.uuid().parse((await ctx.params).id);
  const detail = await rpc<OrderDetail>("get_order", { p_order_id: id });
  const o = detail.order;

  const allowed =
    user.role === "student" ? o.student_id === user.userId : user.canteenId !== null && user.canteenId === o.canteen_id;
  if (!allowed) throw new AppError("ORDER_NOT_FOUND"); // do not reveal that it exists

  const { student_id: _omit, ...order } = o;
  void _omit;
  const mode = paymentMode();
  return json({
    ...detail,
    order,
    payment_mode: mode,
    razorpay_key_id: mode === "razorpay" ? env.razorpayKeyId() : null,
  });
});
