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

/** Real rows carry id, sale_number, customer_*, expected/collected_amount, status, items. */
export type DispatchSale = {
  id?: number;
  sale_number?: number;
  customer_name?: string;
  customer_phone?: string;
  expected_amount?: number;
  collected_amount?: number;
  status?: string;
  sale_type?: string;
  total?: number;
  amount?: number;
  created_on?: string;
  items?: DispatchItem[];
};

/**
 * A row from `dispatch/detail.payments[]` — manual field collections recorded
 * against this dispatch AND automated KCB/M-Pesa IPNs matched by route+date.
 * An automated IPN has no dispatch of its own, so `dispatch_id` is null there.
 */
export type DispatchPayment = {
  id: number | string;
  dispatch_id: number | string | null;
  amount: number | string;
  transaction_id?: string | null;
  mpesa_receipt_number?: string | null;
  narration?: string | null;
  customer_name?: string | null;
  customer_msisdn?: string | null;
  /** 'manual' = recorded in the field, 'automatic' = KCB/M-Pesa IPN */
  source?: 'manual' | 'automatic' | string;
  collection_method?: 'cash' | 'mpesa' | string;
  voided_on?: string | null;
  void_reason?: string | null;
  created_on?: string;
};

/** payments_total — across payments[], excluding voided entries. */
export type PaymentsTotal = {
  count: number;
  amount: number;
  cash: number;
  mpesa: number;
};

/** Reconciliation numbers shown on the dispatch detail. Field names are mapped defensively. */
export type DispatchDetail = DispatchOrder & {
  items: DispatchItem[];
  sales?: DispatchSale[];
  /** Itemised ledger for this dispatch. Empty for a School Dispatch (no route) —
   *  those settle through invoices instead. */
  payments?: DispatchPayment[];
  payments_total?: PaymentsTotal;
  expenses?: DispatchExpense[];
  /** 'route' | 'school' */
  dispatch_type?: string;
  customer?: { id: number; name: string } | null;
  lpo_value?: number;
  expenses_value?: number;
  total_commission?: number;
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
  /** ledger entry id — what void_collection / edit_collection take */
  entry_id?: number | string;
  id?: number | string;
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

// ---- Dispatch expenses ----
/** Numbers arrive as strings from several endpoints, so money/ids stay loose. */
export type Num = number | string;

export type ExpenseStatus = 'pending' | 'approved' | 'rejected' | string;

export type ExpenseCategory = {
  id: Num;
  name: string;
  description?: string;
  status?: string;
};

export type DispatchExpense = {
  id: Num;
  dispatch_id?: Num;
  expense_category_id?: Num;
  /** server may name this category_name, category, or expense_category */
  category_name?: string;
  category?: string;
  expense_category?: string;
  amount: Num;
  description?: string;
  status: ExpenseStatus;
  reason?: string;
  rejection_reason?: string;
  created_on?: string;
  recorded_by?: string;
  approved_by?: string;
};

// ---- Collections ledger ----
/** A single posted collection. Only manual CASH entries can be voided/edited. */
export type CollectionEntry = {
  id?: Num;
  entry_id?: Num;
  amount: Num;
  method?: string; // cash | mpesa_manual | mpesa | kcb …
  source?: string; // MANUAL | KCB/MPESA …
  transaction_id?: string;
  receipt_number?: string;
  notes?: string;
  status?: string; // posted | voided …
  created_on?: string;
};

// ---- Commissions ----
export type CommissionRate = {
  product_id: Num;
  product_name?: string;
  rate?: Num;
  rate_type?: 'per_unit' | 'percentage' | string;
  amount?: Num;
  route_id?: Num;
  route_name?: string;
  /** 'agent' when the agent's own rate wins over the route default */
  scope?: string;
};

// ---- Customers / AR ----
export type Customer = {
  id: Num;
  name: string;
  customer_type?: 'school' | 'other' | string;
  contact_person?: string;
  phone?: string;
  email?: string;
  physical_address?: string;
  kra_pin?: string;
  credit_limit?: Num;
  payment_terms_days?: Num;
  /** current outstanding AR balance (name varies by endpoint version) */
  outstanding?: Num;
  outstanding_balance?: Num;
  balance?: Num;
  ar_balance?: Num;
  account_credit?: Num;
  status?: string;
};

export type InvoiceStatus = 'issued' | 'partially_paid' | 'paid' | 'cancelled' | 'overdue' | string;

export type Invoice = {
  id: Num;
  invoice_number?: string;
  customer_id?: Num;
  customer_name?: string;
  delivery_note_number?: string;
  lpo_number?: string;
  total?: Num;
  amount?: Num;
  paid?: Num;
  balance?: Num;
  balance_due?: Num;
  issued_on?: string;
  due_date?: string;
  status: InvoiceStatus;
};

export type PaymentMethod = 'cash' | 'cheque' | 'mpesa' | 'till' | 'bank_transfer';

// ---- Dashboard endpoints ----
/**
 * reports/dashboard_summary. Dispatched + M-Pesa are real-time ("today");
 * Returned / Cash / Short are only knowable at EOD so the server reports
 * yesterday's figures for those three — exactly like the admin dashboard.
 */
export type DashboardSummaryPayload = {
  date?: string;
  collected_today?: Num;
  collected?: Num;
  dispatched_today?: Num;
  dispatched?: Num;
  returned_yesterday?: Num;
  returns?: Num;
  mpesa_today?: Num;
  mpesa?: Num;
  cash_yesterday?: Num;
  cash?: Num;
  short_yesterday?: Num;
  shortage?: Num;
  short?: Num;
  vehicles_on_road?: Num;
  vehicles_short?: Num;
  dispatched_change_pct?: Num;
  mpesa_change_pct?: Num;
  [k: string]: unknown;
};

export type NeedsAttentionPayload = {
  date?: string;
  outstanding?: Num;
  vehicles?: {
    vehicle_id?: Num;
    registration_number?: string;
    vehicle?: string;
    route?: string;
    shortage?: Num;
    agent?: string;
    [k: string]: unknown;
  }[];
  agents_affected?: Num;
  open_dispatches?: Num;
  oldest_open_dispatch?: string;
  overpayment_today?: Num;
  [k: string]: unknown;
};

/** reports/summary — period totals + the day-by-day chart series. */
export type ReportsPeriodSummary = {
  period?: string;
  from?: string;
  to?: string;
  dispatched?: Num;
  collected?: Num;
  shortages?: Num;
  reports_generated?: Num;
  days?: { date?: string; day?: string; dispatched?: Num; collected?: Num; shortage?: Num }[];
  chart?: { date?: string; dispatched?: Num; collected?: Num }[];
  [k: string]: unknown;
};

/** short (shortfall) for a route report. Positive = under-collected. */
export function shortOf(r: Pick<RouteReport, 'dispatched_total' | 'collected_total'>): number {
  return r.dispatched_total - r.collected_total;
}
