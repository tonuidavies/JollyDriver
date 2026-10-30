/**
 * The "Invoice and Delivery" slip — modelled line-for-line on the shop POS
 * printout (company block, Invoice/Account/Page, Date/Time/Sales Person,
 * Bill To box, Item/Description/Qty/Price/Disc% table, Received By, totals,
 * barcode). One model feeds the on-screen paper and the printable HTML.
 */
import config from '../config';
import { code128Svg } from './barcode';

export type ReceiptLine = {
  code: string;
  description: string;
  /** second line under the description, like the POS batch/sku line */
  sub?: string;
  qty: number;
  price: number;
  discPct: number;
};

export type Receipt = {
  invoiceNumber: string;
  accountNumber?: string;
  deliveryNote?: string;
  lpoNumber?: string;
  dispatchNumber?: string;
  /** ISO timestamp */
  issuedAt: string;
  salesPerson: string;
  billTo: string[];
  lines: ReceiptLine[];
  saleType: 'cash' | 'lpo';
  taxRate?: number;
};

export const lineDiscPrice = (l: ReceiptLine) => l.price * (1 - (l.discPct || 0) / 100);
export const lineAmount = (l: ReceiptLine) => lineDiscPrice(l) * l.qty;

export function receiptTotals(r: Receipt) {
  const subTotal = r.lines.reduce((s, l) => s + lineAmount(l), 0);
  const tax = subTotal * (r.taxRate ?? 0);
  return { subTotal, tax, total: subTotal + tax };
}

