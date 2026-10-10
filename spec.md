You are building a complete working prototype called "Smart Canteen Billing System" for a 24-hour college hackathon. You have no prior context. This document is the full spec.

RULES FOR YOU
- Follow the flow in this document EXACTLY. Do NOT add features that are not described here (see section 16 "Do not build").
- Where something is unclear, choose a sensible default, write it in ASSUMPTIONS.md, and continue. Do not ask me questions unless a secret or key is missing and you cannot proceed.
- First write PLAN.md (short), then build milestone by milestone (section 18). After each milestone run typecheck, lint and tests, fix problems, and make a git commit.

## 1. Problem and goal
In our college canteen, students queue at one order corner and pay by UPI or cash. A cashier types each order in a computer and gives a paper bill. The student carries it to a food counter where 2 or 3 people serve. Bills get lost, orders come late, and students only see what is available after reaching the canteen.

The system makes it digital: live menu, order after scanning a rotating entrance QR, UPI payment, token and bill created only after payment, kitchen display with grouped items, ready tokens on a TV, food server marks the order Given, and uncollected food goes to a spare pool or is wasted. Cash customers use the cashier's counter and enter the same system.

The prototype is for ONE canteen, but every main table carries canteen_id so more canteens can be added later.

## 2. Tech stack (fixed, do not substitute)
- One Next.js project (App Router), TypeScript, Tailwind CSS, shadcn/ui. All screens live in this one project, responsive and mobile-friendly.
- PostgreSQL on Supabase for the database and Realtime. SQL migrations in /supabase/migrations, seed in /supabase/seed.sql. Run scheduled work with pg_cron, and also expose a protected /api/cron/tick route for local use.
- Login: Auth.js (NextAuth v5) with JWT sessions. Providers: Google (restricted to env COLLEGE_EMAIL_DOMAIN) and a Credentials provider for ID-card QR codes. The session carries userId, role and canteenId.
- Server code uses the Supabase service-role key (server only, never sent to the browser). All reads and writes go through Next.js route handlers (/app/api/...). Every critical step is one atomic Postgres function (RPC).
- Payments: Razorpay test mode (UPI). Also a mock mode (PAYMENT_MODE=mock, used when Razorpay keys are missing) with a mock payment page that has "Pay success" and "Pay fail" buttons going through the same server functions. Label it clearly as MOCK.
- Libraries: jose (signed QR tokens), zod (validation), qrcode.react (show QR), html5-qrcode (scan QR), vitest (tests).
- Time-prediction service: a small Python FastAPI service in /ml using scikit-learn (see section 12).
- No Redis, no Socket.IO, no separate Express server, no MongoDB.
- Business timezone: Asia/Kolkata. Store timestamps as timestamptz (UTC). Store money as integer paise, never floats.

## 3. Roles and login
Roles: student, food_server, cashier. (No admin screen. Staff and demo data come from the seed script.)

Login screen (/login):
- Students: "Continue with Google" (college email) OR "Scan college ID card QR". A new Google user whose email matches COLLEGE_EMAIL_DOMAIN becomes a student automatically.
- Staff (food servers and cashiers): "Scan staff ID card QR" at /staff/login. Staff can also log in with Google if their email is pre-seeded with a staff role.
- Each profile has a unique random id_card_code. The QR on an ID card encodes that code. The login endpoint matches it to the profile, creates the session, and the role decides the landing page:
  - student goes to /canteens
  - food_server goes to /staff/counter (and may also open /staff/kitchen)
  - cashier goes to /staff/cashier
- Route protection by role in middleware and again inside each API handler.
- Demo convenience: when DEMO_MODE=true, show small "Login as student / food server / cashier" buttons. Default off.
- Seed script `npm run seed:qr` generates ID-card QR PNGs for the demo users into /seed-qr/.

## 4. Screens and routes

