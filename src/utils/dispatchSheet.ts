/**
 * The Dispatch Sheet — the same page the web prints from "Print Dispatch Sheet"
 * (admin/dispatch/report/{id}): details, reconciliation summary, dispatched
 * items, matched payments and four signature lines. Plus the van's loading slip
 * in the shop-POS "Invoice and Delivery" layout, for the driver to sign.
 */
import { DispatchDetail, DispatchPayment } from '../api/types';
import { Receipt, ReceiptLine } from './receipt';

const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
const money = (n: number) =>
  `${n < 0 ? '-' : ''}KES ${Math.abs(n).toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const money2 = (n: number) =>
  `KES ${n.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad = (n: number) => String(n).padStart(2, '0');
const toDate = (s?: string | null) => (s ? new Date(String(s).replace(' ', 'T')) : null);
/** "05 Nov 2026" */
export const sheetDate = (s?: string | null) => {
  const d = toDate(s);
  return d && !isNaN(d.getTime()) ? `${pad(d.getDate())} ${MONTHS[d.getMonth()]} ${d.getFullYear()}` : '—';
};
/** "05 Nov 2026, 01:09 PM" */
export const sheetDateTime = (s?: string | null) => {
  const d = toDate(s);
  if (!d || isNaN(d.getTime()) || !String(s).match(/\d:\d/)) return s ? sheetDate(s) : '—';
  const h = d.getHours() % 12 || 12;
  return `${sheetDate(s)}, ${pad(h)}:${pad(d.getMinutes())} ${d.getHours() < 12 ? 'AM' : 'PM'}`;
};
const hhmm = (s?: string | null) => {
  const d = toDate(s);
  return d && !isNaN(d.getTime()) && String(s).match(/\d:\d/) ? `${pad(d.getHours())}:${pad(d.getMinutes())}` : '—';
};

/** The six summary boxes, worked out the way the web sheet does. */
export function sheetFigures(d: DispatchDetail) {
  const dispatched = num(d.total_amount);
  const returns = num(d.returns_value);
  const lpo = num(d.lpo_value);
  const expenses = num(d.expenses_value);
  const collected = num(d.payments_total?.amount ?? d.collected_total ?? d.collected);
  const netExpected = d.net_expected != null ? num(d.net_expected) : dispatched - returns - lpo - expenses;
  const variance = d.variance != null ? num(d.variance) : collected - netExpected;
  return { dispatched, returns, lpo, expenses, collected, netExpected, variance };
}

export const paymentSource = (p: DispatchPayment) => {
  const auto = String(p.source ?? '').toLowerCase() === 'automatic';
  const m = String(p.collection_method ?? '').toLowerCase();
  if (auto) return 'KCB/MPESA';
  return m === 'cash' ? 'CASH' : 'MPESA (MANUAL)';
};

export function dispatchSheetHtml(d: DispatchDetail, opts: { generatedBy?: string } = {}): string {
  const f = sheetFigures(d);
  const items = d.items ?? [];
  const payments = (Array.isArray(d.payments) ? d.payments : []).filter((p) => !p.voided_on);
  const paid = payments.reduce((s, p) => s + num(p.amount), 0);
  const now = new Date().toISOString();
  const isSchool = String(d.dispatch_type ?? '') === 'school';
  const routeName = isSchool ? d.customer?.name ?? d.route?.name ?? 'School delivery' : d.route?.name ?? '—';

  const cell = (label: string, value: string) =>
    `<div class="kv"><div class="k">${esc(label)}</div><div class="v">${esc(value)}</div></div>`;
  const box = (label: string, value: number, bad = false) =>
    `<div class="box${bad ? ' bad' : ''}"><div class="k">${esc(label)}</div><div class="bv">${money(value)}</div></div>`;

  const itemRows = items
    .map(
      (it, i) => `<tr><td>${i + 1}</td><td>${esc(it.product_name)}</td><td class="r">${money2(num(it.price))}</td>
        <td class="r">${num(it.quantity).toFixed(2)}</td><td class="r">${num(it.returned_quantity) ? num(it.returned_quantity).toFixed(2) : '—'}</td>
        <td class="r">${money2(num(it.subtotal))}</td></tr>`
    )
    .join('');
  const payRows = payments
    .map(
      (p) => `<tr><td>${hhmm(p.created_on)}</td><td>${paymentSource(p)}</td><td class="r">${money2(num(p.amount))}</td>
        <td>${esc(p.customer_name || p.customer_msisdn || '')}</td><td>${esc(p.transaction_id || '')}</td><td>${esc(p.mpesa_receipt_number || '')}</td></tr>`
    )
    .join('');

  return `<!doctype html><html><head><meta charset="utf-8"/>
<style>
  @page { size: A4; margin: 12mm 12mm; }
  body { font-family: Arial, Helvetica, sans-serif; color: #2b1d16; font-size: 11px; margin: 0; }
  .hd { display: flex; justify-content: space-between; border-bottom: 2px solid #2b1d16; padding-bottom: 8px; }
  .brand { font-size: 17px; font-weight: bold; } .tag { font-size: 10px; color: #6d5a4f; }
  .doc { text-align: right; } .doc b { font-size: 13px; } .doc .no { color: #8a776b; font-size: 10px; margin: 2px 0; }
  .pill { display: inline-block; background: #e3f4e6; color: #1e7a3a; font-weight: bold; font-size: 9px; padding: 2px 7px; border-radius: 9px; text-transform: uppercase; }
  .sec { font-size: 9.5px; font-weight: bold; color: #8a6a55; letter-spacing: .4px; margin: 12px 0 5px; text-transform: uppercase; }
  .grid { display: grid; grid-template-columns: repeat(4, 1fr); row-gap: 6px; column-gap: 10px; }
  .k { font-size: 8.5px; color: #8a776b; text-transform: uppercase; letter-spacing: .3px; }
  .v { font-size: 11px; font-weight: bold; margin-top: 1px; }
  .boxes { display: grid; grid-template-columns: repeat(6, 1fr); gap: 6px; }
  .box { border: 1px solid #e4d8cf; border-radius: 4px; padding: 6px 8px; }
  .box.bad { border-color: #c0392b; } .box.bad .bv { color: #c0392b; }
  .bv { font-size: 12px; font-weight: bold; margin-top: 3px; }
  table { width: 100%; border-collapse: collapse; }
  th { font-size: 8.5px; font-weight: bold; color: #8a776b; text-transform: uppercase; text-align: left; padding: 4px 6px; border-bottom: 2px solid #2b1d16; }
  td { padding: 4px 6px; border-bottom: 1px solid #eee4dc; font-size: 10.5px; }
  .r, th.r { text-align: right; }
  .tot { border-top: 2px solid #2b1d16; font-weight: bold; padding: 5px 6px; font-size: 10.5px; }
  .signs { display: grid; grid-template-columns: repeat(4, 1fr); gap: 18px; margin-top: 34px; }
  .signs div { border-top: 1px solid #2b1d16; padding-top: 4px; font-size: 10px; color: #6d5a4f; }
  .ft { display: flex; justify-content: space-between; border-top: 1px solid #eee4dc; margin-top: 12px; padding-top: 5px; font-size: 8.5px; color: #a8968a; }
  .empty { color: #8a776b; padding: 6px; font-style: italic; }
</style></head><body>
  <div class="hd">
    <div><div class="brand">Jolly Bakery</div><div class="tag">Fleet Dispatch &amp; Reconciliation</div></div>
    <div class="doc"><b>Dispatch Report</b><div class="no">${esc(d.order_number)}</div><span class="pill">${esc(d.status)}</span></div>
  </div>

  <div class="sec">Dispatch details</div>
  <div class="grid">
    ${cell('Vehicle', d.vehicle?.registration_number ?? '—')}
    ${cell('Driver', d.driver?.name || '—')}
    ${cell('Sales agent', d.agent?.name || '—')}
    ${cell(isSchool ? 'School' : 'Route', routeName)}
    ${cell('Dispatch date', sheetDate(d.dispatch_date))}
    ${cell('Dispatched time', sheetDateTime(d.dispatched_time))}
    ${cell('Completed time', d.completed_time ? sheetDateTime(d.completed_time) : '—')}
    ${cell('Report generated', sheetDateTime(now))}
  </div>

  <div class="sec">Reconciliation summary</div>
  <div class="boxes">
    ${box('Dispatched', f.dispatched)}
    ${box('Returns', f.returns)}
    ${box('LPO / Credit', f.lpo)}
    ${box('Approved expenses', f.expenses)}
    ${box('Collected (KCB + Cash)', f.collected)}
    ${box('Variance', f.variance, f.variance < 0)}
  </div>

  <div class="sec">Dispatched items</div>
  <table>
    <tr><th>#</th><th>Product</th><th class="r">Unit price</th><th class="r">Qty dispatched</th><th class="r">Qty returned</th><th class="r">Subtotal</th></tr>
    ${itemRows || '<tr><td colspan="6" class="empty">No items</td></tr>'}
  </table>
  <div class="tot">Total: ${money2(f.dispatched)}</div>

  <div class="sec">Matched payments</div>
  <table>
    <tr><th>Time</th><th>Source</th><th class="r">Amount</th><th>Customer</th><th>Transaction ID</th><th>Mpesa receipt no.</th></tr>
    ${payRows || `<tr><td colspan="6" class="empty">${isSchool ? 'Settles through the school invoice.' : 'No payments yet.'}</td></tr>`}
  </table>
  <div class="tot">Total: ${money2(paid)}</div>

  <div class="signs"><div>Dispatched by</div><div>Confirmed by</div><div>Salesperson</div><div>Driver</div></div>
  <div class="ft"><span>${opts.generatedBy ? `Generated by ${esc(opts.generatedBy)} on ${sheetDateTime(now)}` : `Generated ${sheetDateTime(now)}`}</span><span>Jolly Bakery — Dispatch #${esc(d.id)}</span></div>
</body></html>`;
}

/**
 * The load itself as a POS "Invoice and Delivery" slip: one line per product,
 * billed to the van/crew, signed by the driver under "Received By".
 */
export function loadingSlip(d: DispatchDetail): Receipt {
  const lines: ReceiptLine[] = (d.items ?? []).map((it) => ({
    code: String(it.product_id ?? ''),
    description: String(it.product_name ?? 'Item').toUpperCase(),
    qty: num(it.quantity),
    price: num(it.price),
    discPct: 0,
  }));
  const isSchool = String(d.dispatch_type ?? '') === 'school';
  return {
    invoiceNumber: d.order_number,
    accountNumber: d.vehicle?.registration_number ?? undefined,
    dispatchNumber: d.order_number,
    issuedAt: String(d.dispatched_time ?? d.created_on ?? d.dispatch_date ?? new Date().toISOString()).replace(' ', 'T'),
    salesPerson: String(d.agent?.name || d.driver?.name || '').toUpperCase(),
    billTo: [
      String(isSchool ? d.customer?.name ?? 'SCHOOL DELIVERY' : d.route?.name ?? 'ROUTE').toUpperCase(),
      d.vehicle?.registration_number ? `VEHICLE ${d.vehicle.registration_number}` : '',
      d.driver?.name ? `DRIVER ${String(d.driver.name).toUpperCase()}` : '',
    ].filter(Boolean),
    lines,
    saleType: isSchool ? 'lpo' : 'cash',
  };
}
