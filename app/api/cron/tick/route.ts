import { NextResponse } from "next/server";
import { rpc } from "@/lib/db";
import { env } from "@/lib/env";
import { handle, safeEqual } from "@/lib/http";
import { mlHasModel, retrainModel } from "@/lib/prediction";
import { broadcast, canteenSignal, orderSignal } from "@/lib/realtime";

interface TickResult {
  payment_timeouts: string[];
  expired: string[];
  extended: number;
  spare_pool: number;
  wasted: number;
  canteen_ids: string[];
  completed_orders: number;
  retrain_due: boolean;
}

// POST /api/cron/tick  (Authorization: Bearer CRON_SECRET) runs process_tick() and notifies screens.
export const POST = handle(async (req: Request) => {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token || !safeEqual(token, env.cronSecret())) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }

  const r = await rpc<TickResult>("process_tick");

  await broadcast([
    ...r.canteen_ids.flatMap((id) => [canteenSignal(id, "orders_changed"), canteenSignal(id, "menu_changed")]),
    ...r.payment_timeouts.map((id) => orderSignal(id, "PAYMENT_FAILED")),
    ...r.expired.map((id) => orderSignal(id, "EXPIRED")),
  ]);

  // Auto-retrain after every ml_retrain_every_orders newly completed orders (and once at start, if the
  // ML service has no model yet, so it learns from the sample history).
  let retrained: boolean | null = null;
  if (r.retrain_due || (await mlHasModel()) === false) {
    retrained = await retrainModel(r.completed_orders);
  }

  return NextResponse.json({ ...r, retrained });
});