Student:
- /canteens: pick a canteen.
- /menu/[canteenId]: live menu showing only items with stock above 0 and active. Student sets quantities and presses "Order".
- /scan: camera scanner for the entrance QR (it must also work as a link /scan?t=TOKEN when the phone camera opens it).
- /checkout: ordering screen showing items, quantity and total (total calculated by the server), and a "Pay by UPI" button (GPay or PhonePe).
- /orders/[id]: student screen with token number (large), itemized bill, total, status (Paid, Preparing, Ready, Given, Expired), the estimated time (section 12), and a Ready alert banner (sound and vibration, plus a browser notification if permission was already granted).
- Home (/): if the student has an active order, show a link to it.

Staff:
- /staff/cashier: Cash Counter dashboard. Includes (a) the ordering screen to create a cash order: tap items, set quantities, see the total, press "Cash received" which creates the order and shows the token and bill; (b) menu and stock editor (add dish with a count, edit price and count, toggle ready_made and holds_well, set prep_minutes); (c) payments log for cashier payments with a running total.
- /staff/kitchen: kitchen display (section 8).
- /staff/counter: food server screen, a table with columns TOKEN ID | Items | Qty | Marked as done. New orders appear live. "Marked as done" (marks the order Given) is enabled only for orders that are READY.

Displays (no personal data, protected by a secret KIOSK_KEY in the URL):
- /tv/board?canteen=ID&key=...: two columns, "In queue" tokens and "Ready" tokens, large text, live.
- /tv/menu?canteen=ID&key=...: the live menu, updates when the cashier changes it.
- /entrance?canteen=ID&key=...: full-screen rotating entrance QR with a countdown.

## 5. Main flow (implement exactly)
1. Open app, log in (section 3). The role decides the landing screen.
2. Student selects the canteen and sees the live menu.
3. Student chooses items and presses "Order".
4. Check "Entrance QR scanned?" on the server, meaning the student has a valid check-in for this canteen (section 10).
   - NO: show "Scan the QR on the display at the canteen entrance, or order at the cashier", with a Scan button. The cart is kept. After a successful scan, return to the menu or checkout with the cart intact and continue.
   - YES: go to the Ordering screen.
5. Ordering screen: items, quantity, total. The browser sends ONLY menu_item_id and quantity. The server calculates the total from its own prices and ignores any price from the client.
6. Student presses "Pay by UPI". The server creates the order as PENDING_PAYMENT, reserves stock atomically, creates the Razorpay order for the server-calculated total, and opens the UPI app (GPay or PhonePe) through Razorpay checkout.
7. The payment result arrives through the Razorpay webhook (the source of truth).
   - Success: the order becomes PAID and the TOKEN AND BILL ARE CREATED. A token is never created for an unpaid order.
   - Failure: the student may retry, at most 2 retries (3 attempts total). After the last failure the order becomes PAYMENT_FAILED, reserved stock is released, no token is created, and the app returns to the home page.
8. After "Token and bill created", the same itemized order appears on three screens at once:
   - Student screen: token, items, qty (plus total, status and estimated time)
   - Kitchen display: items, qty
   - Food server screen: token, items, qty (new rows appear live)
9. Items marked ready_made are given instantly: when payment is confirmed they are marked ready automatically. If every item of an order is ready_made, the order becomes READY at once.
10. The kitchen cooks the other items and marks them Ready. When all items of an order are ready, the order becomes READY. The token moves to the "Ready" column on the TV, and the student gets the Ready alert (they can also see it on the canteen display).
11. "Student arrives within 10 min?"
   - YES: the student shows the token, the food server finds it and presses "Marked as done". The order becomes GIVEN.
   - NO: see section 11 (wait, then spare pool or wasted).

## 6. Cash flow (cashier)
- Cashier logs in by staff ID card QR and opens the Cash Counter dashboard.
- Student pays in cash. The cashier builds the order on the ordering screen (items, qty, total) and presses "Cash received".
- The server creates the order as PAID with a payment row (method cash, cashier id) and goes straight to "Token and bill created". No entrance QR and no UPI are involved. Cash orders join the same kitchen queue as app orders, so nobody is served out of turn.
- This is also the "order at cashier" option when the entrance QR scan fails.
- The payments log lists cash payments (time, token, amount, cashier) with a total.

