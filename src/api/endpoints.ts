import { apiRequest, requestToken, setSession, clearSession } from './client';
import config from '../config';
import { toMsisdn } from '../utils/format';
import {
  TokenResponse,
  UserProfile,
  Vehicle,
  Driver,
  Agent,
  Product,
  Route,
  Account,
  DispatchOrder,
  DispatchDetail,
  DispatchReport,
  DriverReport,
  VehicleReport,
  RouteReport,
  CollectionMethod,
  RecordCollectionResult,
  StkPushResult,
  StkStatus,
  DispatchStatus,
} from './types';

// ---------- Auth ----------
export async function login(phone: string, password: string): Promise<TokenResponse> {
  const res = await requestToken({
    grant_type: 'password',
    client_id: config.clientId,
    username: toMsisdn(phone), // 254 + last 9 digits (accepts 0723…, 2547…, +254…)
    password,
  });
  await setSession(res);
  return res;
}

export async function logout(): Promise<void> {
  await clearSession();
}

export const forgotPassword = (identity: string) =>
  apiRequest<{ status: number; description: string }>('/api/v1/oauth/forgot_password', {
    method: 'POST',
    body: { identity },
    auth: false,
  });

export const confirmCode = (identity: string, otp_code: string) =>
  apiRequest<{ reset_code: string }>('/api/v1/oauth/confirm_code', {
    method: 'POST',
    body: { identity, otp_code },
    auth: false,
  });

export const resetPassword = (reset_code: string, new_password: string) =>
  apiRequest<{ status: number; description: string }>('/api/v1/oauth/reset_password', {
    method: 'POST',
    body: { reset_code, new_password },
    auth: false,
  });

// ---------- User ----------
export const getMe = () => apiRequest<UserProfile>('/api/v1/users/me');

export const updateProfile = (patch: Partial<Pick<UserProfile, 'first_name' | 'last_name' | 'email' | 'phone'>>) =>
  apiRequest<UserProfile>('/api/v1/users/update_profile', { method: 'POST', body: patch });

// ---------- Reference data ----------
export const listVehicles = () => apiRequest<Vehicle[]>('/api/v1/vehicles/list');
export const listDrivers = () => apiRequest<Driver[]>('/api/v1/drivers/list');
export const listAgents = () => apiRequest<Agent[]>('/api/v1/agents/list');
export const listProducts = () => apiRequest<Product[]>('/api/v1/products/list');
export const listRoutes = () => apiRequest<Route[]>('/api/v1/routes/list');
export const listAccounts = () => apiRequest<Account[]>('/api/v1/accounts/list');

// ---------- Dispatch ----------
export const myDispatches = (params: { date?: string; status?: DispatchStatus } = {}) =>
  apiRequest<DispatchOrder[]>('/api/v1/dispatch/mine', { query: params });

export const listDispatches = (params: { status?: DispatchStatus; date?: string; page?: number; per_page?: number } = {}) =>
  apiRequest<DispatchOrder[]>('/api/v1/dispatch/list', { query: params });

export const dispatchDetail = (id: number) =>
  apiRequest<DispatchDetail>('/api/v1/dispatch/detail', { query: { id } });

export const changeDispatchStatus = (id: number, status: DispatchStatus) =>
  apiRequest<{ status: number; message?: string }>('/api/v1/dispatch/change_status', {
    method: 'POST',
    body: { id, status },
  });

export const recordCollection = (input: {
  dispatch_id: number;
  amount: number;
  method: CollectionMethod;
  phone_number?: string;
  notes?: string;
  dispatch_sale_id?: number;
}) =>
  apiRequest<RecordCollectionResult>('/api/v1/dispatch/record_collection', {
    method: 'POST',
    body: input,
  });

export const initiateStkPush = (input: {
  dispatch_id: number;
  phone_number: string;
  amount: number;
  description?: string;
}) =>
  apiRequest<StkPushResult>('/api/v1/dispatch/initiate_stk_push', { method: 'POST', body: input });

export const stkStatus = (params: { invoice_number?: string; checkout_request_id?: string }) =>
  apiRequest<StkStatus>('/api/v1/dispatch/stk_status', { query: params });

// ---------- Reports (reconciliation) ----------
// Note: from/to default to today server-side when omitted.
export const dispatchReport = (params: { from?: string; to?: string } = {}) =>
  apiRequest<DispatchReport>('/api/v1/dispatch/report', { query: params });

export const routeReport = (params: { id: number; from?: string; to?: string }) =>
  apiRequest<RouteReport>('/api/v1/routes/report', { query: params });

export const driverReport = (params: { id: number; from?: string; to?: string }) =>
  apiRequest<DriverReport>('/api/v1/drivers/report', { query: params });

export const vehicleReport = (params: { id: number; from?: string; to?: string }) =>
  apiRequest<VehicleReport>('/api/v1/vehicles/report', { query: params });

// ---------- Dispatch: field sales & lifecycle ----------
export const createDispatch = (input: {
  vehicle_id: number;
  route_id: number;
  driver_id: number; // user id
  agent_id: number; // user id
  items: { product_id: number; quantity: number; price: number }[];
  activate?: boolean;
}) => apiRequest<any>('/api/v1/dispatch/create', { method: 'POST', body: input });

export const recordReturns = (input: {
  dispatch_id: number;
  returns: { product_id: number; quantity: number }[];
}) => apiRequest<any>('/api/v1/dispatch/record_returns', { method: 'POST', body: input });

