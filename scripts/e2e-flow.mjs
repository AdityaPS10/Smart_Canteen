// Main flow in a real browser (Playwright), against the running app + database.
// Student and staff use separate browser contexts (separate logins).
// Usage: node --env-file=.env.local scripts/e2e-flow.mjs      (needs DEMO_MODE=true, PAYMENT_MODE=mock)
import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const CANTEEN = "00000000-0000-4000-8000-000000000001";
const KEY = process.env.KIOSK_KEY;
if (!KEY) throw new Error("KIOSK_KEY missing (run with --env-file=.env.local)");

const step = (msg) => console.log(`✓ ${msg}`);
const browser = await chromium.launch();

async function demoLogin(context, role, path) {
  const page = await context.newPage();
  await page.goto(`${BASE}${path}`);
  await page.getByRole("button", { name: `Login as ${role}` }).click();
  await page.waitForURL((u) => !u.pathname.includes("login"), { timeout: 60_000 });
  return page;
}

try {
  const studentCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const staffCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });

  // 1. Student logs in and lands on the canteen list
  const student = await demoLogin(studentCtx, "student", "/login");
  await student.waitForURL("**/canteens", { timeout: 60_000 });
  step("student logged in -> /canteens");

  // 2. Order without check-in is refused by the server (cart kept)
  await student.goto(`${BASE}/menu/${CANTEEN}`);
  await student.getByRole("button", { name: "Add Masala dosa" }).click();
  await student.getByRole("button", { name: "Add Juice" }).click();
  await student.getByRole("button", { name: /^Order$/ }).click();
  const scanPrompt = student.getByText("Scan the QR on the display at the canteen entrance");
  const goneToCheckout = student.waitForURL("**/checkout**", { timeout: 30_000 }).then(() => "checkout");
  const first = await Promise.race([scanPrompt.waitFor({ timeout: 30_000 }).then(() => "prompt"), goneToCheckout]);
  step(first === "prompt" ? "no check-in -> scan prompt shown" : "student already had a valid check-in");

  // 3. Entrance QR: open the code's link like a phone camera would
  if (first === "prompt") {
    const res = await studentCtx.request.get(`${BASE}/api/entrance/current?canteen=${CANTEEN}&key=${KEY}`);
    const { url } = await res.json();
    const link = new URL(url);
    await student.goto(`${BASE}${link.pathname}${link.search}`);
    await student.waitForURL("**/checkout**", { timeout: 60_000 });
    step("entrance QR scanned -> back to checkout with cart");
  }

  // 4. Server total, pay with the MOCK page
  await student.getByText("Total", { exact: true }).waitFor({ timeout: 30_000 });
  await student.getByRole("button", { name: /Pay by UPI/ }).click();
  await student.waitForURL("**/pay/mock**", { timeout: 60_000 });
  await student.getByRole("button", { name: "Pay success" }).click();
  await student.waitForURL("**/orders/**", { timeout: 60_000 });
  const tokenEl = student.getByLabel(/^Token \d+$/);
  await tokenEl.waitFor({ timeout: 30_000 });
  const token = Number((await tokenEl.getAttribute("aria-label")).replace("Token ", ""));
  const orderId = student.url().split("/orders/")[1];
  step(`paid (mock) -> token ${token}, order ${orderId}`);

  // 5. Kitchen marks the batch with this token ready
  const kitchen = await demoLogin(staffCtx, "food server", "/staff/login");
  await kitchen.goto(`${BASE}/staff/kitchen`);
  const batch = kitchen.locator("[data-batch]").filter({ has: kitchen.getByLabel(`Token ${token}`, { exact: true }) });
  await batch.first().waitFor({ timeout: 30_000 });
  await batch.first().getByRole("button", { name: "Mark ready" }).click();
  step("kitchen marked the batch ready");

  // 6. Student sees Ready (live)
  await student.getByText("Your order is ready!").waitFor({ timeout: 30_000 });
  step("student screen shows Ready");

  // 7. Food server marks it done
  await kitchen.goto(`${BASE}/staff/counter`);
  const row = kitchen.locator("[data-order-row]").filter({ has: kitchen.getByLabel(`Token ${token}`, { exact: true }) });
  await row.first().getByRole("button", { name: "Marked as done" }).click();
  await row.first().waitFor({ state: "detached", timeout: 30_000 });
  step("food server marked it done");

  await student.getByText("Given", { exact: true }).waitFor({ timeout: 30_000 });
  step("student screen shows Given");
  console.log(JSON.stringify({ ok: true, token, orderId }));
} catch (e) {
  console.error("✗ FLOW FAILED:", e.message);
  process.exitCode = 1;
} finally {
  await browser.close();
}
