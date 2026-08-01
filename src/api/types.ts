/**
 * Types generated from the Jolly Bakery Mobile API (api/v1) response schemas.
 * Every success envelope is `{ status: 0, ... }`; errors are `{ status: 1|<http>, message|description }`.
 */

/** Standard success envelope with a `data` payload. */
export type ApiEnvelope<T> = {
  status: number;
  data?: T;
  message?: string;
  description?: string;
};

// ---- Auth ----
export type TokenResponse = {
  access_token: string;
  expires_in: number; // seconds (86400 = 24h)
  token_type: string; // "Bearer" | "bearer"
  refresh_token: string;
};

export type Role = 'admin' | 'sales' | 'dispatcher' | 'driver' | 'agent' | string;

export type UserProfile = {
  id: number;
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  roles: Role[];
};

// ---- Reference data ----
export type Vehicle = {
  id: number;
  registration_number: string;
  make: string;
  model: string;
  capacity_kg: number;
  status: string;
};

export type Driver = {
  id: number;
  user_id: number;
  first_name: string;
  last_name: string;
  phone: string;
  id_number: string;
  license_number: string;
  license_class: string;
  license_expiry: string;
  status: string;
};

export type Agent = {
  id: number;
  user_id: number;
  first_name: string;
  last_name: string;
  phone: string;
  id_number: string;
  email: string;
  status: string;
};

export type Product = {
  id: number;
  sku: string;
  name: string;
  category: string;
  price: number;
  weight_kg: number;
  status: string;
};

export type Route = {
  id: number;
  name: string;
  description: string;
  has_account: boolean;
};

export type Account = {
  id: number;
  name: string;
  account_type: 'till' | 'bank' | string;
};

// ---- Dispatch ----
export type DispatchStatus = 'draft' | 'pending' | 'active' | 'completed' | 'cancelled';

export type DispatchRef = { id: number; name: string };
export type VehicleRef = { id: number; registration_number: string };

export type DispatchOrder = {
  id: number;
  order_number: string; // DSP-XXXXX
  dispatch_date: string;
  status: DispatchStatus;
  total_amount: number; // value dispatched
  returns_value?: number;
  net_expected?: number;
  shortage_amount?: number;
  route: DispatchRef | null;
  vehicle: VehicleRef | null;
  driver: DispatchRef | null;
  agent: DispatchRef | null;
  dispatched_time: string | null;
  completed_time: string | null;
  created_on: string;
};

export type DispatchItem = {
  product_id: number;
  product_name: string;
  quantity: number;
  returned_quantity?: number;
  price: number;
  subtotal: number;
};

/** Rows from dispatch/remaining_stock (values arrive as strings). */
export type RemainingStockItem = {
  product_id: number | string;
  product_name: string;
  dispatched_qty: number | string;
  price: number | string;
  remaining_qty: number | string;
};

/** The reconciliation block returned by record_collection / record_returns. */
export type Reconciliation = {
  dispatched: number;
  sales_total: number;
  returns_value: number;
  lpo_value: number;
  unaccounted_value: number;
  overpayment_value: number;
  net_expected: number;
  collected: number;
  variance: number;
  returns_recorded?: boolean;
};

export type DispatchSale = {
  id?: number;
  customer_name?: string;
  sale_type?: string;
  total?: number;
  amount?: number;
  created_on?: string;
  items?: DispatchItem[];
};

export type DispatchPayment = {
  id?: number;
  time?: string;
  created_on?: string;
  source?: string; // "KCB/MPESA" | "MANUAL" | ...
  method?: string;
  amount?: number;
  customer?: string;
  customer_name?: string;
  transaction_id?: string;
  mpesa_receipt?: string;
  receipt_number?: string;
};

/** Reconciliation numbers shown on the dispatch detail. Field names are mapped defensively. */
export type DispatchDetail = DispatchOrder & {
  items: DispatchItem[];
  sales?: DispatchSale[];
  payments?: DispatchPayment[];
  // reconciliation (any of these may be present depending on server version)
  sold?: number;
  unaccounted?: number;
  collected?: number;
  collected_total?: number;
  variance?: number;
  overpaid?: number;
  net_expected?: number;
  returns_value?: number;
};

export type CollectionMethod = 'cash' | 'mpesa_manual';

export type RecordCollectionResult = {
  status: number;
  message?: string;
  transaction_id: string; // e.g. MANUAL-...
  balance_after: number;
  sale_status?: string | null;
  reconciliation?: Reconciliation;
};

export type StkPushResult = {
  status: number;
  message?: string;
  invoice_number: string;
  checkout_request_id: string;
};

export type StkStatus = {
  id: number;
  invoice_number: string;
  checkout_request_id: string;
  amount: number;
  phone_number: string;
  status: 'pending' | 'success' | 'failed' | string;
  receipt_number: string;
  result_code: string;
  result_description: string;
  created_on: string;
  modified_on: string;
};

// ---- Reports (reconciliation) ----
export type DriverReport = {
  from: string;
  to: string;
  trip_count: number;
  total_value: number; // dispatched throughput
};

export type VehicleReport = DriverReport;

export type RouteReport = {
  route: { id: number; name: string };
  from: string;
  to: string;
  trip_count: number;
  dispatched_total: number;
  collected_total: number;
  returns_total?: number;
  net_expected_total?: number; // dispatched - returns (what's owed)
  // derived client-side: short = net_expected_total - collected_total (fallback dispatched - collected)
};

export type DispatchReport = {
  from: string;
  to: string;
  trip_count: number;
  total_value: number;
  returns_value?: number;
  net_expected_value?: number;
  status_counts: Record<DispatchStatus, number>;
  dispatches: DispatchOrder[];
};

/** short (shortfall) for a route report. Positive = under-collected. */
export function shortOf(r: Pick<RouteReport, 'dispatched_total' | 'collected_total'>): number {
  return r.dispatched_total - r.collected_total;
}