## 7. Order statuses and rules
Statuses: PENDING_PAYMENT, PAYMENT_FAILED, PAID, PREPARING, READY, GIVEN, EXPIRED.
Allowed transitions only:
- PENDING_PAYMENT to PAID (payment confirmed or cash received)
- PENDING_PAYMENT to PAYMENT_FAILED (retries used up, or no payment within payment_timeout_minutes)
- PAID to PREPARING (kitchen starts cooking)
- PAID to READY (only when all items are ready_made)
- PREPARING to READY
- READY to GIVEN
- READY to EXPIRED (arrival window passed)
Enforce this in one SQL function, reject illegal transitions, and write every change to order_events with a timestamp (these timestamps are also the training data for section 12). Token numbers are per canteen per day, assigned atomically only when the order becomes PAID.

## 8. Kitchen display: grouping and priority
- Show order items of orders that are PAID or PREPARING and not yet ready.
- Group items by menu item within time windows of grouping_window_minutes (default 5), based on the order's paid_at in Asia/Kolkata. Example: 5 dosas ordered by different students within one window form ONE batch of 5. A dosa paid after that window closes starts a NEW batch, even if it is a single dosa.
- Each batch row shows: item, total quantity, the token numbers in it, and how long the oldest order in it has waited.
- Batching is only a view and a cooking action. Each order keeps its own ready status and is never merged with another.
- Priority scheduling (put it in one isolated function so it can be changed): ready_made items are handled instantly (they never appear as cooking work); other batches are ordered oldest window first.
- Actions: "Start cooking" (items become preparing, order becomes PREPARING) and "Mark ready" (items become ready; an order becomes READY when all its items are ready). Everything updates live.
- The kitchen display also lists the current spare pool (item and quantity).

## 9. Menu, stock and sold out
- menu_items fields: name, price_paise, stock_count, ready_made, holds_well, prep_minutes, active.
- The cashier adds a new dish together with a count, and edits the count when the dish is made again. The live menu and the TV menu update immediately.
- Stock reduces as students order: reserve it atomically when the order is created, with one SQL statement that decrements stock_count only if stock_count >= quantity. If any item fails, the whole order fails with a clear message and the menu refreshes. Release reserved stock when an order goes to PAYMENT_FAILED.
- When stock_count reaches 0 the item is removed from the menu (hidden in the app and on the TV).

## 10. Entrance QR
- A display at the canteen entrance shows a QR code (/entrance).
- Each code is valid for 60 seconds OR 10 uses, whichever comes first. Then a new code is generated. Settings: qr_ttl_seconds=60, qr_max_uses=10. Allow a 5-second grace period for the previous code.
- Table entrance_codes: id, canteen_id, token (a jose-signed JWT with canteen_id, code_id, exp), use_count, max_uses, created_at, expires_at.
- Validation (server): verify the signature, expiry and canteen, then increment use_count in one SQL statement only if use_count < max_uses. Reject otherwise with a clear reason (expired, used up, wrong canteen).
- A successful scan creates a check-in for that student and canteen, valid for checkin_minutes (default 10), stored in a checkins table. Scanning again while a check-in is active returns the same check-in and does not use up another code use.
- The check-in is verified on the SERVER when the order is created, never only in the browser.
- The entrance page redraws the QR live when the code changes. Never show use_count to students.

## 11. Ready, the 10-minute rule, spare pool and wasted
- When an order becomes READY, record ready_at. The student has arrival_window_minutes (default 10) to collect.
- If the order is not GIVEN by then, it becomes EXPIRED (the "No" path). Then, per the flow, "Wait 10 minutes" (post_expiry_wait_minutes, default 10) passes. After that, for each item:
  - "Holds well?" YES (menu_items.holds_well = true): wait spare_pool_extra_wait_minutes (default 5, the "wait some more time"), then add the item to spare_pool with its quantity.
  - NO: mark it wasted (insert into wasted_items with item, quantity, value and time).
