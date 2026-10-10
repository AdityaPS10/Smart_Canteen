import { z } from "zod";
import { handle, json, parseBody, requireUser } from "@/lib/http";
import { startPayment } from "@/lib/order-service";

const bodySchema = z.object({ order_id: z.uuid() });

// POST /api/payments/retry  allowed only while attempts < payment_max_retries + 1 (checked atomically in SQL)
export const POST = handle(async (req: Request) => {
  const user = await requireUser(["student"]);
  const { order_id } = await parseBody(req, bodySchema);
  const payment = await startPayment(order_id, user.userId);
  return json({ payment });
});
