import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from './endpoints';
import { fetchDashboardSummary } from './summary';
import { ymd } from './dates';
import { DispatchStatus, CollectionMethod } from './types';

/** Query keys kept in one place so mutations can invalidate precisely. */
export const qk = {
  me: ['me'] as const,
  routes: ['routes'] as const,
  vehicles: ['vehicles'] as const,
  drivers: ['drivers'] as const,
  agents: ['agents'] as const,
  products: ['products'] as const,
  accounts: ['accounts'] as const,
  myDispatches: (date: string, status?: DispatchStatus) => ['dispatch', 'mine', date, status ?? 'all'] as const,
  dispatches: (date: string, status?: DispatchStatus) => ['dispatch', 'list', date, status ?? 'all'] as const,
  dispatch: (id: number) => ['dispatch', 'detail', id] as const,
  dispatchReport: (from: string, to: string) => ['report', 'dispatch', from, to] as const,
  routeReport: (id: number, from: string, to: string) => ['report', 'route', id, from, to] as const,
  driverReport: (id: number, from: string, to: string) => ['report', 'driver', id, from, to] as const,
};

// ---- Reference data (cached long) ----
export const useRoutes = () => useQuery({ queryKey: qk.routes, queryFn: api.listRoutes, staleTime: 5 * 60_000 });
export const useVehicles = () => useQuery({ queryKey: qk.vehicles, queryFn: api.listVehicles, staleTime: 5 * 60_000 });
export const useDrivers = () => useQuery({ queryKey: qk.drivers, queryFn: api.listDrivers, staleTime: 5 * 60_000 });
export const useAgents = () => useQuery({ queryKey: qk.agents, queryFn: api.listAgents, staleTime: 5 * 60_000 });
export const useProducts = () => useQuery({ queryKey: qk.products, queryFn: api.listProducts, staleTime: 5 * 60_000 });
export const useAccounts = () => useQuery({ queryKey: qk.accounts, queryFn: api.listAccounts, staleTime: 5 * 60_000 });

// ---- Dispatch ----
export function useMyDispatches(date = ymd(), status?: DispatchStatus) {
  return useQuery({
    queryKey: qk.myDispatches(date, status),
    queryFn: () => api.myDispatches({ date, status }),
  });
}

export function useDispatches(date = ymd(), status?: DispatchStatus) {
  return useQuery({
    queryKey: qk.dispatches(date, status),
    queryFn: () => api.listDispatches({ date, status, per_page: 50 }),
  });
}

/** Full dispatch register (all dates), optionally filtered by status. */
export function useDispatchRegister(status?: DispatchStatus) {
  return useQuery({
    queryKey: ['dispatch', 'register', status ?? 'all'],
    queryFn: () => api.listDispatches({ status, per_page: 50 }),
  });
}

export function useDispatchDetail(id: number | undefined) {
  return useQuery({
    queryKey: qk.dispatch(id ?? -1),
    queryFn: () => api.dispatchDetail(id as number),
    enabled: typeof id === 'number' && id > 0,
  });
}

export function useRemainingStock(dispatchId: number | undefined, enabled = true) {
  return useQuery({
    queryKey: ['dispatch', 'remaining', dispatchId ?? -1],
    queryFn: () => api.remainingStock(dispatchId as number),
    enabled: enabled && typeof dispatchId === 'number' && dispatchId > 0,
  });
}

// ---- Reports ----
export function useDispatchReport(from = ymd(), to = ymd()) {
  return useQuery({ queryKey: qk.dispatchReport(from, to), queryFn: () => api.dispatchReport({ from, to }) });
}

export function useRouteReport(id: number | undefined, from = ymd(), to = ymd()) {
  return useQuery({
    queryKey: qk.routeReport(id ?? -1, from, to),
    queryFn: () => api.routeReport({ id: id as number, from, to }),
    enabled: typeof id === 'number' && id > 0,
  });
}

export function useDriverReport(id: number | undefined, from = ymd(), to = ymd()) {
  return useQuery({
    queryKey: qk.driverReport(id ?? -1, from, to),
    queryFn: () => api.driverReport({ id: id as number, from, to }),
    enabled: typeof id === 'number' && id > 0,
  });
}

