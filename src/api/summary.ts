import {
  listRoutes,
  routeReport,
  routePerformance,
  dashboardSummaryApi,
  needsAttention,
  reportsSummary,
  mpesaRecon,
} from './endpoints';
import { ymd } from './dates';
import { asTable, rowObjects, figure } from './tables';

/** Run async fn over items with a concurrency cap (avoid 43 simultaneous requests). */
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += limit) {
    const batch = items.slice(i, i + limit);
    const res = await Promise.all(batch.map(fn));
    out.push(...res);
  }
  return out;
}

export type RoutePerf = {
  id: number;
  name: string;
  collected: number;
  dispatched: number;
  netExpected: number;
  short: number;
  pct: number; // collected / net-expected (0..1)
};

export type DashboardSummary = {
  totals: {
    collected: number;
    dispatched: number;
    returns: number;
    netExpected: number;
    netPosition: number;
    shortages: number;
    routesShort: number;
  };
  routes: RoutePerf[]; // worst collection % first
  /** routes with at least one trip in the range */
  routesActive?: number;
};

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/**
 * reports/route_performance is a table — columns Route | Trips | Dispatched |
 * Collected | Rate | Status, values pre-formatted ("KES 9,385", "0%"). It names
 * routes but carries no id, so ids come from routes/list (one call).
 */
async function buildFromPerf(res: unknown): Promise<DashboardSummary | null> {
  const table = asTable(res);
  if (!table || table.rows.length === 0) return null;
  const ids = new Map<string, number>();
  try {
    for (const r of await listRoutes()) ids.set(String(r.name).trim().toUpperCase(), num(r.id));
  } catch {
    /* rows still render; they just won't open the route screen */
  }
  let collected = 0, dispatched = 0, shortages = 0, routesShort = 0, routesActive = 0;
  const routes: RoutePerf[] = rowObjects(table).map((r) => {
    const name = r['Route'] || 'Route';
    const c = figure(r['Collected']);
    const d = figure(r['Dispatched']);
    if (figure(r['Trips']) > 0) routesActive += 1;
    const short = Math.max(0, d - c);
    collected += c; dispatched += d;
    if (short > 0) routesShort += 1;
    shortages += short;
    return {
      id: ids.get(name.trim().toUpperCase()) ?? 0,
      name, collected: c, dispatched: d, netExpected: d, short,
      pct: r['Rate'] ? figure(r['Rate']) / 100 : d > 0 ? c / d : 0,
    };
  });
  // routes that ran a trip first (worst rate first), then the rest by money in
  routes.sort((a, b) =>
    Number(b.dispatched > 0) - Number(a.dispatched > 0) ||
    (a.dispatched > 0 ? a.pct - b.pct || b.short - a.short : b.collected - a.collected)
  );
  return {
    totals: { collected, dispatched, returns: 0, netExpected: dispatched, netPosition: dispatched - collected, shortages, routesShort },
    routes,
    routesActive,
  };
}

/** Legacy fallback: aggregate routes/report across every route (43 calls). */
async function legacyAggregate(from?: string, to?: string): Promise<DashboardSummary> {
  const routes = await listRoutes();
  const reports = await mapLimit(routes, 8, (r) =>
    routeReport({ id: r.id, from, to })
      .then((rep) => ({ r, rep }))
      .catch(() => ({ r, rep: null as Awaited<ReturnType<typeof routeReport>> | null }))
  );
  let collected = 0, dispatched = 0, returns = 0, netExpected = 0, shortages = 0, routesShort = 0;
  const perRoute: RoutePerf[] = reports.map(({ r, rep }) => {
    const c = rep?.collected_total ?? 0;
    const d = rep?.dispatched_total ?? 0;
    const ret = rep?.returns_total ?? 0;
    const ne = rep?.net_expected_total ?? d;
    collected += c; dispatched += d; returns += ret; netExpected += ne;
    const short = Math.max(0, ne - c);
    if (short > 0) routesShort += 1;
    shortages += short;
    const base = ne || d;
    return { id: r.id, name: r.name, collected: c, dispatched: d, netExpected: ne, short, pct: base > 0 ? c / base : 0 };
  });
  perRoute.sort((a, b) => a.pct - b.pct || b.short - a.short);
  return {
    totals: { collected, dispatched, returns, netExpected, netPosition: netExpected - collected, shortages, routesShort },
    routes: perRoute,
  };
}

/**
 * Dashboard KPIs + per-route performance.
 * Prefers the single `reports/route_performance` call; falls back to the
 * per-route rollup if that endpoint's shape isn't usable yet.
 */
