/**
 * M-Pesa / KCB transactions for a single dispatch.
 *
 * There's no per-dispatch payments endpoint, so we pull `reports/mpesa_recon`
 * for the dispatch's own day and pick out the rows belonging to it. Field names
 * vary by server version, so every value is read through a candidate list.
 */

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

function pick(row: any, keys: string[]): string {
  if (!row) return '';
  for (const k of keys) {
    const v = row[k];
    if (v !== undefined && v !== null && v !== '') return String(v);
  }
  return '';
}

export type MpesaTxn = {
  receipt: string;
  phone: string;
  name: string;
  amount: number;
  time: string;
  till: string;
  matched: boolean;
};

/** How confident we are that these rows belong to this dispatch. */
export type MpesaScope = 'dispatch' | 'route' | 'none';

export type DispatchMpesa = {
  rows: MpesaTxn[];
  total: number;
  scope: MpesaScope;
};

function extractRows(res: any): any[] {
  const root = res?.data ?? res;
  if (Array.isArray(root)) return root;
  for (const k of ['transactions', 'rows', 'entries', 'payments', 'matched']) {
    if (Array.isArray(root?.[k])) return root[k];
  }
  // some versions split matched / unmatched into two arrays
  const matched = Array.isArray(root?.matched) ? root.matched : [];
  const unmatched = Array.isArray(root?.unmatched) ? root.unmatched : [];
  if (matched.length || unmatched.length) return [...matched, ...unmatched];
  const arrays = Object.values(root ?? {}).filter(Array.isArray) as any[][];
  return arrays.sort((a, b) => b.length - a.length)[0] ?? [];
}

function toTxn(row: any): MpesaTxn {
  const matchedRaw = row?.matched ?? row?.is_matched ?? row?.status ?? row?.match_status;
  const matched =
    matchedRaw === true ||
    num(row?.dispatch_id) > 0 ||
    String(matchedRaw ?? '').toLowerCase().startsWith('match');
  return {
    receipt: pick(row, ['receipt_number', 'mpesa_receipt', 'trans_id', 'transaction_id', 'reference']) || '—',
    phone: pick(row, ['phone_number', 'phone', 'msisdn', 'payer_phone']),
    name: pick(row, ['payer_name', 'customer_name', 'name', 'first_name']),
    amount: num(row?.amount ?? row?.trans_amount ?? row?.value),
    time: pick(row, ['trans_time', 'created_on', 'time', 'date', 'transaction_date']),
    till: pick(row, ['till_name', 'till', 'account_name', 'short_code', 'shortcode', 'account', 'route_name', 'route']),
    matched,
  };
}

/**
 * Rows for one dispatch, in order of confidence:
 *  1. rows carrying this dispatch's id or order number  → scope 'dispatch'
 *  2. otherwise, same-day rows on this route's till     → scope 'route'
 *  3. nothing recognisable                              → scope 'none'
 */
export function mpesaForDispatch(
  res: unknown,
  dispatch: { id: number; order_number?: string; route?: { name?: string | null } | null }
): DispatchMpesa {
  const rows = extractRows(res);
  const orderNo = String(dispatch.order_number ?? '').trim().toUpperCase();
  const routeName = String(dispatch.route?.name ?? '').trim().toUpperCase();

  const exact = rows.filter((r) => {
    if (num(r?.dispatch_id) === dispatch.id) return true;
    if (!orderNo) return false;
    const ref = [
      pick(r, ['order_number', 'dispatch_number']),
      pick(r, ['reference', 'account_reference', 'bill_ref_number', 'invoice_number', 'narration']),
    ]
      .join(' ')
      .toUpperCase();
    return ref.includes(orderNo);
  });

  const chosen =
    exact.length > 0
      ? exact
      : routeName
        ? rows.filter((r) => pick(r, ['till_name', 'till', 'account_name', 'route_name', 'route']).toUpperCase().includes(routeName))
        : [];

  const txns = chosen.map(toTxn);
  return {
    rows: txns,
    total: txns.reduce((s, t) => s + t.amount, 0),
    scope: exact.length > 0 ? 'dispatch' : txns.length > 0 ? 'route' : 'none',
  };
}
