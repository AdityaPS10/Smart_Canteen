import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { CANTEEN, CASHIER, ITEM, SERVER, STUDENT1, freshDb, one } from "../helpers/pg";
import { pgRpc } from "../helpers/rpc-shim";

// The whole main flow through the real route handlers + real SQL (PGlite). No network.
let db: PGlite;
type U = { userId: string; role: string; canteenId: string | null; name: string } | null;
let currentUser: U = null;
vi.mock("@/lib/db", () => ({ rpc: (fn: string, args?: Record<string, unknown>) => pgRpc(db, fn, args) }));
vi.mock("@/auth", () => ({ auth: async () => (currentUser ? { user: currentUser } : null) }));

Object.assign(process.env, {
  NEXT_PUBLIC_SUPABASE_URL: "http://supabase.invalid",
  SUPABASE_SERVICE_ROLE_KEY: "test",
  QR_SECRET: "qr-secret-for-tests-qr-secret-for-tests",
  KIOSK_KEY: "kiosk-key",
  CRON_SECRET: "cron-secret",
  APP_URL: "https://canteen.test",
  PAYMENT_MODE: "mock",
});
delete process.env.ML_URL;

const as = {
  student: () => (currentUser = { userId: STUDENT1, role: "student", canteenId: null, name: "Demo Student One" }),
  server: () => (currentUser = { userId: SERVER, role: "food_server", canteenId: CANTEEN, name: "Demo Food Server" }),
  cashier: () => (currentUser = { userId: CASHIER, role: "cashier", canteenId: CANTEEN, name: "Demo Cashier" }),
};

const routes = {
  entrance: () => import("@/app/api/entrance/current/route"),
  scan: () => import("@/app/api/scan/validate/route"),
  preview: () => import("@/app/api/orders/preview/route"),
  orders: () => import("@/app/api/orders/route"),
  order: () => import("@/app/api/orders/[id]/route"),
  mockPay: () => import("@/app/api/payments/mock/route"),
  retry: () => import("@/app/api/payments/retry/route"),
  batches: () => import("@/app/api/kitchen/batches/route"),
  start: () => import("@/app/api/kitchen/start/route"),
  ready: () => import("@/app/api/kitchen/ready/route"),
  counter: () => import("@/app/api/counter/orders/route"),
  done: () => import("@/app/api/counter/done/route"),
  board: () => import("@/app/api/tv/board/route"),
  cashOrder: () => import("@/app/api/cashier/orders/route"),
  cashLog: () => import("@/app/api/cashier/payments/route"),
  menu: () => import("@/app/api/menu/route"),
};

const post = (body: unknown, url = "http://localhost/x") =>
  new Request(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const get = (url = "http://localhost/x") => new Request(url);
async function call(res: Promise<Response> | Response) {
  const r = await res;
  return { status: r.status, body: await r.json() };
}

beforeAll(async () => {
  db = await freshDb();
  vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 200 })));
});