export async function fetchDashboardSummary(from?: string, to?: string): Promise<DashboardSummary> {
  try {
    const built = await buildFromPerf(await routePerformance({ from, to }));
    if (built) return built;
  } catch {
    /* fall through to legacy */
  }
  return legacyAggregate(from, to);
}

/* ------------------------------------------------------------------ *
 * Admin dashboard — the same figures the web dashboard shows.
 *
 * Dispatched + M-Pesa are real-time ("today"); Returned, Cash and Short are
 * only knowable at end of day, so the server reports YESTERDAY for those three.
 * Every block degrades independently: if one endpoint is unavailable we keep
 * the rest and fall back to the client-side route rollup for the KPIs.
 * ------------------------------------------------------------------ */

export type AttentionVehicle = { name: string; route: string; agent: string; shortage: number };

export type AdminDashboard = {
  date: string;
  kpis: {
    collectedToday: number;
    dispatchedToday: number;
    returnedYesterday: number;
    mpesaToday: number;
    cashYesterday: number;
    shortYesterday: number;
    vehiclesOnRoad: number;
    vehiclesShort: number;
    dispatchedChangePct: number | null;
    mpesaChangePct: number | null;
  };
  attention: {
    outstanding: number;
    vehicles: AttentionVehicle[];
    agentsAffected: number;
    openDispatches: number;
    oldestOpen: string | null;
    overpaymentToday: number;
    overdueInvoices: number;
    outstandingLpo: number;
  } | null;
  routes: RoutePerf[];
  trend: { label: string; dispatched: number; collected: number }[];
  mpesaByTill: { name: string; amount: number }[];
  /** true when the KPI block came from the client-side rollup, not the server */
  degraded: boolean;
};

/** First present, non-empty value among the candidate keys. */
function pick(obj: any, keys: string[]): unknown {
  if (!obj) return undefined;
  for (const k of keys) {
    const v = obj[k];
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return undefined;
}
const pickNum = (obj: any, keys: string[]): number => num(pick(obj, keys));
/** today vs yesterday in %, one decimal — null when there's no yesterday to compare to. */
const changePct = (today: number, yesterday: number): number | null =>
  yesterday > 0 ? Math.round(((today - yesterday) / yesterday) * 1000) / 10 : null;
const pickStr = (obj: any, keys: string[]): string => {
  const v = pick(obj, keys);
  return v == null ? '' : String(v);
};

/** Unwrap `{data:…}` one level and find the first array under any of `keys`. */
function firstArray(res: any, keys: string[]): any[] {
  const root = res?.data ?? res;
  if (Array.isArray(root)) return root;
  for (const k of keys) {
    if (Array.isArray(root?.[k])) return root[k];
  }
  // last resort: the longest array anywhere at the top level
  const arrays = Object.values(root ?? {}).filter(Array.isArray) as any[][];
  return arrays.sort((a, b) => b.length - a.length)[0] ?? [];
}

function buildTrend(res: any): { label: string; dispatched: number; collected: number }[] {
  const rows = firstArray(res, ['days', 'chart', 'series', 'trend', 'dispatches']);
  return rows
    .map((r) => {
      const rawDate = pickStr(r, ['date', 'day', 'label', 'dispatch_date']);
      let label = rawDate;
      const d = new Date(rawDate);
      if (rawDate && !Number.isNaN(d.getTime())) {
        label = d.toLocaleDateString('en-KE', { weekday: 'short' });
      }
      return {
        label,
        dispatched: pickNum(r, ['dispatched', 'dispatched_total', 'total_value', 'value']),
        collected: pickNum(r, ['collected', 'collected_total']),
      };
    })
    .filter((r) => r.label);
}

/** reports/mpesa_recon table — Date | Transaction ID | Route / Account | Amount | Status. */
function buildMpesaByTill(res: any): { name: string; amount: number }[] {
  const table = asTable(res);
  if (!table) return [];
  const totals = new Map<string, number>();
  for (const r of rowObjects(table)) {
    const name = r['Route / Account'] || 'Unattributed';
    const amt = figure(r['Amount']);
    if (!amt) continue;
    totals.set(name, (totals.get(name) ?? 0) + amt);
  }
  return [...totals.entries()]
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 10);
}

/**
 * reports/needs_attention: { shortage_total, shortage_count, shortage_rows[],
 * open_no_eod_count, open_no_eod_oldest_date, overpayment_swept_today,
 * overdue_invoices_count, total_outstanding_lpo }.
 */
