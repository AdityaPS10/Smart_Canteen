import { rpc } from "@/lib/db";
import { handle, json, requireKiosk } from "@/lib/http";
import { canteenIdSchema } from "@/lib/schemas";

// GET /api/tv/board?canteen=ID&key=KIOSK_KEY  token numbers only
export const GET = handle(async (req: Request) => {
  requireKiosk(req);
  const canteenId = canteenIdSchema.parse(new URL(req.url).searchParams.get("canteen"));
  const board = await rpc<{ in_queue: number[]; ready: number[] }>("tv_board", { p_canteen_id: canteenId });
  return json(board);
});