- A scheduled function (pg_cron every minute, plus the /api/cron/tick route) handles: READY to EXPIRED, the two waiting stages, spare pool and wasted, and PENDING_PAYMENT timeouts. Make it idempotent and safe to run twice.
- The spare pool is only recorded and shown on the kitchen display. Reuse by new orders is NOT part of this flow, so do not build it.

## 12. Time prediction (the AI feature)
- When the token is generated, the app calls the prediction and shows "Estimated ready in X to Y min" on the student screen. Store the estimate on the order (estimated_minutes) so its accuracy can be checked later.
- /ml FastAPI service with scikit-learn. POST /predict takes features: hour, weekday, units of food in the kitchen queue ahead, number of items in the order, and the longest prep_minutes among the items. It returns minutes. The app shows a range of about 0.85x to 1.2x, rounded.
- Target for training: minutes from paid_at to ready_at, taken from order_events. Ready-made items count as zero prep.
- The model retrains automatically as new orders arrive: POST /train rebuilds the model from the data and saves it to disk (joblib). The tick function triggers it after every ml_retrain_every_orders (default 20) newly completed orders.
- Fallback: if the ML service is down, or there are fewer than ml_min_samples (default 50) rows, use a formula: remaining time of the current batch window + (prep_minutes of units ahead in the queue / kitchen_staff_count) + the longest prep_minutes in the order.
- Seed a few hundred rows of sample history in order_events with is_sample=true. Whenever the model is trained mostly on sample data, label the estimate in the UI and README as "estimate (sample data)". Never claim it is trained on real data.

## 13. Database
Create these tables with primary keys, foreign keys, indexes and check constraints (stock_count >= 0, quantity > 0, and so on):
- settings (key, value). Defaults: qr_ttl_seconds=60, qr_max_uses=10, checkin_minutes=10, grouping_window_minutes=5, arrival_window_minutes=10, post_expiry_wait_minutes=10, spare_pool_extra_wait_minutes=5, payment_max_retries=2, payment_timeout_minutes=3, kitchen_staff_count=2, ml_min_samples=50, ml_retrain_every_orders=20
- canteens (id, name, active)
- profiles (id, email nullable unique, full_name, role, canteen_id nullable for staff, id_card_code unique, created_at)
- menu_items (see section 9)
- entrance_codes, checkins (see section 10)
- orders (id, canteen_id, student_id nullable, source 'app' or 'cashier', customer_name nullable, token_number nullable, service_date, status, total_paise, payment_attempts, estimated_minutes, created_at, paid_at, ready_at, given_at, expired_at). Unique (canteen_id, service_date, token_number).
- order_items (id, order_id, menu_item_id, name_snapshot, unit_price_paise snapshot, quantity, status 'pending','preparing','ready', ready_at, disposition null/'spare_pool'/'wasted', disposition_due_at)
- payments (id, order_id, method 'upi' or 'cash', status, gateway_order_id, gateway_payment_id unique nullable, attempt_no, amount_paise, cashier_id nullable, created_at). The unique gateway_payment_id makes the webhook idempotent.
- order_events (id, order_id, event, at, is_sample boolean default false)
- spare_pool (id, canteen_id, menu_item_id, quantity, added_at)
- wasted_items (id, canteen_id, menu_item_id, quantity, value_paise, at)
- token_counters (canteen_id, service_date, last_token) for atomic token numbers

Atomic SQL functions: place_order, confirm_payment, fail_payment, cashier_create_order, transition_order, start_batch, mark_batch_ready, mark_given, validate_entrance_scan, rotate_entrance_code, process_tick.

## 14. API (Next.js route handlers, validate every body with zod)
- POST /api/scan/validate
- GET /api/menu?canteenId=
- POST /api/orders/preview (cart, returns the server total)
- POST /api/orders (cart; requires a valid check-in; returns the order and payment info)
- POST /api/payments/webhook (verify the Razorpay signature, reject invalid with 400, idempotent)
- POST /api/payments/retry (allowed only while attempts are within payment_max_retries + 1)
- GET /api/orders/[id] (only the owner student, or staff of that canteen)
- POST /api/cashier/orders and GET /api/cashier/payments
- POST/PATCH /api/menu (cashier only)
- GET /api/kitchen/batches, POST /api/kitchen/start, POST /api/kitchen/ready
- GET /api/counter/orders, POST /api/counter/done
- GET /api/tv/board, GET /api/tv/menu, GET /api/entrance/current (kiosk key required)
- POST /api/cron/tick (protected by CRON_SECRET)
Ownership rule: a student can only read their own orders. A student can never change order status or payments.