// ---- Mutations ----
export function useChangeStatus() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: DispatchStatus }) => api.changeDispatchStatus(id, status),
    onSuccess: (_data, vars) => {
      client.invalidateQueries({ queryKey: ['dispatch'] });
      client.invalidateQueries({ queryKey: qk.dispatch(vars.id) });
      client.invalidateQueries({ queryKey: ['report'] });
    },
  });
}

export function useRecordCollection() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      dispatch_id: number;
      amount: number;
      method: CollectionMethod;
      phone_number?: string;
      notes?: string;
    }) => api.recordCollection(input),
    onSuccess: (_data, vars) => {
      client.invalidateQueries({ queryKey: qk.dispatch(vars.dispatch_id) });
      client.invalidateQueries({ queryKey: ['report'] });
    },
  });
}

export function useInitiateStk() {
  return useMutation({
    mutationFn: (input: { dispatch_id: number; phone_number: string; amount: number; description?: string }) =>
      api.initiateStkPush(input),
  });
}

export function useRecordSale() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof api.recordSale>[0]) => api.recordSale(input),
    onSuccess: (_d, vars) => {
      client.invalidateQueries({ queryKey: qk.dispatch(vars.dispatch_id) });
      client.invalidateQueries({ queryKey: ['report'] });
    },
  });
}

export function useRecordReturns() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof api.recordReturns>[0]) => api.recordReturns(input),
    onSuccess: (_d, vars) => {
      client.invalidateQueries({ queryKey: qk.dispatch(vars.dispatch_id) });
      client.invalidateQueries({ queryKey: ['report'] });
    },
  });
}

/** Polls STK push status every 4s while it's still pending. */
export function useStkStatus(ref: { invoice_number?: string; checkout_request_id?: string } | null) {
  return useQuery({
    queryKey: ['stk', ref?.checkout_request_id ?? ref?.invoice_number ?? 'none'],
    queryFn: () => api.stkStatus(ref as { invoice_number?: string; checkout_request_id?: string }),
    enabled: !!ref,
    refetchInterval: (query: any) => {
      const s = query.state.data?.status;
      return !s || s === 'pending' ? 4000 : false;
    },
  });
}

export function useProfile() {
  return useQuery({ queryKey: qk.me, queryFn: api.getMe });
}

/** Aggregated KPIs + per-route performance (client-side rollup of routes/report). */
export function useDashboardSummary(from = ymd(), to = ymd()) {
  return useQuery({
    queryKey: ['dashboard', 'summary', from, to],
    queryFn: () => fetchDashboardSummary(from, to),
    staleTime: 60_000,
  });
}

// ---- Vehicles CRUD ----
export function useCreateVehicle() {
  const c = useQueryClient();
  return useMutation({ mutationFn: api.createVehicle, onSuccess: () => c.invalidateQueries({ queryKey: qk.vehicles }) });
}
export function useUpdateVehicle() {
  const c = useQueryClient();
  return useMutation({ mutationFn: api.updateVehicle, onSuccess: () => c.invalidateQueries({ queryKey: qk.vehicles }) });
}
export function useDeleteVehicle() {
  const c = useQueryClient();
  return useMutation({ mutationFn: (id: number) => api.deleteVehicle(id), onSuccess: () => c.invalidateQueries({ queryKey: qk.vehicles }) });
}

// ---- Agents CRUD ----
export function useCreateAgent() {
  const c = useQueryClient();
  return useMutation({ mutationFn: api.createAgent, onSuccess: () => c.invalidateQueries({ queryKey: qk.agents }) });
}
export function useUpdateAgent() {
  const c = useQueryClient();
  return useMutation({ mutationFn: api.updateAgent, onSuccess: () => c.invalidateQueries({ queryKey: qk.agents }) });
}
export function useDeleteAgent() {
  const c = useQueryClient();
  return useMutation({ mutationFn: (agentId: number) => api.deleteAgent(agentId), onSuccess: () => c.invalidateQueries({ queryKey: qk.agents }) });
}

