import { z } from "zod";
import { rpc } from "@/lib/db";
import { handle, json, parseBody, requireUser } from "@/lib/http";
import { cartSchema, normalizeCart } from "@/lib/schemas";

const bodySchema = z.object({ canteen_id: z.uuid(), items: cartSchema });

// POST /api/orders/preview  -> server-calculated lines and total + whether the entrance QR was scanned
export const POST = handle(async (req: Request) => {
  const user = await requireUser(["student"]);
  const body = await parseBody(req, bodySchema);
  const [preview, checkins] = await Promise.all([
    rpc<{ lines: unknown[]; total_paise: number }>("preview_cart", {
      p_canteen_id: body.canteen_id,
      p_items: normalizeCart(body.items),
    }),
    rpc<Array<{ expires_at: string }>>("active_checkin", { p_student_id: user.userId, p_canteen_id: body.canteen_id }),
  ]);
  return json({
    lines: preview.lines,
    total_paise: preview.total_paise,
    checked_in: checkins.length > 0,
    checkin_expires_at: checkins[0]?.expires_at ?? null,
  });
});