function buildAttention(res: any): AdminDashboard['attention'] {
  const root = res?.data ?? res;
  if (!root || typeof root !== 'object') return null;
  const rows: any[] = Array.isArray(root.shortage_rows) ? root.shortage_rows : firstArray(root, ['vehicles', 'short_vehicles', 'rows']);
  return {
    outstanding: pickNum(root, ['shortage_total', 'outstanding', 'total_shortage', 'shortage']),
    vehicles: rows.map((v) => ({
      name: pickStr(v, ['registration_number', 'vehicle', 'vehicle_registration', 'name']) || '—',
      route: pickStr(v, ['route', 'route_name']) || '—',
      agent: pickStr(v, ['agent', 'agent_name', 'driver', 'driver_name']) || '—',
      shortage: pickNum(v, ['shortage', 'shortage_amount', 'short', 'amount']),
    })),
    agentsAffected: pickNum(root, ['agents_affected', 'agents']),
    openDispatches: pickNum(root, ['open_no_eod_count', 'open_dispatches']),
    oldestOpen: (pick(root, ['open_no_eod_oldest_date', 'oldest_open_dispatch']) as string) ?? null,
    overpaymentToday: pickNum(root, ['overpayment_swept_today', 'overpayment_today']),
    overdueInvoices: pickNum(root, ['overdue_invoices_count']),
    outstandingLpo: pickNum(root, ['total_outstanding_lpo']),
  };
}

export async function fetchAdminDashboard(date = ymd()): Promise<AdminDashboard> {
  const [kpiRes, attnRes, perfRes, trendRes, mpesaRes] = await Promise.allSettled([
    dashboardSummaryApi(date),
    needsAttention(date),
    routePerformance({ from: date, to: date }),
    reportsSummary('7d'),
    mpesaRecon({ from: date, to: date, limit: 0 }),
  ]);

  const kpiRaw: any = kpiRes.status === 'fulfilled' ? (kpiRes.value as any)?.data ?? kpiRes.value : null;

  // Route performance drives the "worst first" list and backs up the KPIs.
  let perf: DashboardSummary | null = null;
  if (perfRes.status === 'fulfilled') perf = await buildFromPerf(perfRes.value).catch(() => null);
  if (!perf) {
    try {
      perf = await fetchDashboardSummary(date, date);
    } catch {
      perf = null;
    }
  }

  const hasKpis = !!kpiRaw && typeof kpiRaw === 'object' && Object.keys(kpiRaw).length > 0;
  const t = perf?.totals;

  const kpis = {
    collectedToday: hasKpis ? pickNum(kpiRaw, ['collected_today', 'collected', 'collected_total']) : num(t?.collected),
    dispatchedToday: hasKpis ? pickNum(kpiRaw, ['dispatched_today', 'dispatched', 'dispatched_total']) : num(t?.dispatched),
    returnedYesterday: hasKpis
      ? pickNum(kpiRaw, ['returns_yesterday', 'returned_yesterday', 'returns'])
      : num(t?.returns),
    mpesaToday: hasKpis ? pickNum(kpiRaw, ['mpesa_today', 'mpesa', 'mpesa_total']) : 0,
    cashYesterday: hasKpis ? pickNum(kpiRaw, ['cash_yesterday', 'cash', 'cash_total']) : 0,
    shortYesterday: hasKpis
      ? pickNum(kpiRaw, ['shortage_yesterday', 'short_yesterday', 'shortage'])
      : num(t?.shortages),
    // dashboard_summary has no vehicle count — routes that ran a trip today stand in
    vehiclesOnRoad: pickNum(kpiRaw, ['vehicles_on_road']) || (perf?.routesActive ?? 0),
    vehiclesShort: hasKpis ? pickNum(kpiRaw, ['vehicles_short', 'short_vehicles']) : num(t?.routesShort),
    // the web shows "% vs yesterday"; the API gives both days, so derive it the same way
    dispatchedChangePct: hasKpis
      ? changePct(pickNum(kpiRaw, ['dispatched_today']), pickNum(kpiRaw, ['dispatched_yesterday']))
      : null,
    mpesaChangePct: hasKpis
      ? changePct(pickNum(kpiRaw, ['mpesa_today']), pickNum(kpiRaw, ['mpesa_yesterday']))
      : null,
  };

  return {
    date,
    kpis,
    attention: attnRes.status === 'fulfilled' ? buildAttention(attnRes.value) : null,
    routes: perf?.routes ?? [],
    trend: trendRes.status === 'fulfilled' ? buildTrend(trendRes.value) : [],
    mpesaByTill: mpesaRes.status === 'fulfilled' ? buildMpesaByTill(mpesaRes.value) : [],
    degraded: !hasKpis,
  };
}
