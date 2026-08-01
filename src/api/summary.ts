import { listRoutes, routeReport, routePerformance } from './endpoints';

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
