import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { CANTEEN, STUDENT1, expectDbError, freshDb, one, setNow } from "../helpers/pg";

let db: PGlite;
const T0 = "2026-01-05T06:00:00Z";

beforeEach(async () => {
  db = await freshDb();
  await setNow(db, T0);
});

async function rotate() {
  return one<{ id: string; expires_at: Date; use_count: number; max_uses: number }>(
    db,
    "select * from rotate_entrance_code($1, $2, 'signed-token')",
    [CANTEEN, randomUUID()],
  );
}

async function newStudent(n: number) {
  const r = await one<{ id: string }>(
    db,
    `insert into profiles (full_name, role, id_card_code) values ($1, 'student', $2) returning id`,
    [`Student ${n}`, `card-code-${n}-${randomUUID()}`],
  );
  return r.id;
}

const scan = (codeId: string, studentId: string, canteen = CANTEEN) =>
  one<{ v: { reused: boolean; code_used_up: boolean; expires_at: string } }>(
    db,
    "select validate_entrance_scan($1, $2, $3) as v",
    [canteen, codeId, studentId],
  );

describe("entrance QR", () => {
  it("is valid for 60 seconds and 10 uses; the 11th scan is rejected", async () => {
    const code = await rotate();
    expect(code.max_uses).toBe(10);
    expect(new Date(code.expires_at).getTime() - new Date(T0).getTime()).toBe(60_000);

    for (let i = 1; i <= 10; i++) {
      const r = await scan(code.id, await newStudent(i));
      expect(r.v.reused).toBe(false);
      expect(r.v.code_used_up).toBe(i === 10);
    }
    await expectDbError(scan(code.id, await newStudent(11)), "QR_USED_UP");
    const after = await one<{ use_count: number }>(db, "select use_count from entrance_codes where id=$1", [code.id]);
    expect(after.use_count).toBe(10);
  });

  it("rotates to a new code once the old one is used up", async () => {
    const code = await rotate();
    expect((await rotate()).id).toBe(code.id); // still current: no new code
    await db.query("update entrance_codes set use_count = max_uses where id = $1", [code.id]);
    const next = await rotate();
    expect(next.id).not.toBe(code.id);
  });

  it("expires after 60 seconds, with a 5 second grace period", async () => {
    const code = await rotate();
    await setNow(db, "2026-01-05T06:01:04Z"); // 64 s: inside grace
    await scan(code.id, await newStudent(1));
    // the display already shows a new code
    expect((await rotate()).id).not.toBe(code.id);
    await setNow(db, "2026-01-05T06:01:06Z"); // 66 s: rejected
    await expectDbError(scan(code.id, await newStudent(2)), "QR_EXPIRED");
  });

  it("rejects a code from another canteen", async () => {
    const other = await one<{ id: string }>(db, "insert into canteens (name) values ('Other') returning id");
    const code = await rotate();
    await expectDbError(scan(code.id, STUDENT1, other.id), "QR_WRONG_CANTEEN");
    await expectDbError(scan(randomUUID(), STUDENT1), "QR_INVALID");
  });

  it("re-scanning with an active check-in returns it without using the code again", async () => {
    const code = await rotate();
    const first = await scan(code.id, STUDENT1);
    const second = await scan(code.id, STUDENT1);
    expect(second.v.reused).toBe(true);
    expect(second.v.expires_at).toBe(first.v.expires_at);
    const c = await one<{ use_count: number }>(db, "select use_count from entrance_codes where id=$1", [code.id]);
    expect(c.use_count).toBe(1);
  });

  it("check-in lasts checkin_minutes (10)", async () => {
    const code = await rotate();
    await scan(code.id, STUDENT1);
    await setNow(db, "2026-01-05T06:09:59Z");
    expect((await db.query("select * from active_checkin($1, $2)", [STUDENT1, CANTEEN])).rows).toHaveLength(1);
    await setNow(db, "2026-01-05T06:10:01Z");
    expect((await db.query("select * from active_checkin($1, $2)", [STUDENT1, CANTEEN])).rows).toHaveLength(0);
  });
});
