import { rpc } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { handle, json, parseBody, requireStaff, requireUser } from "@/lib/http";
import { broadcast, canteenSignal } from "@/lib/realtime";
import { canteenIdSchema, menuCreateSchema, menuUpdateSchema } from "@/lib/schemas";
import type { MenuItem, PublicMenuItem } from "@/lib/types";

// GET /api/menu?canteenId=...         live menu (stock > 0 and active) for any logged-in user
// GET /api/menu?canteenId=...&all=1   full menu with stock, cashier of that canteen only
export const GET = handle(async (req: Request) => {
  const user = await requireUser();
  const params = new URL(req.url).searchParams;
  const canteenId = canteenIdSchema.parse(params.get("canteenId"));

  if (params.get("all") === "1") {
    if (user.role !== "cashier" || user.canteenId !== canteenId) throw new AppError("FORBIDDEN");
    const items = await rpc<MenuItem[]>("staff_menu", { p_canteen_id: canteenId });
    return json({ items });
  }
  const items = await rpc<PublicMenuItem[]>("live_menu", { p_canteen_id: canteenId });
  return json({ items });
});

// POST /api/menu  cashier adds a dish together with its count
export const POST = handle(async (req: Request) => {
  const user = await requireStaff(["cashier"]);
  const body = await parseBody(req, menuCreateSchema);
  const item = await rpc<MenuItem>("menu_add_item", {
    p_canteen_id: user.canteenId,
    p_name: body.name,
    p_price_paise: body.price_paise,
    p_stock_count: body.stock_count,
    p_ready_made: body.ready_made,
    p_holds_well: body.holds_well,
    p_prep_minutes: body.prep_minutes,
  });
  await broadcast([canteenSignal(user.canteenId, "menu_changed")]);
  return json({ item }, { status: 201 });
});

// PATCH /api/menu  cashier edits price, count, flags, prep minutes
export const PATCH = handle(async (req: Request) => {
  const user = await requireStaff(["cashier"]);
  const body = await parseBody(req, menuUpdateSchema);
  const item = await rpc<MenuItem>("menu_update_item", {
    p_canteen_id: user.canteenId,
    p_id: body.id,
    p_name: body.name ?? null,
    p_price_paise: body.price_paise ?? null,
    p_stock_count: body.stock_count ?? null,
    p_ready_made: body.ready_made ?? null,
    p_holds_well: body.holds_well ?? null,
    p_prep_minutes: body.prep_minutes ?? null,
    p_active: body.active ?? null,
  });
  await broadcast([canteenSignal(user.canteenId, "menu_changed")]);
  return json({ item });
});
