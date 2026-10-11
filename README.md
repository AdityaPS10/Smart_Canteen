# Smart Canteen Billing System

A hackathon prototype for one college canteen (every main table carries `canteen_id`). Students see a live menu,
scan a rotating entrance QR, pay by UPI, and get a token and bill only after payment. The kitchen gets grouped items,
the TV shows ready tokens, and the food server marks orders Given. Uncollected food goes to a spare pool or is
recorded as wasted. Cash customers order at the cashier and join the same queue.

- Spec: [`spec.md`](spec.md) · Flowchart: [`Blueprint.jpeg`](Blueprint.jpeg)
- Plan: [`PLAN.md`](PLAN.md) · Decisions where the spec was silent: [`ASSUMPTIONS.md`](ASSUMPTIONS.md)

## Stack

Next.js 15 (App Router, TypeScript, Tailwind, shadcn/ui-style components) · Supabase Postgres + Realtime broadcast ·
Auth.js v5 (Google + ID-card QR) · Razorpay test mode or a clearly labelled MOCK payment page · jose, zod,
qrcode.react, html5-qrcode · Python FastAPI + scikit-learn in [`/ml`](ml) · vitest.

All business rules live in atomic Postgres functions ([`supabase/migrations`](supabase/migrations)). The browser only
calls Next.js route handlers (`/app/api/**`), which use the service-role key on the server.

## Setup

### 1. Install

```bash
npm install
```

### 2. Environment

Copy `.env.example` to `.env.local` and fill it in. Every variable is described there.

```bash
cp .env.example .env.local
```

Random secrets (`AUTH_SECRET`, `QR_SECRET`, `KIOSK_KEY`, `CRON_SECRET`) can be generated with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

For a quick demo set `DEMO_MODE=true` and `PAYMENT_MODE=mock`. Google and Razorpay are then optional.

### 3. Database (Supabase)

1. Create a Supabase project and copy the URL, anon key and service-role key into `.env.local`.
2. Apply the migrations in order, then the seed. Either use the Supabase CLI:

   ```bash
   npx supabase link --project-ref YOUR_PROJECT_REF
   ```

   ```bash
   npx supabase db push --include-seed
   ```

   or paste `supabase/migrations/0001_…` to `0009_…` and then `supabase/seed.sql` into the SQL editor, in that order.
3. **pg_cron**: enable the `pg_cron` extension (Database → Extensions) *before* applying `0008_tick.sql`. The migration
   then schedules `process_tick()` every minute. If pg_cron is unavailable the migration just prints a notice; use
   `npm run cron` instead (below).
4. **Realtime**: the app uses public *broadcast* channels (`canteen:<id>`, `order:<id>`) that carry no personal data.
   Make sure Realtime is enabled and public channels are allowed (Project Settings → Realtime). If Realtime is
   unreachable, every live screen falls back to polling every 5 seconds.

The seed creates "Main canteen" (`00000000-0000-4000-8000-000000000001`), 12 menu items, 2 students, 1 food server,
1 cashier, and 300 sample past orders (`is_sample = true`) for the time-prediction model.

### 4. ID-card QR codes for the demo users

```bash
npm run seed:qr
```

This writes `seed-qr/<role>-<name>.png`. Print them or open them on a second phone; the login scanner reads them
(the scanners also accept a photo of the QR).

### 5. Google login (optional)

Create an OAuth client (Web) in Google Cloud and add the redirect URI
`http://localhost:3000/api/auth/callback/google`. Set `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` and
`COLLEGE_EMAIL_DOMAIN`. Only emails at that domain can sign in; a new one becomes a student. Staff can use Google
if their college email is pre-seeded with a staff role.

### 6. Razorpay test mode (optional)

Set `PAYMENT_MODE=razorpay`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` and `RAZORPAY_WEBHOOK_SECRET`. In the Razorpay
dashboard (test mode) add a webhook to `https://<public-url>/api/payments/webhook` for `payment.captured`,
`order.paid` and `payment.failed`, and keep auto-capture on. Locally you need a tunnel (for example
`cloudflared tunnel --url http://localhost:3000`). If any key is missing the app automatically uses the MOCK page.

## Run

App:

```bash
npm run dev
```

Time-prediction service (Python 3.11+):

```bash
cd ml && python -m venv .venv && .venv/Scripts/pip install -r requirements.txt
```

```bash
cd ml && .venv/Scripts/uvicorn app:app --port 8000
```

(on macOS/Linux use `.venv/bin/` instead of `.venv/Scripts/`). Set `ML_URL=http://localhost:8000`.

Scheduler stand-in (calls `POST /api/cron/tick` every minute; also triggers the first model training):

```bash
npm run cron
```

Checks:

```bash
npm run typecheck
```

```bash
npm run lint
```

```bash
npm test
```

```bash
cd ml && .venv/Scripts/python -m pytest -q
```

Browser checks (app running, `DEMO_MODE=true`, `PAYMENT_MODE=mock`; first run `npx playwright install chromium`).
The main flow end to end (student, entrance QR, mock pay, kitchen ready, food server done):

```bash
node --env-file=.env.local scripts/e2e-flow.mjs
```

