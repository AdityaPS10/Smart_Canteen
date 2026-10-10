import { z } from "zod";
import { rpc } from "@/lib/db";
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { extractEntranceToken, verifyEntranceToken } from "@/lib/entrance-token";
import { handle, json, parseBody, requireUser } from "@/lib/http";
import { broadcast, canteenSignal } from "@/lib/realtime";

const bodySchema = z.object({
  token: z.string().min(10).max(4000),
  // The canteen the student is ordering from, if known (wrong-canteen check).
  canteen_id: z.uuid().optional(),
});

interface ScanResult {
  checkin_id: string;
  canteen_id: string;
  expires_at: string;
  reused: boolean;
  code_used_up: boolean;
}

// POST /api/scan/validate  student scans the entrance QR -> check-in
export const POST = handle(async (req: Request) => {
  const user = await requireUser(["student"]);
  const body = await parseBody(req, bodySchema);

  const { canteenId, codeId } = await verifyEntranceToken(env.qrSecret(), extractEntranceToken(body.token));
  if (body.canteen_id && body.canteen_id !== canteenId) throw new AppError("QR_WRONG_CANTEEN");

  const result = await rpc<ScanResult>("validate_entrance_scan", {
    p_canteen_id: canteenId,
    p_code_id: codeId,
    p_student_id: user.userId,
  });
  // The 10th use retires the code: tell the entrance display to show a new one.
  if (result.code_used_up) await broadcast([canteenSignal(canteenId, "entrance_changed")]);

  return json({ canteen_id: result.canteen_id, expires_at: result.expires_at, reused: result.reused });
});
