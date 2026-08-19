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
};

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** Pull the route array out of whatever envelope reports/route_performance uses. */
function extractRows(res: any): any[] {
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.routes)) return res.routes;
  if (Array.isArray(res?.data)) return res.data;
  if (Array.isArray(res?.data?.routes)) return res.data.routes;
  return [];
}

/** Map a route_performance row defensively (field names not in the spec yet). */
function buildFromPerf(rows: any[]): DashboardSummary {
  let collected = 0, dispatched = 0, netExpected = 0, returns = 0, shortages = 0, routesShort = 0;
  const routes: RoutePerf[] = rows.map((r) => {
    const id = num(r.route_id ?? r.id ?? 0);
    const name = r.route_name ?? r.name ?? r.route ?? 'Route';
    const c = num(r.collected ?? r.collected_total ?? 0);
    const d = num(r.dispatched ?? r.dispatched_total ?? 0);
    const ret = num(r.returns ?? r.returns_total ?? 0);
    const ne = num(r.net_expected ?? r.net_expected_total ?? (d - ret || d));
    const rawRate = r.rate ?? r.collection_rate ?? r.collected_rate;
    let pct: number;
    if (rawRate != null && rawRate !== '') {
      const rr = num(rawRate);
      pct = rr > 1 ? rr / 100 : rr; // tolerate 0..1 or 0..100
    } else {
      const base = ne || d;
      pct = base > 0 ? c / base : 0;
    }
    const short = Math.max(0, (ne || d) - c);
    collected += c; dispatched += d; netExpected += ne; returns += ret;
    if (short > 0) routesShort += 1;
    shortages += short;
    return { id, name, collected: c, dispatched: d, netExpected: ne, short, pct };
  });
  routes.sort((a, b) => a.pct - b.pct || b.short - a.short);
  return {
    totals: { collected, dispatched, returns, netExpected, netPosition: netExpected - collected, shortages, routesShort },
    routes,
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
    const res = await routePerformance({ from, to });
    const rows = extractRows(res);
    if (rows.length > 0) return buildFromPerf(rows);
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

function buildMpesaByTill(res: any): { name: string; amount: number }[] {
  const rows = firstArray(res, ['transactions', 'rows', 'matched', 'entries', 'by_till', 'tills']);
  const totals = new Map<string, number>();
  for (const r of rows) {
    const name =
      pickStr(r, ['till_name', 'till', 'account_name', 'account', 'route_name', 'route', 'short_code', 'shortcode']) ||
      'Unattributed';
    const amt = pickNum(r, ['amount', 'trans_amount', 'value', 'collected']);
    if (!amt) continue;
    totals.set(name, (totals.get(name) ?? 0) + amt);
  }
  return [...totals.entries()]
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 10);
}

function buildAttention(res: any): AdminDashboard['attention'] {
  const root = res?.data ?? res;
  if (!root || typeof root !== 'object') return null;
  const rows = firstArray(root, ['vehicles', 'short_vehicles', 'rows']);
  return {
    outstanding: pickNum(root, ['outstanding', 'outstanding_value', 'total_shortage', 'shortage']),
    vehicles: rows.map((v) => ({
      name: pickStr(v, ['registration_number', 'vehicle', 'vehicle_registration', 'name']) || '—',
      route: pickStr(v, ['route', 'route_name']) || '—',
      agent: pickStr(v, ['agent', 'agent_name', 'driver', 'driver_name']) || '—',
      shortage: pickNum(v, ['shortage', 'shortage_amount', 'short', 'amount']),
    })),
    agentsAffected: pickNum(root, ['agents_affected', 'agents']),
    openDispatches: pickNum(root, ['open_dispatches', 'dispatches_open', 'open']),
    oldestOpen: (pick(root, ['oldest_open_dispatch', 'oldest_open', 'oldest']) as string) ?? null,
    overpaymentToday: pickNum(root, ['overpayment_today', 'overpayment', 'overpayment_value']),
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
  if (perfRes.status === 'fulfilled') {
    const rows = extractRows(perfRes.value);
    if (rows.length > 0) perf = buildFromPerf(rows);
  }
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
      ? pickNum(kpiRaw, ['returned_yesterday', 'returned', 'returns', 'returns_value'])
      : num(t?.returns),
    mpesaToday: hasKpis ? pickNum(kpiRaw, ['mpesa_today', 'mpesa', 'mpesa_total']) : 0,
    cashYesterday: hasKpis ? pickNum(kpiRaw, ['cash_yesterday', 'cash', 'cash_total']) : 0,
    shortYesterday: hasKpis
      ? pickNum(kpiRaw, ['short_yesterday', 'short', 'shortage', 'shortage_value'])
      : num(t?.shortages),
    vehiclesOnRoad: hasKpis ? pickNum(kpiRaw, ['vehicles_on_road', 'vehicles', 'vehicle_count']) : perf?.routes.length ?? 0,
    vehiclesShort: hasKpis ? pickNum(kpiRaw, ['vehicles_short', 'short_vehicles']) : num(t?.routesShort),
    dispatchedChangePct: hasKpis
      ? (pick(kpiRaw, ['dispatched_change_pct', 'dispatched_vs_yesterday', 'dispatched_change']) as number ?? null)
      : null,
    mpesaChangePct: hasKpis
      ? (pick(kpiRaw, ['mpesa_change_pct', 'mpesa_vs_yesterday', 'mpesa_change']) as number ?? null)
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
