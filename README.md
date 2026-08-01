# Jolly Driver — React Native (Expo) app for the Jolly Bakery API

A complete, drop-in React Native app (Expo SDK 54, TypeScript) for the Jolly
Bakery fleet, wired to the live **`/api/v1`** API and styled with the
*Artisanal Transit* design system (cream + honey + cocoa). This zip is the
**entire project** — extract it, install, and run.

## 1. Point it at your server

Edit **`src/config.ts`**:

```ts
baseUrl: 'https://api.jolly.kovacpay.com',   // the host your login works against
```

## 2. Run

```bash
npm install
npx expo install --fix     # aligns native module versions to SDK 54
npx expo start -c
```

Open in Expo Go (SDK 54) or a dev build. Sign in with a real API user — the
phone is normalized to `254` + last 9 digits automatically. Roles from
`users/me` decide the landing experience (admin/dispatcher/sales → admin;
driver/agent → driver). The **☰ side menu** switches sections and views.

## What's built

**Auth** — OAuth2 password grant with silent, rotating refresh; session
persists (SecureStore) and restores on launch. Full forgot-password flow
(request OTP → verify → reset). Every response envelope handled (`status` as
`0`, `"0"`, or `true`).

**Driver / agent** — today's dispatches (`dispatch/mine`), dispatch detail,
start route, and the full field loop below.

**Dispatch detail (the core screen)** — vehicle/driver/agent/route cards; a
**Reconciliation** block (Dispatched, Returns, Net Expected, Shortage — and
after an action, the server's full breakdown: Sold, Collected, Unaccounted,
Variance, Overpaid); Items with returned quantities; and three actions:

- **Record Sale** — loads remaining van stock (`remaining_stock`), sell cash/walk-in.
- **Record Collection = reconciliation** — Cash, M-Pesa (manual), or **STK Prompt**
  (`initiate_stk_push` + live status polling) for the customer to pay a balance.
- **Record Returns** — unsold quantities per product.

**Report** — per-dispatch reconciliation sheet: items (dispatched/returned/net),
reconciled totals, signature lines.

**Admin** — dashboard (KPI hero + route performance worst-first, via
`reports/route_performance` with a per-route fallback), route reconciliation
with shorts, monthly ledger (`dispatch/report`), and team (drivers + agents).

**Side menu** — slide-in drawer (brand header, sections, switch view, log out).

## API layer

`src/api/` speaks the whole spec — endpoint functions + React Query hooks for
auth, dispatch (list/mine/detail/create/change_status/record_collection/
record_sale/record_returns/remaining_stock/STK/report), customers, invoices/LPO,
all reports, and vehicle/agent CRUD. Types in `src/api/types.ts` are modeled
from the real responses you provided.

## Config knobs

- `src/config.ts` — `baseUrl`, `clientId`, and `debug` (logs every request/response
  to the Metro console; set `false` for production).

## Project structure

```text
src/
├── config.ts
├── api/           # types, client (auth + refresh + envelope), endpoints, hooks, summary, dates
├── context/       # AuthContext, MenuContext
├── components/    # Card, StatusBadge, DispatchCard, SideMenu, StateView, headers, …
├── navigation/    # auth-gated stack + driver/admin tabs + navigation ref
├── screens/
│   ├── LoginScreen, ForgotPassword
│   ├── driver/    # Dashboard, My Dispatches, Collections, Profile
│   ├── admin/     # Dashboard, Reconciliation, Monthly, Team, RouteRecon
│   └── shared/    # DispatchDetail, DispatchReportView
└── theme/
```

## Roadmap (next, pending a few response shapes)

- Real dashboard KPIs + 7-day trend + Mpesa-by-till + Needs-attention
  (`reports/dashboard_summary`, `route_performance`, `summary`, `needs_attention`).
- Customers & LPO invoicing (`customers/*`, `invoices/*`).
- Admin management: create dispatch, vehicle/agent CRUD, reports screens.

The endpoint functions for all of these already exist in `src/api/endpoints.ts`;
they just need screens (and a sample response body each to map fields exactly).

_The app icon/splash in `assets/` are placeholders — swap in final brand art._
