// Screenshots each screen of a group at 390 / 1024 / 1920 px and reports layout problems:
// horizontal scroll and visible text smaller than 14 px.
// Usage: node --env-file=.env.local scripts/ui-screenshots.mjs <a|b|c> <outDir> [orderId]
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const [group = "a", outDir = "screenshots", orderId] = process.argv.slice(2);
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const CANTEEN = "00000000-0000-4000-8000-000000000001";
const KEY = process.env.KIOSK_KEY;
const WIDTHS = [
  { w: 390, h: 844 },
  { w: 1024, h: 768 },
  { w: 1920, h: 1080 },
];

const SCREENS = {
  a: [
    { name: "login", path: "/login" },
    { name: "staff-login", path: "/staff/login" },
    { name: "home", path: "/", role: "student" },
    { name: "canteens", path: "/canteens", role: "student" },
    { name: "menu", path: `/menu/${CANTEEN}`, role: "student", cart: true },
    { name: "menu-loading", path: `/menu/${CANTEEN}`, role: "student", slowApi: true },
    { name: "scan", path: `/scan?canteen=${CANTEEN}`, role: "student" },
    { name: "checkout", path: `/checkout?canteen=${CANTEEN}`, role: "student", cart: true },
    { name: "checkout-empty", path: `/checkout?canteen=${CANTEEN}`, role: "student" },
    ...(orderId ? [{ name: "order", path: `/orders/${orderId}`, role: "student" }] : []),
  ],
  b: [
    { name: "cashier-order", path: "/staff/cashier", role: "cashier" },
    { name: "cashier-menu", path: "/staff/cashier", role: "cashier", tab: "Menu & stock" },
    { name: "cashier-payments", path: "/staff/cashier", role: "cashier", tab: "Payments" },
    { name: "counter", path: "/staff/counter", role: "food server" },
    { name: "kitchen", path: "/staff/kitchen", role: "food server" },
  ],
  c: [
    { name: "tv-board", path: `/tv/board?canteen=${CANTEEN}&key=${KEY}` },
    { name: "tv-menu", path: `/tv/menu?canteen=${CANTEEN}&key=${KEY}` },
    { name: "entrance", path: `/entrance?canteen=${CANTEEN}&key=${KEY}` },
  ],
};

await mkdir(outDir, { recursive: true });
const browser = await chromium.launch();
const contexts = {};

async function contextFor(role, width) {
  const key = `${role ?? "anon"}-${width.w}`;
  if (contexts[key]) return contexts[key];
  const ctx = await browser.newContext({ viewport: { width: width.w, height: width.h }, deviceScaleFactor: 1 });
  if (role) {
    const p = await ctx.newPage();
    await p.goto(`${BASE}${role === "student" ? "/login" : "/staff/login"}`);
    await p.getByRole("button", { name: `Login as ${role}` }).click();
    await p.waitForURL((u) => !u.pathname.includes("login"), { timeout: 60_000 });
    await p.close();
  }
  contexts[key] = ctx;
  return ctx;
}

const problems = [];
for (const screen of SCREENS[group]) {
  for (const width of WIDTHS) {
    const ctx = await contextFor(screen.role, width);
    const page = await ctx.newPage();
    if (screen.slowApi) await page.route("**/api/menu**", async (r) => { await new Promise((x) => setTimeout(x, 4000)); await r.continue(); });
    await page.addInitScript(
      ([canteen, withCart]) => {
        try {
          if (withCart) {
            localStorage.setItem(
              `cart:${canteen}`,
              JSON.stringify({
                "00000000-0000-4000-8000-000000001004": 2,
                "00000000-0000-4000-8000-000000001010": 1,
                "00000000-0000-4000-8000-000000001007": 3,
              }),
            );
          } else localStorage.removeItem(`cart:${canteen}`);
        } catch {}
      },
      [CANTEEN, Boolean(screen.cart)],
    );
    await page
      .goto(`${BASE}${screen.path}`, { waitUntil: screen.slowApi ? "domcontentloaded" : "networkidle", timeout: 90_000 })
      .catch(() => {});
    if (screen.tab) await page.getByRole("tab", { name: screen.tab }).click();
    await page.waitForTimeout(screen.slowApi ? 800 : 2500);

    const report = await page.evaluate(() => {
      const doc = document.documentElement;
      const hScroll = doc.scrollWidth > doc.clientWidth + 1;
      const small = new Set();
      for (const el of document.querySelectorAll("body *")) {
        if (!el.childNodes.length) continue;
        const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
        if (!hasText) continue;
        const cs = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        if (cs.visibility === "hidden" || cs.display === "none" || r.width === 0 || r.height === 0) continue;
        if (parseFloat(cs.fontSize) < 14) small.add(`${el.tagName.toLowerCase()} "${el.textContent.trim().slice(0, 30)}" ${cs.fontSize}`);
      }
      return { hScroll, scrollWidth: doc.scrollWidth, clientWidth: doc.clientWidth, small: [...small].slice(0, 8) };
    });
    const file = path.join(outDir, `${group}-${screen.name}-${width.w}.png`);
    await page.screenshot({ path: file, fullPage: true });
    if (report.hScroll) problems.push(`${screen.name}@${width.w}: horizontal scroll (${report.scrollWidth} > ${report.clientWidth})`);
    for (const s of report.small) problems.push(`${screen.name}@${width.w}: small text ${s}`);
    console.log(`shot ${file}`);
    await page.close();
  }
}

console.log(problems.length ? `\nPROBLEMS (${problems.length}):\n` + problems.join("\n") : "\nNo layout problems found.");
await browser.close();
