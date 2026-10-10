import "server-only";
import { z } from "zod";
import { broadcast, canteenSignal, orderSignal } from "./realtime";

export const batchActionSchema = z.object({
  order_item_ids: z.array(z.uuid()).min(1).max(500),
});

/** After a kitchen action: kitchen, counter, TV and each affected student refetch. */
export async function signalOrders(canteenId: string, orderIds: string[], status: string) {
  await broadcast([canteenSignal(canteenId, "orders_changed"), ...orderIds.map((id) => orderSignal(id, status))]);
}