export const remainingStock = (dispatch_id: number) =>
  apiRequest<any>('/api/v1/dispatch/remaining_stock', { query: { dispatch_id } });

export const recordSale = (input: {
  dispatch_id: number;
  customer_name?: string;
  customer_phone?: string;
  sale_type?: 'cash' | 'lpo';
  customer_id?: number; // required for lpo
  lpo_number?: string; // required for lpo
  items: { product_id: number; quantity: number }[];
}) => apiRequest<any>('/api/v1/dispatch/record_sale', { method: 'POST', body: input });

// ---------- Customers ----------
export const searchCustomers = (term?: string) =>
  apiRequest<any>('/api/v1/customers/search', { query: { term } });
export const getCustomer = (id: number) => apiRequest<any>(`/api/v1/customers/get/${id}`);
export const createCustomer = (input: {
  name: string;
  customer_type?: 'school' | 'other';
  contact_person?: string;
  phone?: string;
  email?: string;
  physical_address?: string;
  kra_pin?: string;
  credit_limit?: number;
  payment_terms_days?: number;
}) => apiRequest<any>('/api/v1/customers/create', { method: 'POST', body: input });

// ---------- Invoices (LPO / AR) ----------
export const listInvoices = (status?: string) =>
  apiRequest<any>('/api/v1/invoices/list', { query: { status } });
export const uninvoicedSales = (params: { customer_id: number; from?: string; to?: string }) =>
  apiRequest<any>('/api/v1/invoices/uninvoiced', { query: params });
export const createInvoice = (input: {
  customer_id: number;
  dispatch_sale_ids: number[];
  lpo_number?: string;
  period_from?: string;
  period_to?: string;
}) => apiRequest<any>('/api/v1/invoices/create', { method: 'POST', body: input });
export const recordInvoicePayment = (input: {
  invoice_id: number;
  amount: number;
  paid_on?: string;
  reference?: string;
}) => apiRequest<any>('/api/v1/invoices/record_payment', { method: 'POST', body: input });

// ---------- Reports ----------
type RangeParams = { from?: string; to?: string; status?: string };
export const dailyRecon = (params: { date?: string; status?: string } = {}) =>
  apiRequest<any>('/api/v1/reports/daily_recon', { query: params });
export const weeklySales = (params: RangeParams = {}) =>
  apiRequest<any>('/api/v1/reports/weekly_sales', { query: params });
export const shortageReport = (params: { from?: string; to?: string; vehicle_id?: number } = {}) =>
  apiRequest<any>('/api/v1/reports/shortage', { query: params });
export const overpaymentReport = (params: { from?: string; to?: string; vehicle_id?: number } = {}) =>
  apiRequest<any>('/api/v1/reports/overpayment', { query: params });
export const mpesaRecon = (params: { from?: string; to?: string; limit?: number } = {}) =>
  apiRequest<any>('/api/v1/reports/mpesa_recon', { query: params });
export const routePerformance = (params: RangeParams = {}) =>
  apiRequest<any>('/api/v1/reports/route_performance', { query: params });
export const agentPerformance = (params: RangeParams = {}) =>
  apiRequest<any>('/api/v1/reports/agent_performance', { query: params });
export const lpoSales = (params: RangeParams = {}) =>
  apiRequest<any>('/api/v1/reports/lpo_sales', { query: params });
export const monthlySalesByVehicle = (params: { month?: string; status?: string } = {}) =>
  apiRequest<any>('/api/v1/reports/monthly_sales_by_vehicle', { query: params });
export const vehicleMonthDetail = (params: { vehicle_id: number; month?: string; status?: string }) =>
  apiRequest<any>('/api/v1/reports/vehicle_month_detail', { query: params });
export const reportsSummary = (period: '7d' | '30d' | '90d' = '7d') =>
  apiRequest<any>('/api/v1/reports/summary', { query: { period } });
export const dashboardSummaryApi = (date?: string) =>
  apiRequest<any>('/api/v1/reports/dashboard_summary', { query: { date } });
export const needsAttention = (date?: string) =>
  apiRequest<any>('/api/v1/reports/needs_attention', { query: { date } });

// ---------- CRUD: agents & vehicles ----------
type AgentStatus = 'active' | 'suspended' | 'on_leave';
export const createAgent = (input: { first_name: string; last_name: string; phone: string; id_number: string; status: AgentStatus }) =>
  apiRequest<any>('/api/v1/agents/create', { method: 'POST', body: input });
export const updateAgent = (input: { agent_id: number; user_id: number; first_name: string; last_name: string; phone: string; id_number: string; status: AgentStatus }) =>
  apiRequest<any>('/api/v1/agents/update', { method: 'POST', body: input });
export const deleteAgent = (agent_id: number) =>
  apiRequest<any>('/api/v1/agents/delete', { method: 'POST', body: { agent_id } });

type VehicleStatus = 'active' | 'maintenance' | 'retired';
export const createVehicle = (input: { registration_number: string; make: string; model: string; capacity_kg: number; status: VehicleStatus }) =>
  apiRequest<any>('/api/v1/vehicles/create', { method: 'POST', body: input });
export const updateVehicle = (input: { id: number; registration_number: string; make: string; model: string; capacity_kg: number; status: VehicleStatus }) =>
  apiRequest<any>('/api/v1/vehicles/update', { method: 'POST', body: input });
export const deleteVehicle = (id: number) =>
  apiRequest<any>('/api/v1/vehicles/delete', { method: 'POST', body: { id } });
