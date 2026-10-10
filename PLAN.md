# PLAN — Smart Canteen Billing System

Source of truth: `spec.md` and `Blueprint.jpeg` (flowchart). Nothing from spec §16 ("Do not build") is built.

## Architecture
- **Next.js 15 (App Router) + TypeScript + Tailwind v4 + shadcn/ui-style components** — one project, all screens.
- **Supabase Postgres**: all business rules live in atomic plpgsql functions (`/supabase/migrations`).
  Next.js route handlers (`/app/api/**`) are the only callers, using the service-role key (server only).
- **Auth.js v5** (JWT): Google (college domain) + Credentials (`idcard` = ID-card QR code, `demo` = DEMO_MODE buttons).
  Session carries `userId`, `role`, `canteenId`. Role checks in `middleware.ts` and again in every handler.
- **Realtime**: route handlers send Supabase Realtime *broadcast* (`canteen:<id>`, `order:<id>`) with no personal data;
  clients refetch via the API and poll every 5 s when the channel is not connected.
- **Payments**: Razorpay test mode (UPI) or `PAYMENT_MODE=mock` (MOCK page → same `confirm_payment`/`fail_payment`).
- **Scheduling**: `process_tick()` via pg_cron (every minute) and `POST /api/cron/tick` (CRON_SECRET).
- **ML**: `/ml` FastAPI + scikit-learn (`/predict`, `/train`, joblib); formula fallback in TS.
- **Tests**: vitest. SQL functions are tested against a real Postgres engine in-process (PGlite) using the actual migration files.

## Data flow (blueprint)
Login → role landing → (student) canteen → live menu → Order → server check-in check
→ (no) scan entrance QR / order at cashier → (yes) ordering screen (server total) → Pay by UPI
→ webhook → PAID + token + bill → student / kitchen / food-server screens → kitchen groups + marks ready
→ READY on TV + alert → given within 10 min, else EXPIRED → wait 10 → holds well? spare pool (after +5) : wasted.
Cash: cashier ordering screen → "Cash received" → PAID + token → same queue.

## Milestones (spec §18) — typecheck + lint + tests + commit after each
1. Setup, env, migrations, seed, login (Google, ID-card QR, demo), role routing, `seed:qr`.
2. Menu API, cashier menu & stock editor, TV menu, live student menu.
3. Entrance QR: rotating code, `/entrance`, `/scan`, check-in, server check.
4. Ordering, server total, stock reservation, payments (mock + Razorpay), webhook, retry limit, token & bill.
5. Kitchen display (grouping + priority), ready_made instant, food-server screen, TV board, Ready alert, Given.
6. Cash Counter order flow + payments log.
7. 10-minute rule, wait stages, spare pool, wasted, cron tick.
8. Time prediction: formula fallback, FastAPI service, auto-retrain, sample data.
9. Tests completed, README + demo script, cleanup.