## 15. Realtime
- After every state change the server sends a small Supabase Realtime BROADCAST message on a channel per canteen (events: orders_changed, menu_changed, entrance_changed) and on a channel per order for the student alert. The message carries no personal data.
- Clients receive the signal and refetch through the authenticated API. Also poll every 5 seconds as a fallback if Realtime is disconnected.
- Screens that must update live: kitchen, food server, cashier, student screen, TV board, TV menu, entrance QR.

## 16. Do not build (not in this flow)
Admin or management dashboard, analytics charts, complaints or "item missing" reports, refunds, no-show penalties or blocking, pickup time slots, GPS or location checks, delivery, order history page, spare-pool reuse by new orders, push notification servers, rate limiting, multi-canteen UI beyond the canteen list, PWA install features.

## 17. Edge cases to handle
Two students buying the last item at the same time; double-clicking Pay; webhook delivered twice; payment succeeds after the order timed out (do not create a token for a PAYMENT_FAILED order, and log it); an item sold out between adding to the cart and ordering (clear message, refresh the cart); entrance code used by the 11th person; expired check-in at the time of ordering; ML service down; Realtime disconnected; cashier order with an item that just sold out.

## 18. Build order (milestones)
1. Project setup, env files, migrations, seed, login for all three roles (Google, ID-card QR, demo buttons), role routing.
2. Menu, cashier menu and stock editor, TV menu.
3. Entrance QR (rotating code, display page, scan page, check-in, server check).
4. Ordering, server-side total, stock reservation, payments (mock and Razorpay), webhook, retry limit, token and bill creation.
5. Kitchen display with grouping and priority, ready_made instant items, food server screen, TV board, Ready alert, Given.
6. Cash Counter flow and payments log.
7. The 10-minute rule, wait stages, spare pool, wasted, cron tick.
8. Time prediction: formula fallback first, then the FastAPI service, auto retraining, sample data.
9. Tests, README, demo script, final cleanup.

Tests (vitest) must cover: allowed and illegal status transitions; atomic stock (two concurrent orders for the last item, only one succeeds); the QR cap (11th scan rejected, 60-second expiry); the retry limit (third failure ends the order and releases stock); batching (5 orders in one window make 1 batch, 1 order after the window makes a new batch); the server ignores client prices; the expiry and disposition steps; webhook idempotency.

## 19. Seed data and demo
- One canteen "Main canteen". About 12 menu items with prices and stock, for example: Samosa (holds_well, prep 3), Veg puff (ready_made, holds_well), Vada (holds_well, prep 3), Masala dosa (prep 6), Idli (prep 4), Tea (prep 2), Coffee (prep 2), Biscuit packet (ready_made), Juice (ready_made).
- Demo users: 2 students, 1 food server, 1 cashier, each with an id_card_code and a generated QR PNG.
- Sample history in order_events (is_sample=true) for the ML model.

## 20. Deliverables
Working code; /supabase migrations and seed; /ml service; .env.example listing every variable (Supabase URL and keys, AUTH_SECRET, Google client id and secret, COLLEGE_EMAIL_DOMAIN, QR_SECRET, KIOSK_KEY, CRON_SECRET, RAZORPAY keys, PAYMENT_MODE, ML_URL, DEMO_MODE); README.md with setup, run commands (app, ML service) and a 5-minute demo script (open the entrance display and TV on one screen, log in as a student on a phone, order after scanning the QR, pay with mock UPI, watch the kitchen group and mark ready, see the TV and alert, mark done as the food server, then show a cash order and a no-show going to the spare pool); ASSUMPTIONS.md; PLAN.md.