describe("main flow through the API", () => {
  let orderId = "";
  let gatewayOrderId = "";
  const cart = [
    { menu_item_id: ITEM.masalaDosa, quantity: 2, price_paise: 1 }, // client price is ignored
    { menu_item_id: ITEM.juice, quantity: 1 },
  ];

  it("blocks ordering until the entrance QR is scanned (checked on the server)", async () => {
    as.student();
    const pre = await call((await routes.preview()).POST(post({ canteen_id: CANTEEN, items: cart })));
    expect(pre.status).toBe(200);
    expect(pre.body.checked_in).toBe(false);
    expect(pre.body.total_paise).toBe(2 * 5000 + 2500);

    const res = await call((await routes.orders()).POST(post({ canteen_id: CANTEEN, items: cart, client_request_id: randomUUID() })));
    expect(res.status).toBe(403);
    expect(res.body.error).toBe("NO_CHECKIN");
  });

  it("entrance display needs the kiosk key and never shows use_count", async () => {
    const bad = await call((await routes.entrance()).GET(get(`http://localhost/api/entrance/current?canteen=${CANTEEN}&key=nope`)));
    expect(bad.status).toBe(403);
    const ok = await call((await routes.entrance()).GET(get(`http://localhost/api/entrance/current?canteen=${CANTEEN}&key=kiosk-key`)));
    expect(ok.status).toBe(200);
    expect(ok.body.url).toMatch(/^https:\/\/canteen\.test\/scan\?t=/);
    expect(ok.body).not.toHaveProperty("use_count");

    as.student();
    const scanned = await call((await routes.scan()).POST(post({ token: ok.body.url, canteen_id: CANTEEN })));
    expect(scanned.status).toBe(200);
    expect(scanned.body.reused).toBe(false);
  });

  it("orders with the server total, then pays via the MOCK page", async () => {
    as.student();
    const res = await call((await routes.orders()).POST(post({ canteen_id: CANTEEN, items: cart, client_request_id: randomUUID() })));
    expect(res.status).toBe(201);
    expect(res.body.total_paise).toBe(12500);
    expect(res.body.payment.mode).toBe("mock");
    orderId = res.body.order_id;
    gatewayOrderId = res.body.payment.gateway_order_id;

    // the first attempt fails, a retry succeeds
    const fail = await call((await routes.mockPay()).POST(post({ order_id: orderId, gateway_order_id: gatewayOrderId, result: "fail" })));
    expect(fail.body).toMatchObject({ result: "failed", attempts_left: 2, status: "PENDING_PAYMENT" });
    const retry = await call((await routes.retry()).POST(post({ order_id: orderId })));
    expect(retry.status).toBe(200);
    gatewayOrderId = retry.body.payment.gateway_order_id;

    const ok = await call((await routes.mockPay()).POST(post({ order_id: orderId, gateway_order_id: gatewayOrderId, result: "success" })));
    expect(ok.body.result).toBe("confirmed");

    const detail = await call((await routes.order()).GET(get(), { params: Promise.resolve({ id: orderId }) }));
    expect(detail.body.order).toMatchObject({ status: "PAID", token_number: 1, total_paise: 12500 });
    expect(detail.body.order).not.toHaveProperty("student_id");
    expect(detail.body.order.estimated_minutes).toBeGreaterThan(0);
    expect(detail.body.items).toHaveLength(2);
  });

  it("another student cannot read the order", async () => {
    currentUser = { userId: "00000000-0000-4000-8000-000000000102", role: "student", canteenId: null, name: "x" };
    const r = await call((await routes.order()).GET(get(), { params: Promise.resolve({ id: orderId }) }));
    expect(r.status).toBe(404);
  });

  it("a student cannot use staff endpoints", async () => {
    as.student();
    expect((await (await routes.done()).POST(post({ order_id: orderId }))).status).toBe(403);
    expect((await (await routes.batches()).GET()).status).toBe(403);
  });

  it("kitchen sees the dosa batch (juice is ready-made), cooks it, marks it ready; TV and counter follow", async () => {
    as.server();
    const k = await call((await routes.batches()).GET());
    expect(k.body.batches).toHaveLength(1);
    expect(k.body.batches[0]).toMatchObject({ name: "Masala dosa", total_quantity: 2, tokens: [1] });
    const ids = k.body.batches[0].order_item_ids;

    let counter = await call((await routes.counter()).GET());
    expect(counter.body.orders[0]).toMatchObject({ token_number: 1, status: "PAID" });
    // "Marked as done" is refused before READY
    expect((await call((await routes.done()).POST(post({ order_id: orderId })))).status).toBe(409);

    await call((await routes.start()).POST(post({ order_item_ids: ids })));
    await call((await routes.ready()).POST(post({ order_item_ids: ids })));

    const board = await call((await routes.board()).GET(get(`http://localhost/api/tv/board?canteen=${CANTEEN}&key=kiosk-key`)));
    expect(board.body).toEqual({ in_queue: [], ready: [1] });

    counter = await call((await routes.counter()).GET());
    expect(counter.body.orders[0].status).toBe("READY");
    const done = await call((await routes.done()).POST(post({ order_id: orderId })));
    expect(done.body.status).toBe("GIVEN");
  });

  it("cash order at the counter joins the same queue and shows in the payments log", async () => {
    as.cashier();
    const res = await call(
      (await routes.cashOrder()).POST(post({ items: [{ menu_item_id: ITEM.tea, quantity: 2 }], client_request_id: randomUUID() })),
    );
    expect(res.status).toBe(201);
    expect(res.body.order).toMatchObject({ token_number: 2, status: "PAID", total_paise: 2000 });

    const log = await call((await routes.cashLog()).GET());
    expect(log.body.total_paise).toBe(2000);
    expect(log.body.payments[0]).toMatchObject({ token_number: 2, cashier: "Demo Cashier" });

    as.server();
    const k = await call((await routes.batches()).GET());
    expect(k.body.batches[0]).toMatchObject({ name: "Tea", tokens: [2] });
  });

  it("cashier edits stock; sold-out items leave the live menu", async () => {
    as.cashier();
    const patch = await call(
      (await routes.menu()).PATCH(
        new Request("http://localhost/api/menu", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: ITEM.samosa, stock_count: 0 }),
        }),
      ),
    );
    expect(patch.status).toBe(200);
    as.student();
    const menu = await call((await routes.menu()).GET(get(`http://localhost/api/menu?canteenId=${CANTEEN}`)));
    expect(menu.body.items.some((i: { id: string }) => i.id === ITEM.samosa)).toBe(false);
    // students cannot see the stock editor view
    const all = await call((await routes.menu()).GET(get(`http://localhost/api/menu?canteenId=${CANTEEN}&all=1`)));
    expect(all.status).toBe(403);
  });

  it("stock snapshot: the order kept its own prices", async () => {
    const o = await one<{ n: number }>(db, "select count(*)::int n from order_items where unit_price_paise = 1");
    expect(o.n).toBe(0);
  });
});
