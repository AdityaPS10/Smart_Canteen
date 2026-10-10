// Local stand-in for a scheduler: calls POST /api/cron/tick every 60 seconds.
// Usage: npm run cron   (reads APP_URL and CRON_SECRET from .env.local or the environment)
const base = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
const secret = process.env.CRON_SECRET;
if (!secret) {
  console.error("CRON_SECRET is not set (put it in .env.local).");
  process.exit(1);
}

async function tick() {
  try {
    const res = await fetch(`${base}/api/cron/tick`, {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}` },
    });
    const body = await res.json().catch(() => ({}));
    const t = new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" });
    console.log(`[${t}] ${res.status}`, JSON.stringify(body));
  } catch (e) {
    console.error("tick failed:", e.message);
  }
}

await tick();
setInterval(tick, 60_000);
