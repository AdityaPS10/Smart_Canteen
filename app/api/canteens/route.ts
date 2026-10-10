import { rpc } from "@/lib/db";
import { handle, json, requireUser } from "@/lib/http";
import type { Canteen } from "@/lib/types";

export const GET = handle(async () => {
  await requireUser();
  const canteens = await rpc<Canteen[]>("list_canteens");
  return json({ canteens: canteens.map((c) => ({ id: c.id, name: c.name })) });
});
