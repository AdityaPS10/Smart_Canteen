import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";

const root = path.resolve(__dirname, "..", "..");
const migrationsDir = path.join(root, "supabase", "migrations");

export const CANTEEN = "00000000-0000-4000-8000-000000000001";
export const STUDENT1 = "00000000-0000-4000-8000-000000000101";
export const STUDENT2 = "00000000-0000-4000-8000-000000000102";
export const SERVER = "00000000-0000-4000-8000-000000000201";
export const CASHIER = "00000000-0000-4000-8000-000000000301";
export const ITEM = {
  samosa: "00000000-0000-4000-8000-000000001001",
  vegPuff: "00000000-0000-4000-8000-000000001002",
  vada: "00000000-0000-4000-8000-000000001003",
  masalaDosa: "00000000-0000-4000-8000-000000001004",
  idli: "00000000-0000-4000-8000-000000001006",
  tea: "00000000-0000-4000-8000-000000001007",
  biscuit: "00000000-0000-4000-8000-000000001009",
  juice: "00000000-0000-4000-8000-000000001010",
};

/** A fresh in-process Postgres with every migration and the seed applied (no sample history by default). */
export async function freshDb(opts: { withSampleHistory?: boolean } = {}): Promise<PGlite> {
  const db = new PGlite();
  const files = readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort();
  for (const f of files) {
    await db.exec(readFileSync(path.join(migrationsDir, f), "utf8"));
  }
  let seed = readFileSync(path.join(root, "supabase", "seed.sql"), "utf8");
  if (!opts.withSampleHistory) seed = seed.split("-- BEGIN sample history")[0];
  await db.exec(seed);
  return db;
}

/** Time travel for SQL: app_now() returns this instant until reset. */
export async function setNow(db: PGlite, iso: string | null) {
  await db.query("select set_config('app.now', $1, false)", [iso ?? ""]);
}

export async function one<T = Record<string, unknown>>(db: PGlite, sql: string, params: unknown[] = []): Promise<T> {
  const r = await db.query<T>(sql, params);
  if (r.rows.length !== 1) throw new Error(`expected 1 row, got ${r.rows.length}: ${sql}`);
  return r.rows[0];
}

export async function rows<T = Record<string, unknown>>(db: PGlite, sql: string, params: unknown[] = []) {
  return (await db.query<T>(sql, params)).rows;
}

/** Expects the SQL to fail with a RAISEd code (message). */
export async function expectDbError(p: Promise<unknown>, code: string) {
  try {
    await p;
  } catch (e) {
    const msg = (e as Error).message;
    if (msg !== code) throw new Error(`expected ${code}, got: ${msg}`);
    return e as Error & { detail?: string };
  }
  throw new Error(`expected ${code}, but the call succeeded`);
}

/** Inserts an order directly (bypassing checks) for testing state machines. */
export async function insertOrder(
  db: PGlite,
  items: Array<{ menuItemId: string; quantity: number }>,
  opts: { studentId?: string; source?: "app" | "cashier" } = {},
): Promise<string> {
  const o = await one<{ id: string }>(
    db,
    `insert into orders (canteen_id, student_id, source, service_date, total_paise)
     values ($1, $2, $3, ist_date(app_now()), 0) returning id`,
    [CANTEEN, opts.source === "cashier" ? null : (opts.studentId ?? STUDENT1), opts.source ?? "app"],
  );
  for (const it of items) {
    await db.query(
      `insert into order_items (order_id, menu_item_id, name_snapshot, unit_price_paise, quantity)
       select $1, id, name, price_paise, $3 from menu_items where id = $2`,
      [o.id, it.menuItemId, it.quantity],
    );
  }
  return o.id;
}
