import "server-only";
import { env } from "./env";

// Topic names. Messages carry no personal data: clients just refetch through the authenticated API.
export const canteenTopic = (canteenId: string) => `canteen:${canteenId}`;
export const orderTopic = (orderId: string) => `order:${orderId}`;

export type CanteenEvent = "orders_changed" | "menu_changed" | "entrance_changed";

interface Message {
  topic: string;
  event: string;
  payload: Record<string, string | number | boolean | null>;
}

/** Best-effort Supabase Realtime BROADCAST via the REST endpoint. Never throws:
 *  if Realtime is down, screens fall back to 5-second polling. */
export async function broadcast(messages: Message[]): Promise<void> {
  if (messages.length === 0) return;
  try {
    const res = await fetch(`${env.supabaseUrl()}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: env.serviceRoleKey(),
        Authorization: `Bearer ${env.serviceRoleKey()}`,
      },
      body: JSON.stringify({ messages: messages.map((m) => ({ ...m, private: false })) }),
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) console.warn("[realtime] broadcast failed", res.status);
  } catch (e) {
    console.warn("[realtime] broadcast error", (e as Error).message);
  }
}

export function canteenSignal(canteenId: string, event: CanteenEvent): Message {
  return { topic: canteenTopic(canteenId), event, payload: { at: Date.now() } };
}

export function orderSignal(orderId: string, status: string): Message {
  return { topic: orderTopic(orderId), event: "order_changed", payload: { status } };
}
