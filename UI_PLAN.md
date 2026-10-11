# UI_PLAN — visual-only pass (branch `theme-changed`)

Inputs: `UI_SPRC.md` (tweakcn theme, fonts, status tokens, light/dark per screen) and the restyle brief.
No logic, routes, API, SQL or flow changes. Only theme tokens in components (no hex / palette classes).

## 0. Theme (UI_SPRC.md steps 1–6)
- `app/globals.css`: tweakcn tokens (Tailwind v4), plus `--success / --warning / --danger` (+ foregrounds) for
  `:root` and `.dark`, registered as `bg-success`, `text-danger`, etc. No app-wide dark mode.
- `app/layout.tsx`: Geist + Geist Mono via `next/font/google` (`display: swap`), Georgia as serif.
- Token numbers: `token-num` utility (sans, weight 900, tabular numerals).
- Dark screens: `/staff/kitchen`, `/tv/board`, `/tv/menu`, `/entrance` are wrapped in `<div class="dark">`.
  `/staff/counter` is light with high contrast. Student pages and `/staff/cashier` are light.

## 1. Shared components (built first)
| Component | File | Used by |
| --- | --- | --- |
| Page header | `components/page-header.tsx` | every app screen |
| Item card | `components/item-card.tsx` | menu, cashier tiles |
| Quantity stepper (44 px targets) | `components/qty-stepper.tsx` | menu, cashier |
| Status chip | `components/status-chip.tsx` (replaces `status-badge`) | orders, counter, home |
| Token chip | `components/token-chip.tsx` | order, counter, kitchen, TV, cashier bill |
| Empty state | `components/empty-state.tsx` | lists with no rows |
| Skeleton | `components/ui/skeleton.tsx` | loading states |
| Sticky bottom bar | `components/sticky-bottom-bar.tsx` | menu, checkout, cash order (mobile) |
Also: restyle `AppHeader`, UI primitives (`badge`, `button`, `alert`) to tokens, minimum 14 px text.

## 2. Screens, in order (commit after each group)
a. Student: `/login` (+ `/staff/login`, same panel), `/canteens`, `/menu/[canteenId]`, `/scan`, `/checkout`,
   `/orders/[id]` (+ home `/` and the MOCK pay page, which share the same components)
b. Staff: `/staff/cashier`, `/staff/counter`, `/staff/kitchen`
c. Displays: `/tv/board`, `/tv/menu`, `/entrance`

## 3. Checks after each group
- `npm run typecheck`, `npm run lint`, `npm test`.
- Playwright screenshots at 390 / 1024 / 1920 px (`scripts/ui-screenshots.mjs`), reviewed for overflow,
  horizontal scroll, cramped spacing, contrast, text < 14 px, loading and empty states.
- End-to-end flow in a real browser (`scripts/e2e-flow.mjs`): demo student → entrance check-in → order →
  mock pay → token → kitchen ready → food server done.
