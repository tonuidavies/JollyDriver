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
**Reconciliation** block (Dispatched, Returns, LPO, Net Expected, Shortage — and
after an action, the server's full breakdown: Sold, Collected, Unaccounted,
Variance, Overpaid, approved Expenses); Items with returned quantities; four actions:

- **Record Sale** — loads remaining van stock (`remaining_stock`), then either a
  **cash/walk-in** sale or an **LPO / credit** sale (customer picker + LPO number).
  A credit sale gets its own delivery note and invoice the moment it's recorded.
- **Record Collection** — Cash, M-Pesa (manual), or **STK Prompt**
  (`initiate_stk_push` + live status polling) for the customer to pay a balance.
- **Record Returns** — unsold quantities per product.
- **Record Expense** — parking/fuel/tyre etc. against this dispatch's cash-in-hand,
  from `expense_categories/list`. Always saved *pending*; admins approve or reject
  in-screen, and only approved ones reduce net expected.

Manual **cash** collections posted from the app can be voided or corrected
(`void_collection` / `edit_collection`); automatic KCB/M-Pesa confirmations can't,
and the UI won't offer it for them.

**Report** — per-dispatch reconciliation sheet: items (dispatched/returned/net),
reconciled totals, expenses with approved total, signature lines.

**Admin dashboard** — the same figures as the web dashboard, from
`reports/dashboard_summary` + `needs_attention` + `route_performance` +
`reports/summary` + `mpesa_recon`: Collected-today hero, KPI grid (Dispatched &
M-Pesa are live *today*; Returned, Cash and Short are *yesterday* because they're
only knowable at EOD), Needs-attention, route performance worst-first, a 7-day
dispatched-vs-collected trend, and M-Pesa by till. Every block degrades on its own
and the KPIs fall back to a client-side route rollup.

**Management** — dispatch register + New Dispatch, **New School Dispatch**
(direct-to-school: no route, delivered/invoiced/completed in one call, with
quick-add school), vehicles, agents, schools & customers, invoices (payments post
against the *customer account* and auto-allocate oldest-first), **Shortages**
(short vs overpaid over a range, filterable by vehicle), **Commissions** (an
agent's applicable rates + the earned-commission report), and the **Reports** hub
mirroring the web catalogue with period chips.

**Side menu** — slide-in drawer grouped Fleet / Finance like the web sidebar.

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
│   ├── admin/     # Dashboard, Reconciliation, Monthly, Team, RouteRecon, Dispatches,
│   │              #   CreateDispatch, SchoolDispatch, Vehicles, Agents, Customers,
│   │              #   CustomerDetail, Invoices, Shortages, Reports, ReportView
│   └── shared/    # DispatchDetail, DispatchReportView, Commissions
└── theme/
```

## Reports covered

`daily_recon`, `weekly_sales`, `shortage`, `overpayment`, `mpesa_recon`,
`route_performance`, `agent_performance`, `commission`, `lpo_sales`, `cashflow`,
`monthly_sales_by_vehicle`, `vehicle_month_detail`, `summary`,
`dashboard_summary`, `needs_attention` — plus the per-entity reports
(`routes/report`, `drivers/report`, `agents/report`, `vehicles/report`).

## Still open

- **Field names.** Reports, customers, invoices, expenses and the dashboard
  endpoints are read *defensively* (each value tries several plausible keys and
  tolerates numbers arriving as strings). Grab one real response per endpoint and
  the mappings can be pinned exactly — see `pick()` in `src/api/summary.ts` and the
  `rowsOf`/`str` helpers in the report screens for where to tighten.
- **LPO document upload** (`create_school` `lpo_document`) is multipart-only; the
  app posts JSON, so the scan is attached on the web for now.
- **Collection corrections need an `entry_id`.** `dispatch/detail` doesn't return a
  collections array, so the app can only offer void/edit for entries it posted
  itself (it keeps the id from `record_collection`). If detail starts returning
  `collections[]`, the list fills in automatically.
- **Web-only modules** with no `/api/v1` equivalent yet: Routes/Products/Drivers
  CRUD, Route Assignments, Sync Tracker Devices, PayBills & payment channels, SMS.

_The app icon/splash in `assets/` are placeholders — swap in final brand art._