// ---- Dispatch create ----
export function useCreateDispatch() {
  const c = useQueryClient();
  return useMutation({
    mutationFn: api.createDispatch,
    onSuccess: () => { c.invalidateQueries({ queryKey: ['dispatch'] }); c.invalidateQueries({ queryKey: ['report'] }); },
  });
}

// ---- Customers ----
export function useCustomerSearch(term: string) {
  return useQuery({ queryKey: ['customers', 'search', term], queryFn: () => api.searchCustomers(term || undefined) });
}
export function useCustomer(id: number | undefined) {
  return useQuery({ queryKey: ['customers', 'get', id ?? -1], queryFn: () => api.getCustomer(id as number), enabled: typeof id === 'number' && id > 0 });
}
export function useCreateCustomer() {
  const c = useQueryClient();
  return useMutation({ mutationFn: api.createCustomer, onSuccess: () => c.invalidateQueries({ queryKey: ['customers'] }) });
}

// ---- Invoices ----
export function useInvoices(status?: string) {
  return useQuery({ queryKey: ['invoices', 'list', status ?? 'all'], queryFn: () => api.listInvoices(status) });
}
export function useUninvoiced(customerId: number | undefined) {
  return useQuery({ queryKey: ['invoices', 'uninvoiced', customerId ?? -1], queryFn: () => api.uninvoicedSales({ customer_id: customerId as number }), enabled: typeof customerId === 'number' && customerId > 0 });
}
export function useCreateInvoice() {
  const c = useQueryClient();
  return useMutation({ mutationFn: api.createInvoice, onSuccess: () => c.invalidateQueries({ queryKey: ['invoices'] }) });
}
export function useRecordInvoicePayment() {
  const c = useQueryClient();
  return useMutation({ mutationFn: api.recordInvoicePayment, onSuccess: () => c.invalidateQueries({ queryKey: ['invoices'] }) });
}

// ---- Reports (generic) ----
type RangeQ = { from?: string; to?: string; status?: string };
export const useDailyRecon = (date = ymd(), status?: string) =>
  useQuery({ queryKey: ['report', 'daily_recon', date, status], queryFn: () => api.dailyRecon({ date, status }) });
export const useWeeklySales = (p: RangeQ = {}) =>
  useQuery({ queryKey: ['report', 'weekly_sales', p], queryFn: () => api.weeklySales(p) });
export const useShortage = (p: { from?: string; to?: string; vehicle_id?: number } = {}) =>
  useQuery({ queryKey: ['report', 'shortage', p], queryFn: () => api.shortageReport(p) });
export const useOverpayment = (p: { from?: string; to?: string; vehicle_id?: number } = {}) =>
  useQuery({ queryKey: ['report', 'overpayment', p], queryFn: () => api.overpaymentReport(p) });
export const useMpesaRecon = (p: { from?: string; to?: string; limit?: number } = {}) =>
  useQuery({ queryKey: ['report', 'mpesa_recon', p], queryFn: () => api.mpesaRecon(p) });
export const useRoutePerformanceReport = (p: RangeQ = {}) =>
  useQuery({ queryKey: ['report', 'route_perf', p], queryFn: () => api.routePerformance(p) });
export const useAgentPerformance = (p: RangeQ = {}) =>
  useQuery({ queryKey: ['report', 'agent_perf', p], queryFn: () => api.agentPerformance(p) });
export const useLpoSales = (p: RangeQ = {}) =>
  useQuery({ queryKey: ['report', 'lpo_sales', p], queryFn: () => api.lpoSales(p) });
export const useMonthlySalesByVehicle = (month?: string) =>
  useQuery({ queryKey: ['report', 'monthly_vehicle', month], queryFn: () => api.monthlySalesByVehicle({ month }) });
export const useReportsSummary = (period: '7d' | '30d' | '90d' = '7d') =>
  useQuery({ queryKey: ['report', 'summary', period], queryFn: () => api.reportsSummary(period) });
export const useNeedsAttention = (date = ymd()) =>
  useQuery({ queryKey: ['report', 'needs_attention', date], queryFn: () => api.needsAttention(date) });
