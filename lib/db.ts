import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "./env";
import { AppError } from "./errors";

let client: SupabaseClient | null = null;

/** Service-role client. Server only: route handlers and Auth.js callbacks. */
export function db(): SupabaseClient {
  if (!client) {
    client = createClient(env.supabaseUrl(), env.serviceRoleKey(), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

/** Calls one atomic Postgres function and converts its RAISEd code into an AppError. */
export async function rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await db().rpc(fn, args);
  if (error) throw AppError.fromDb(error);
  return data as T;
}