/** "Ksh 4,200.00" — the POS money format. */
export const ksh = (n: number) =>
  `Ksh ${(Math.round((n || 0) * 100) / 100).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const pad = (n: number) => String(n).padStart(2, '0');
export const slipDate = (iso: string) => {
  const d = new Date(iso);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
};
export const slipTime = (iso: string) => {
  if (!iso.includes('T')) return ''; // date-only (an old sale) — leave the time blank rather than invent one
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

const pick = (o: any, ...keys: string[]) => {
  for (const k of keys) {
    const v = k.split('.').reduce((acc, p) => (acc == null ? acc : acc[p]), o);
    if (v != null && v !== '') return v;
  }
  return undefined;
};

/**
 * Build the slip right after `dispatch/record_sale`. The response carries the
 * numbers (invoice / delivery note / sale id) but not always the lines, so the
 * lines come from what the driver just picked — the same figures the server priced.
 */
export function receiptFromSale(input: {
  response: any;
  saleType: 'cash' | 'lpo';
  lines: ReceiptLine[];
  customerName?: string;
  customerPhone?: string;
  customerSub?: string;
  lpoNumber?: string;
  dispatchNumber?: string;
  salesPerson: string;
}): Receipt {
  const r = input.response?.data ?? input.response ?? {};
  const saleId = pick(r, 'sale_id', 'id', 'sale.id', 'dispatch_sale_id');
  const invoice =
    pick(r, 'invoice_number', 'invoice.invoice_number', 'receipt_number', 'sale.receipt_number') ??
    (saleId ? `S${String(saleId).padStart(5, '0')}` : `${input.dispatchNumber ?? 'SALE'}-${Date.now().toString().slice(-5)}`);
  const name = input.customerName?.trim() || 'WALK-IN CUSTOMER';
  return {
    invoiceNumber: String(invoice),
    accountNumber: input.customerPhone || undefined,
    deliveryNote: pick(r, 'delivery_note_number', 'delivery_note', 'sale.delivery_note_number'),
    lpoNumber: input.lpoNumber,
    dispatchNumber: input.dispatchNumber,
    issuedAt: String(pick(r, 'created_on', 'sale.created_on') ?? new Date().toISOString()).replace(' ', 'T'),
    salesPerson: input.salesPerson.toUpperCase(),
    billTo: [name.toUpperCase(), input.customerSub?.toUpperCase(), input.customerPhone].filter(Boolean) as string[],
    lines: input.lines,
    saleType: input.saleType,
  };
}

/**
 * A past sale from `dispatch/detail.sales[]`, for reprinting. The sale row is
 * `{ id, sale_number, customer_name, customer_phone, expected_amount, items[] }`
 * — no type, date or invoice of its own, so those come in via `ctx`.
 */
export function receiptFromDispatchSale(
  sale: any,
  ctx: { dispatchNumber?: string; salesPerson: string; date?: string; lpo?: boolean; invoice?: any; deliveryNote?: string }
): Receipt {
  const items: any[] = Array.isArray(sale?.items) ? sale.items : [];
  const lines: ReceiptLine[] = items.map((it) => {
    const qty = Number(pick(it, 'quantity', 'qty') ?? 0);
    const amount = Number(pick(it, 'subtotal', 'amount', 'total') ?? 0);
    const price = Number(pick(it, 'price', 'unit_price') ?? (qty ? amount / qty : 0));
    return {
      code: String(pick(it, 'product_code', 'sku', 'product_id') ?? ''),
      description: String(pick(it, 'product_name', 'name') ?? 'Item').toUpperCase(),
      sub: pick(it, 'sku'),
      qty,
      price,
      discPct: Number(pick(it, 'discount', 'disc_pct') ?? 0),
    };
  });
  if (lines.length === 0) {
    const total = Number(pick(sale, 'expected_amount', 'total', 'amount', 'total_amount') ?? 0);
    lines.push({ code: '', description: 'GOODS DELIVERED', qty: 1, price: total, discPct: 0 });
  }
  const phone = pick(sale, 'customer_phone', 'customer.phone');
  const saleNo = pick(sale, 'sale_number', 'id');
  // sales carry no timestamp of their own — fall back to the (date-only) dispatch date
  const when = pick(sale, 'created_on') ?? ctx.date;
  return {
    invoiceNumber: String(
      pick(ctx.invoice, 'invoice_number') ?? pick(sale, 'invoice_number', 'receipt_number') ??
        (saleNo ? `${ctx.dispatchNumber ?? 'S'}-${saleNo}` : '—')
    ),
    accountNumber: phone,
    deliveryNote: ctx.deliveryNote ?? pick(sale, 'delivery_note_number', 'delivery_note'),
    lpoNumber: pick(ctx.invoice, 'lpo_number') ?? pick(sale, 'lpo_number'),
    dispatchNumber: ctx.dispatchNumber,
    issuedAt: String(when ?? new Date().toISOString()).replace(' ', 'T'),
    salesPerson: ctx.salesPerson.toUpperCase(),
    billTo: [String(pick(sale, 'customer_name', 'customer.name') ?? 'WALK-IN CUSTOMER').toUpperCase(), phone].filter(Boolean) as string[],
    lines,
    saleType: ctx.lpo || String(sale?.sale_type ?? '').toLowerCase() === 'lpo' ? 'lpo' : 'cash',
  };
}

const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));

/** Printable HTML — sized for the same A4/letter continuous form the POS uses. */
export function receiptHtml(r: Receipt): string {
  const c = config.company;
  const t = receiptTotals(r);
  const rows = r.lines
    .map(
      (l) => `<tr>
        <td>${esc(l.code)}</td>
        <td>${esc(l.description)}${l.sub ? `<br/>${esc(l.sub)}` : ''}</td>
        <td class="r">${l.qty}</td>
        <td class="r">${ksh(l.price)}</td>
        <td>${l.discPct || 0}</td>
        <td>${ksh(lineDiscPrice(l))}</td>
        <td class="r">${ksh(lineAmount(l))}</td>
      </tr>`
    )
    .join('');
  const extra = [
    r.lpoNumber ? `<tr><td>LPO #:</td><td>${esc(r.lpoNumber)}</td></tr>` : '',
    r.deliveryNote ? `<tr><td>Delivery Note:</td><td>${esc(r.deliveryNote)}</td></tr>` : '',
  ].join('');

  return `<!doctype html><html><head><meta charset="utf-8"/>
<style>
  @page { size: A4; margin: 14mm 16mm; }
  body { font-family: Arial, Helvetica, sans-serif; color: #111; font-size: 12px; margin: 0; }
  .top { display: flex; justify-content: space-between; align-items: flex-start; }
  .co { font-size: 22px; font-weight: bold; letter-spacing: .2px; }
  .doc { font-size: 22px; font-weight: bold; }
  .muted { font-size: 12px; line-height: 1.5; }
  .meta td { padding: 0 0 1px 0; font-size: 12px; } .meta td:first-child { width: 120px; }
  .bill { border: 1.5px solid #111; border-collapse: collapse; width: 46%; margin-top: 26px; }
  .bill td { vertical-align: top; padding: 3px 6px; font-size: 12px; } .bill td:first-child { border-right: 1.5px solid #111; width: 70px; }
  .items { width: 100%; border-collapse: collapse; margin-top: 70px; border: 1.5px solid #111; }
  .items th { font-weight: normal; text-align: left; font-size: 11.5px; padding: 2px 4px; border: 1px solid #111;
    background: repeating-linear-gradient(90deg, #bbb 0 1px, transparent 1px 3px); }
  .items td { padding: 2px 4px; border-left: 1px solid #111; vertical-align: top; font-size: 12px; }
  .r, .items th.r { text-align: right; }
  .rule { height: 9px; margin-top: 260px; background: repeating-linear-gradient(90deg, #888 0 1px, transparent 1px 3px); border-top: 1px dotted #888; }
  .foot { display: flex; justify-content: space-between; margin-top: 8px; }
  .sig { margin-left: 50px; line-height: 1.7; }
  .tot td { padding: 0 0 0 26px; font-size: 12.5px; } .tot td:first-child { text-align: right; }
  .bc { margin-top: 70px; } .bc .n { margin-left: 170px; margin-top: 6px; font-size: 12px; }
</style></head><body>
  <div class="top">
    <div>
      <div class="co">${esc(c.name)}</div>
      <div class="muted">${esc(c.address)}<br/><br/>PIN: ${esc(c.pin)}<br/><br/>${esc(c.phone)}</div>
    </div>
    <div>
      <div class="doc">Invoice and Delivery</div>
      <table class="meta" style="margin-top:18px">
        <tr><td>Invoice #:</td><td>${esc(r.invoiceNumber)}</td></tr>
        <tr><td>Account #:</td><td>${esc(r.accountNumber ?? '')}</td></tr>
        <tr><td>Page:</td><td>1 of 1</td></tr>
        ${extra}
      </table>
      <table class="meta" style="margin-top:22px">
        <tr><td>Date:</td><td>${slipDate(r.issuedAt)}</td></tr>
        <tr><td>Time:</td><td>${slipTime(r.issuedAt)}</td></tr>
        <tr><td>Sales Person:</td><td>${esc(r.salesPerson)}</td></tr>
      </table>
    </div>
  </div>
  <table class="bill"><tr><td>Bill To:</td><td>${r.billTo.map(esc).join('<br/>')}</td></tr></table>
  <table class="items">
    <tr><th>Item</th><th>Description</th><th class="r">Qty</th><th class="r">Price</th><th>Disc %</th><th>Disc Price</th><th class="r">Amt</th></tr>
    ${rows}
  </table>
  <div class="rule"></div>
  <div class="foot">
    <div class="sig">Received By: ......................................<br/>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Date: ......................................</div>
    <table class="tot">
      <tr><td>Sub Total</td><td class="r">${ksh(t.subTotal)}</td></tr>
      <tr><td>Sales Tax</td><td class="r">${ksh(t.tax)}</td></tr>
      <tr><td>Total</td><td class="r">${ksh(t.total)}</td></tr>
    </table>
  </div>
  <div class="bc">${code128Svg(r.invoiceNumber, 34, 1.5)}<div class="n">${esc(r.invoiceNumber)}</div></div>
</body></html>`;
}