Screenshots of a screen group (`a` student, `b` staff, `c` displays) at 390 / 1024 / 1920 px, with a report of
horizontal scroll and text under 14 px. Group `b` creates two cash orders for content and closes them afterwards;
set `SKIP_SETUP=1` to skip that.

```bash
node --env-file=.env.local scripts/ui-screenshots.mjs a screenshots
```

## Screens

| Who | URL |
| --- | --- |
| Student login | `/login` |
| Staff login | `/staff/login` |
| Student | `/canteens` → `/menu/[canteenId]` → `/checkout?canteen=ID` → `/orders/[id]`; `/scan` |
| Cashier | `/staff/cashier` (cash ordering screen · menu & stock editor · payments log) |
| Food server | `/staff/counter` (TOKEN ID · Items · Qty · Marked as done) and `/staff/kitchen` |
| TV: queue + ready | `/tv/board?canteen=ID&key=KIOSK_KEY` |
| TV: menu | `/tv/menu?canteen=ID&key=KIOSK_KEY` |
| Entrance QR | `/entrance?canteen=ID&key=KIOSK_KEY` |

## Time prediction

When the token is created, the app asks `/ml` (`POST /predict`) using hour, weekday, units of food in the kitchen
queue ahead, number of items, and the longest prep time, and shows "Estimated ready in X to Y min" (about 0.85x to
1.2x). The estimate is stored on the order (`estimated_minutes`, `estimate_source`). The training target is minutes
from `paid_at` to `ready_at`, taken from `order_events`. The tick retrains the model after every
`ml_retrain_every_orders` newly completed orders.

If the service is down or has fewer than `ml_min_samples` rows, a formula is used: remaining time of the current
batch window + prep minutes ahead / `kitchen_staff_count` + longest prep in the order.

**The model starts out trained only on seeded sample data.** While more than half of its training rows are sample
rows, the student screen labels the number "estimate (sample data)". It is not trained on real data until real
orders replace the samples.

## 5-minute demo script

Prep: `DEMO_MODE=true`, `PAYMENT_MODE=mock`, app + ML service + `npm run cron` running, `npm run seed:qr` done.
For a fast no-show demo you may temporarily set `arrival_window_minutes`, `post_expiry_wait_minutes` and
`spare_pool_extra_wait_minutes` to `1` in the `settings` table.

1. **Displays (0:00).** On a laptop open three tabs side by side:
   `/entrance?canteen=00000000-0000-4000-8000-000000000001&key=…`, `/tv/board?…` and `/tv/menu?…`.
   Point out the QR countdown (60 s or 10 uses).
2. **Student login (0:30).** On a phone open `/login` and scan `seed-qr/student-demo-student-one.png`
   (or tap "Login as student"). The student lands on `/canteens`; pick Main canteen.
3. **Order without scanning (1:00).** Add 2 × Masala dosa and 1 × Juice, press **Order**. The server says
   "Scan the QR on the display at the canteen entrance, or order at the cashier". Press **Scan**, scan the entrance
   QR. The app comes back to the ordering screen with the cart intact and the **server-calculated total**.
4. **Pay (1:45).** Press **Pay by UPI**. The MOCK page appears. Press **Pay fail** once (the order screen offers
   "Retry payment", 2 left), then retry and press **Pay success**. The token and bill appear, with the estimate.
   Juice is ready-made, so it is already ready.
5. **Kitchen (2:30).** Log in as the food server on the laptop (`/staff/login`, scan the food-server QR) and open
   **Kitchen**. Order another dosa from a second student within the same 5-minute window: the dosas form **one batch**
   with both tokens. Press **Start cooking**, then **Mark ready**.
6. **Ready (3:15).** The token jumps to **Ready** on the TV board; the student's phone plays the alert and shows the
   Ready banner.
7. **Given (3:40).** On **Counter** the row is highlighted; **Marked as done** is enabled only now. Press it: Given.
8. **Cash order (4:00).** Log in as the cashier, tap Tea × 2, press **Cash received**: token and bill at once. The
   order appears in the kitchen queue and in the **Payments** log with the running total. In **Menu & stock** set
   Samosa's count to 0 and watch it vanish from the TV menu.
9. **No-show (4:30).** Have one order become READY and do not collect it. After the arrival window the tick marks it
   EXPIRED; after the waits, Samosa (holds well) appears in the kitchen's **Spare pool** and Masala dosa is recorded
   as wasted.

## Not built (spec section 16)

No admin dashboard, analytics charts, complaints, refunds, no-show penalties, pickup slots, GPS checks, delivery,
order history page, spare-pool reuse, push-notification servers, rate limiting, multi-canteen UI beyond the canteen
list, or PWA install features.

## Tests

`npm test` runs vitest. SQL functions are tested against a real Postgres engine in-process (PGlite) using the
actual migration files, and the API tests run the real route handlers against it. Covered: allowed and illegal
status transitions; two concurrent orders for the last item (only one succeeds); the QR cap (11th scan rejected)
and 60-second expiry; the retry limit (third failure ends the order and releases stock); batching (5 orders in one
window = 1 batch, a later order = new batch); the server ignoring client prices; the expiry, wait and disposition
steps; webhook signature and idempotency; payment timeout and late payment; the cash flow; and the main flow
end to end through the API. `ml/test_app.py` covers the FastAPI service.
