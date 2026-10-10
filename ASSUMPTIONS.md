# ASSUMPTIONS

Decisions made where `spec.md` / the blueprint were silent or ambiguous. Each one is the smallest sensible default.

## Environment / tooling
- **Next.js 15.5** (not 16) so that route protection stays in `middleware.ts` exactly as the spec says.
- shadcn/ui components are written into `components/ui` in the standard shadcn style (button, card, input, badge, table, …)
  instead of running the interactive shadcn CLI.
- `qrcode` (Node) is added as a dev dependency only for `npm run seed:qr` (PNG output); `qrcode.react` is used in the UI.
- Supabase project credentials were not provided. Everything is built and tested without them: SQL functions are tested
  against an in-process Postgres (PGlite) that runs the real migration files. The app itself needs the Supabase env vars to run.
- Concurrency tests run on PGlite (single connection, so queries are serialized). The SQL relies on row-level locking
  (`UPDATE … WHERE stock_count >= q`, `SELECT … FOR UPDATE`), which is what makes it safe on a real multi-connection Postgres.

## Auth
- Google sign-in is accepted only when the email ends with `@COLLEGE_EMAIL_DOMAIN`. A staff member signing in with Google must
  therefore have a pre-seeded profile with a college email; a new college email becomes a `student`.
- ID-card QR login uses an Auth.js Credentials provider named `idcard`. The QR encodes the raw `id_card_code`.
- Demo buttons (`DEMO_MODE=true`) use a separate Credentials provider `demo` that is disabled unless DEMO_MODE is true.
- Students have `canteen_id = null`; `session.canteenId` for students is null. Staff belong to one canteen.

## Ordering / payments
- Double-click protection: the checkout screen generates a `client_request_id`; `place_order` returns the existing order for
  the same (student, client_request_id) instead of creating a second one. The button is also disabled while submitting.
- A "payment attempt" = one gateway order (one `payments` row). Razorpay's own in-modal retry is disabled
  (`retry.enabled=false`) so each failure is a counted attempt. `payment_max_retries=2` → max 3 attempts; the order becomes
  `PAYMENT_FAILED` when the 3rd attempt fails.
- Payment timeout (`payment_timeout_minutes`) is measured from the latest payment attempt (or order creation if none).
- A payment confirmed for a `PAYMENT_FAILED` order is recorded as payment status `late_success` and an order event
  `late_payment_ignored`; no token is created (refunds are out of scope per §16).
- A webhook amount that does not match the order total is recorded as `amount_mismatch` and does not confirm the order.
- In mock mode, `POST /api/payments/mock` (only enabled when `PAYMENT_MODE=mock`) plays the role of the webhook and calls the
  same `confirm_payment` / `fail_payment` functions.
- The Ordering screen for students is `/checkout?canteen=ID`; the cart lives in the browser (localStorage) per canteen and only
  `menu_item_id` + `quantity` are ever sent.

## Kitchen
- A batch = same menu item + same `grouping_window_minutes` window (by `paid_at` in Asia/Kolkata, aligned to the local clock)
  + same item status (pending vs preparing). So if new orders join a window after cooking started, they appear as a separate
  pending row for that window.
- "Mark ready" may be pressed on a pending batch too; the order then moves PAID → PREPARING → READY (both events recorded).
- Start/Mark-ready act on exactly the order items shown in that row (ids sent by the kitchen screen, re-checked on the server).

## 10-minute rule
- Follows the flowchart literally using only `disposition_due_at`: when an order expires each item gets
  `disposition_due_at = expired_at + post_expiry_wait_minutes` ("Wait 10 minutes"). When that passes, the tick asks
  "Holds well?" (current `menu_items.holds_well`): NO → `wasted_items` now; YES → `disposition_due_at` is pushed back by
  `spare_pool_extra_wait_minutes` ("wait some more time") and the next tick after that adds it to `spare_pool`.
- pg_cron runs `process_tick()` every minute when the extension is available. Realtime broadcasts and ML retraining are
  triggered by `POST /api/cron/tick`; `npm run cron` calls that route every 60 s for local demos. Screens also poll every 5 s.

## Prediction
- Features are snapshotted into the `paid` order event (`order_events.meta`) so training uses the values seen at payment time.
- `estimate_source` (`formula` | `ml` | `ml_sample`) is stored next to `estimated_minutes`; `ml_sample` means more than half of
  the training rows are sample data and the UI shows "estimate (sample data)".
- Sample history is stored as 300 past GIVEN orders (previous 14 days, `source='cashier'`, `customer_name='sample'`,
  no payment rows, so they never appear in the payments log) whose events have `is_sample=true`.
- The ML service has no database access; `/api/cron/tick` pulls training rows via an RPC and posts them to `/train`.
  The tick also trains once when the service reports it has no model yet, so the first model learns from the sample
  history. The service refuses to train on fewer than 10 rows; the app uses the model only when it was trained on at
  least `ml_min_samples` rows.
- "Number of items in the order" = total quantity. Ready-made items count as zero prep and are not "units ahead".

## Realtime
- Broadcasts go through Supabase's REST broadcast endpoint from route handlers, on *public* channels whose payload is
  only a status or timestamp. Browsers listen with the anon key and refetch through the authenticated API.
- When pg_cron runs `process_tick()` on its own, the function broadcasts the same signals from SQL with Supabase's
  `realtime.send()` (best-effort; skipped where that function does not exist). When `/api/cron/tick` runs it, the
  route broadcasts as well; the duplicate only causes one extra refetch.

## Testing
- API tests run the real route handlers against PGlite through a small shim that emulates PostgREST `rpc()`
  (`tests/helpers/rpc-shim.ts`); Auth.js sessions are mocked. Network calls (Realtime, ML) are stubbed.

## Misc
- Settings are global (one canteen in the prototype), stored as text and read as integers.
- Token numbers restart at 1 per canteen per Asia/Kolkata day.
- The food-server screen shows today's PAID / PREPARING / READY orders; GIVEN/EXPIRED drop off the list.
- Time used by SQL comes from `app_now()` (= `now()`, overridable per session via `app.now` for tests only).
