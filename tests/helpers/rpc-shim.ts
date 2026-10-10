import type { PGlite } from "@electric-sql/pglite";
import { AppError } from "@/lib/errors";

/**
 * Emulates supabase-js `rpc(fn, args)` (PostgREST) on PGlite so route handlers can run against the real SQL.
 * Raised errors keep their message/detail like PostgREST's { message, details }.
 */
export async function pgRpc(db: PGlite, fn: string, args: Record<string, unknown> = {}): Promise<unknown> {
  if (!/^[a-z_][a-z0-9_]*$/.test(fn)) throw new Error(`bad function name ${fn}`);
  const meta = (
    await db.query<{ retset: boolean; rt: string; typtype: string }>(
      `select p.proretset as retset, p.prorettype::regtype::text as rt, t.typtype
       from pg_proc p join pg_type t on t.oid = p.prorettype
       where p.proname = $1 and p.pronamespace = 'public'::regnamespace limit 1`,
      [fn],
    )
  ).rows[0];
  if (!meta) throw new Error(`function ${fn} not found`);

  const keys = Object.keys(args);
  const call = `${fn}(${keys.map((k, i) => `${k} => $${i + 1}`).join(", ")})`;
  const values = keys.map((k) => {
    const v = args[k];
    const isJson = v !== null && typeof v === "object" && (!Array.isArray(v) || v.some((x) => typeof x === "object"));
    return isJson ? JSON.stringify(v) : v;
  });

  try {
    const composite = meta.typtype === "c";
    if (meta.retset) {
      // setof <base type> -> values; setof <table> / RETURNS TABLE -> JSON objects (like PostgREST)
      const sql = meta.typtype === "b" ? `select t as j from ${call} t` : `select to_jsonb(t) as j from ${call} t`;
      return (await db.query<{ j: unknown }>(sql, values)).rows.map((r) => r.j);
    }
    if (composite) {
      return (await db.query<{ j: unknown }>(`select to_jsonb(t) as j from ${call} t`, values)).rows[0]?.j ?? null;
    }
    if (meta.rt === "void") {
      await db.query(`select ${call}`, values);
      return null;
    }
    return (await db.query<{ j: unknown }>(`select ${call} as j`, values)).rows[0]?.j ?? null;
  } catch (e) {
    // same conversion as lib/db.ts rpc()
    const err = e as Error & { detail?: string };
    throw AppError.fromDb({ message: err.message, details: err.detail ?? null });
  }
}
