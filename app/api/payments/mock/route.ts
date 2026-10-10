import { randomUUID } from "node:crypto";
import { z } from "zod";
import { rpc } from "@/lib/db";
import { paymentMode } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { handle, json, parseBody, requireUser } from "@/lib/http";
import { confirmPayment, failPayment } from "@/lib/order-service";

const bodySchema = z.object({
  order_id: z.uuid(),
  gateway_order_id: z.string().startsWith("mock_").max(80),
  result: z.enum(["success", "fail"]),
});

interface OrderDetail {
  order: { student_id: string; total_paise: number };
  open_gateway_order_id: string | null;
}

// POST /api/payments/mock  MOCK payment page buttons. Only exists when PAYMENT_MODE=mock (or Razorpay keys are
// missing). Goes through the same confirm_payment / fail_payment functions as the real webhook.
export const POST = handle(async (req: Request) => {
  if (paymentMode() !== "mock") throw new AppError("MOCK_DISABLED", 404, "Mock payments are disabled.");
  const user = await requireUser(["student"]);
  const body = await parseBody(req, bodySchema);

  const detail = await rpc<OrderDetail>("get_order", { p_order_id: body.order_id });
  if (detail.order.student_id !== user.userId) throw new AppError("ORDER_NOT_FOUND");
  if (detail.open_gateway_order_id !== body.gateway_order_id) throw new AppError("NOT_PENDING");

  if (body.result === "success") {
    const r = await confirmPayment(body.gateway_order_id, `mock_pay_${randomUUID()}`, detail.order.total_paise);
    return json({ result: r.result });
  }
  const r = await failPayment(body.gateway_order_id, "mock failure");
  return json({ result: r.result, attempts_left: r.attempts_left, status: r.status });
});
