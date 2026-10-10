import "server-only";
import { rpc } from "./db";

export type Settings = Record<string, number>;

export async function getSettings(): Promise<Settings> {
  const raw = await rpc<Record<string, string>>("settings_json");
  const out: Settings = {};
  for (const [k, v] of Object.entries(raw)) out[k] = Number(v);
  return out;
}
