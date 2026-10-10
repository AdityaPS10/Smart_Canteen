import { randomUUID } from "node:crypto";
import { rpc } from "@/lib/db";
import { env } from "@/lib/env";
import { signEntranceToken } from "@/lib/entrance-token";
import { handle, json, requireKiosk } from "@/lib/http";
import { broadcast, canteenSignal } from "@/lib/realtime";
import { canteenIdSchema } from "@/lib/schemas";
import { getSettings } from "@/lib/settings";

interface EntranceCode {
  id: string;
  token: string;
  expires_at: string;
}

// GET /api/entrance/current?canteen=ID&key=KIOSK_KEY
// Returns the code to show at the entrance, generating a new one when the previous expired or was used up.
// use_count is never returned.
export const GET = handle(async (req: Request) => {
  requireKiosk(req);
  const canteenId = canteenIdSchema.parse(new URL(req.url).searchParams.get("canteen"));

  let [code] = await rpc<EntranceCode[]>("current_entrance_code", { p_canteen_id: canteenId });
  if (!code) {
    const s = await getSettings();
    const codeId = randomUUID();
    const token = await signEntranceToken(env.qrSecret(), {
      canteenId,
      codeId,
      // JWT lifetime covers the TTL plus the grace period (+ small clock slack); the DB expiry is authoritative.
      validSeconds: s.qr_ttl_seconds + s.qr_grace_seconds + 5,
    });
    code = await rpc<EntranceCode>("rotate_entrance_code", {
      p_canteen_id: canteenId,
      p_code_id: codeId,
      p_token: token,
    });
    if (code.id === codeId) await broadcast([canteenSignal(canteenId, "entrance_changed")]);
  }

  return json({
    code_id: code.id,
    url: `${env.appUrl()}/scan?t=${encodeURIComponent(code.token)}`,
    expires_at: code.expires_at,
    server_now: new Date().toISOString(),
  });
});
