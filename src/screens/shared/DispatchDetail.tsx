import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Alert } from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Screen, Card, StatusBadge, PrimaryButton, ScreenTitleBar, Select, PaymentList } from '../../components';
import { Loading, ErrorState } from '../../components/StateView';
import { colors, type, fonts, spacing, radius } from '../../theme';
import { kes } from '../../utils/format';
import {
  useDispatchDetail, useRecordCollection, useChangeStatus, useInitiateStk, useStkStatus,
  useRecordSale, useRecordReturns, useRemainingStock, useExpenseCategories, useDispatchExpenses,
  useRecordExpense, useApproveExpense, useRejectExpense, useVoidCollection, useEditCollection,
  useCustomerSearch, useInvoices, useLpoSales,
} from '../../api/hooks';
import { asTable, rowObjects, figure } from '../../api/tables';
import {
  DispatchStatus, DispatchItem, Reconciliation, RemainingStockItem, DispatchExpense, DispatchPayment,
} from '../../api/types';
import { useAuth } from '../../context/AuthContext';
import { RootStackParamList } from '../../navigation/types';
import { receiptFromSale, receiptFromDispatchSale, ReceiptLine } from '../../utils/receipt';

type Props = NativeStackScreenProps<RootStackParamList, 'DispatchDetail'>;
type Sheet = 'collection' | 'sale' | 'returns' | 'expense' | null;
type PayChannel = 'cash' | 'mpesa_manual' | 'stk';
type SaleType = 'cash' | 'lpo';

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** Tolerate a bare array, a `{data:[…]}` envelope, or nothing at all. */
const arr = (v: unknown): any[] =>
  Array.isArray(v) ? v : Array.isArray((v as any)?.data) ? (v as any).data : [];

const STATUS_TONE: Record<DispatchStatus, 'success' | 'partial' | 'pending' | 'error' | 'neutral'> = {
  draft: 'neutral', pending: 'pending', active: 'partial', completed: 'success', cancelled: 'error',
};

const EXPENSE_TONE: Record<string, 'success' | 'pending' | 'error' | 'neutral'> = {
  approved: 'success', pending: 'pending', rejected: 'error',
};

/** Only a manually-recorded CASH collection can be voided or corrected. */
const isEditableEntry = (p: DispatchPayment) =>
  !p.voided_on &&
  String(p.source ?? '').toLowerCase() === 'manual' &&
  String(p.collection_method ?? '').toLowerCase() === 'cash';

const entryId = (p: DispatchPayment) => num(p.id);
/** Guard against posting a correction/void against entry 0. */
const hasEntryId = (p: DispatchPayment) => entryId(p) > 0;

export default function DispatchDetail({ route, navigation }: Props) {
  const { id } = route.params;
  const { activeView, user } = useAuth();
  const { data, isLoading, isError, error, refetch } = useDispatchDetail(id);
  const [showBreakdown, setShowBreakdown] = useState(false);

  const changeStatus = useChangeStatus();
  const recordCollection = useRecordCollection();
  const initiateStk = useInitiateStk();
  const recordSale = useRecordSale();
  const recordReturns = useRecordReturns();
  const recordExpense = useRecordExpense();
  const approveExpense = useApproveExpense();
  const rejectExpense = useRejectExpense();
  const voidCollection = useVoidCollection();
  const editCollection = useEditCollection();

  const [sheet, setSheet] = useState<Sheet>(null);
  const [lastRecon, setLastRecon] = useState<Reconciliation | null>(null);

  // collection form
  const [payMethod, setPayMethod] = useState<PayChannel>('cash');
  const [amount, setAmount] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [stkRef, setStkRef] = useState<{ invoice_number?: string; checkout_request_id?: string } | null>(null);
  const stk = useStkStatus(stkRef);
  const [editing, setEditing] = useState<DispatchPayment | null>(null);
  const [editValue, setEditValue] = useState('');

  // sale / returns quantities keyed by product_id
  const [saleType, setSaleType] = useState<SaleType>('cash');
  const [saleQty, setSaleQty] = useState<Record<string, string>>({});
  const [saleCustomer, setSaleCustomer] = useState('');
  const [salePhone, setSalePhone] = useState('');
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [lpoNumber, setLpoNumber] = useState('');
  const [returnQty, setReturnQty] = useState<Record<number, string>>({});

  // expense form
  const [expenseCategory, setExpenseCategory] = useState<number | null>(null);
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseDesc, setExpenseDesc] = useState('');

  // always loaded while the van is out — it drives the "in the van" gauge too
  const stock = useRemainingStock(id, sheet === 'sale' || data?.status === 'active' || data?.status === 'pending');
  const categories = useExpenseCategories();
  const expenses = useDispatchExpenses(id);
  // only hit customers/search once the LPO tab is actually open
  const customers = useCustomerSearch('', sheet === 'sale' && saleType === 'lpo');
  // LPO sales carry their invoice / delivery-note numbers on the invoice, not the sale
  const invoicesQ = useInvoices();
  // …and the delivery-note number only on the LPO sales report (Date | School / Customer | … | Delivery Note | … | Amount)
  const lpoQ = useLpoSales(
    { from: data?.dispatch_date, to: data?.dispatch_date, status: 'all' },
    !!data?.dispatch_date && arr(data?.sales).length > 0
  );

  const items: DispatchItem[] = data?.items ?? [];

  /**
   * A top-up load adds a SECOND line for a product that's already on the
   * dispatch, so `items` can hold the same product_id more than once. Returns
   * are keyed by product_id, so the sheet has to work off one merged row per
   * product — otherwise the same figure shows against every line and gets sent
   * (and counted) multiple times.
   */
  const returnable = useMemo(() => {
    const byProduct = new Map<number, { product_id: number; product_name: string; loaded: number; returned: number; lines: number }>();
    for (const it of items) {
      const pid = num(it.product_id);
      const row = byProduct.get(pid);
      if (row) {
        row.loaded += num(it.quantity);
        row.returned += num(it.returned_quantity);
        row.lines += 1;
      } else {
        byProduct.set(pid, {
          product_id: pid,
          product_name: it.product_name,
          loaded: num(it.quantity),
          returned: num(it.returned_quantity),
          lines: 1,
        });
      }
    }
    return [...byProduct.values()];
  }, [items]);

  /** remaining_stock is per product, but merge defensively for the same reason. */
  const stockRows = useMemo(() => {
    const byProduct = new Map<string, RemainingStockItem & { remaining: number }>();
    for (const it of arr(stock.data) as RemainingStockItem[]) {
      const key = String(it.product_id);
      const row = byProduct.get(key);
      if (row) row.remaining += num(it.remaining_qty);
      else byProduct.set(key, { ...it, remaining: num(it.remaining_qty) });
    }
    return [...byProduct.values()];
  }, [stock.data]);

  const expenseRows: DispatchExpense[] = useMemo(
    () => arr(expenses.data ?? (data as any)?.expenses),
    [expenses.data, data]
  );

  // The STK result only arrives via an async IPN, so refresh the dispatch the
  // moment polling flips to success — otherwise the recon block stays stale.
  useEffect(() => {
    if (stk.data?.status === 'success') refetch();
  }, [stk.data?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const pendingExpenses = expenseRows.filter((e) => String(e.status).toLowerCase() === 'pending');
  const approvedExpenseTotal = expenseRows
    .filter((e) => String(e.status).toLowerCase() === 'approved')
    .reduce((s, e) => s + num(e.amount), 0);

  /** The dispatch's own ledger: field collections + KCB/M-Pesa IPNs matched by route+date. */
  const payments: DispatchPayment[] = useMemo(() => arr(data?.payments), [data]);
  const paymentsTotal = data?.payments_total;

  const reconCells = useMemo(() => {
    if (!data) return [];
    const dispatched = num(data.total_amount);
    const r = lastRecon; // the fuller breakdown a collection/returns call returns
    const collected = r ? r.collected : num(data.payments_total?.amount);
    const netExpected = r ? r.net_expected : num(data.net_expected ?? dispatched);
    const lpo = r ? r.lpo_value : num(data.lpo_value);
    const expenses = r ? approvedExpenseTotal : num(data.expenses_value ?? approvedExpenseTotal);

    const cells: { label: string; value: number; tone?: string }[] = [
      { label: 'Dispatched', value: dispatched },
    ];
    if (r) cells.push({ label: 'Sold', value: r.sales_total });
    cells.push({ label: 'Returns', value: r ? r.returns_value : num(data.returns_value) });
    if (lpo > 0) cells.push({ label: 'LPO / Credit', value: lpo });
    if (expenses > 0) cells.push({ label: 'Expenses', value: expenses });
    cells.push({ label: 'Net Expected', value: netExpected });
    cells.push({ label: 'Collected', value: collected, tone: colors.primary });

    if (r) {
      cells.push({ label: 'Unaccounted', value: r.unaccounted_value });
      cells.push({ label: 'Variance', value: r.variance, tone: r.variance < 0 ? colors.error : colors.success });
      if (r.overpayment_value > 0) cells.push({ label: 'Overpaid', value: r.overpayment_value });
    } else {
      const short = num(data.shortage_amount);
      cells.push({ label: 'Shortage', value: short, tone: short > 0 ? colors.error : colors.success });
    }
    if (num(data.total_commission) > 0) cells.push({ label: 'Commission', value: num(data.total_commission) });
    return cells;
  }, [data, lastRecon, approvedExpenseTotal]);

  /** The two things a driver actually asks: "what's in my van?" and "how much do I still owe?" */
  const glance = useMemo(() => {
    if (!data) return null;
    const loaded = returnable.reduce((s, r) => s + r.loaded, 0);
    const returned = returnable.reduce((s, r) => s + r.returned, 0);
    const out = data.status === 'active' || data.status === 'pending';
    const inVan = out && stock.data ? stockRows.reduce((s, r) => s + Math.max(0, r.remaining), 0) : 0;
    const sold = Math.max(0, loaded - returned - inVan);

    const r = lastRecon;
    const expected = r ? r.net_expected : num(data.net_expected ?? data.total_amount);
    const collected = r ? r.collected : num(data.payments_total?.amount);
    const lpo = r ? r.lpo_value : num(data.lpo_value);
    const toCollect = Math.max(0, expected - collected);
    const overpaid = Math.max(0, collected - expected);
    const salesCount = arr(data.sales).length;
    const returnsDone = returned > 0 || !!r?.returns_recorded;

    const steps = [
      { key: 'load', label: 'Loaded', done: true },
      { key: 'road', label: 'On road', done: data.status !== 'pending' && data.status !== 'draft' },
      { key: 'sell', label: 'Selling', done: salesCount > 0 || collected > 0 || data.status === 'completed' },
      { key: 'back', label: 'Returns', done: returnsDone || data.status === 'completed' },
      { key: 'close', label: 'Closed', done: data.status === 'completed' },
    ];
    const current = steps.findIndex((s) => !s.done);
    return { loaded, returned, inVan, sold, expected, collected, lpo, toCollect, overpaid, steps, current, out };
  }, [data, returnable, stockRows, stock.data, lastRecon]);

  if (isLoading) return <Screen><Loading label="Loading dispatch…" /></Screen>;
  if (isError || !data)
    return (
      <Screen>
        <ScreenTitleBar title="Dispatch" onBack={() => navigation.goBack()} />
        <ErrorState message={(error as Error)?.message} onRetry={refetch} />
      </Screen>
    );

  const canAct = data.status === 'active' || data.status === 'pending';
  const isDriver = activeView === 'driver';
  const isAdmin = activeView === 'admin';
  const busy =
    recordCollection.isPending || initiateStk.isPending || recordSale.isPending ||
    recordReturns.isPending || changeStatus.isPending || recordExpense.isPending ||
    voidCollection.isPending || editCollection.isPending;
  const toggle = (s: Sheet) => setSheet((prev) => (prev === s ? null : s));

  const customerOpts = arr(customers.data).map((c) => ({
    label: String(c.name ?? c.customer_name ?? `Customer ${c.id}`),
    value: num(c.id),
    sub: [c.customer_type, c.phone].filter(Boolean).join(' · '),
    phone: c.phone ? String(c.phone) : undefined,
  }));

  const saleTotal = stockRows.reduce((s, it) => s + num(saleQty[String(it.product_id)] || 0) * num(it.price), 0);
  const saleUnits = stockRows.reduce((s, it) => s + num(saleQty[String(it.product_id)] || 0), 0);
  const bump = (pid: string, delta: number, max: number) =>
    setSaleQty((q) => {
      const next = Math.min(Math.max(0, num(q[pid] || 0) + delta), Math.max(0, Math.round(max)));
      return { ...q, [pid]: next ? String(next) : '' };
    });
  const sales = arr(data.sales);
  const isSchool = String(data.dispatch_type ?? '') === 'school';
  /** sales[] has no invoice link — match on customer + amount, the same pair the web shows. */
  const invoiceFor = (s: any) =>
    arr(invoicesQ.data).find(
      (inv) =>
        String(inv.customer_name ?? '').trim().toUpperCase() === String(s.customer_name ?? '').trim().toUpperCase() &&
        Math.round(num(inv.subtotal ?? inv.total ?? inv.amount)) === Math.round(num(s.expected_amount ?? s.total ?? s.amount))
    );
  const lpoRows = (() => {
    const t = asTable(lpoQ.data);
    return t ? rowObjects(t) : [];
  })();
  const deliveryNoteFor = (s: any) =>
    lpoRows.find(
      (r) =>
        String(r['School / Customer'] ?? '').trim().toUpperCase() === String(s.customer_name ?? '').trim().toUpperCase() &&
        Math.round(figure(r['Amount'])) === Math.round(num(s.expected_amount ?? s.total ?? s.amount))
    )?.['Delivery Note'] || undefined;
  const seller = [user?.first_name, user?.last_name].filter(Boolean).join(' ') || data.agent?.name || data.driver?.name || '';

  const categoryOpts = arr(categories.data).map((c) => ({
    label: String(c.name ?? c.category ?? `Category ${c.id}`),
    value: num(c.id),
  }));

  const submitCollection = () => {
    const amt = Number(amount);
    if (!amt || amt <= 0) return Alert.alert('Enter an amount');
    if (payMethod === 'stk') {
      if (!phone) return Alert.alert('Phone required', 'Enter the customer number for the STK prompt.');
      initiateStk.mutate(
        { dispatch_id: id, phone_number: phone.trim(), amount: amt, description: `Jolly ${data.order_number}` },
        {
          onSuccess: (r) => { setStkRef({ invoice_number: r.invoice_number, checkout_request_id: r.checkout_request_id }); Alert.alert('STK sent', 'Ask the customer to approve the prompt.'); },
          onError: (e) => Alert.alert('Failed', (e as Error).message),
        }
      );
    } else {
      const method = payMethod;
      // the web flags two manual entries with the same amount + method within 30 min
      // as a likely double-record — catch it before it's posted instead
      const twin = payments.find((p) => {
        if (p.voided_on || String(p.source ?? '').toLowerCase() !== 'manual') return false;
        const sameMethod = String(p.collection_method ?? '').toLowerCase() === (method === 'cash' ? 'cash' : 'mpesa');
        const at = p.created_on ? new Date(String(p.created_on).replace(' ', 'T')).getTime() : NaN;
        return sameMethod && num(p.amount) === amt && Date.now() - at < 30 * 60 * 1000;
      });
      const post = () => recordCollection.mutate(
        { dispatch_id: id, amount: amt, method, phone_number: phone || undefined, notes: notes || undefined },
        {
          onSuccess: (r) => {
            setAmount(''); setNotes(''); setPhone('');
            if (r.reconciliation) setLastRecon(r.reconciliation);
            Alert.alert('Collection recorded', `${r.transaction_id}\nBalance after: ${kes(r.balance_after)}`);
            refetch();
          },
          onError: (e) => Alert.alert('Failed', (e as Error).message),
        }
      );
      if (!twin) return post();
      Alert.alert(
        'Already recorded?',
        `${kes(amt)} ${method === 'cash' ? 'cash' : 'M-Pesa'} was recorded at ${String(twin.created_on).slice(11, 16)}. Record it again?`,
        [{ text: 'No, cancel', style: 'cancel' }, { text: 'Yes, it’s a new payment', onPress: post }]
      );
    }
  };

  const submitSale = () => {
    const saleItems = stockRows
      .map((it) => ({ product_id: num(it.product_id), quantity: num(saleQty[String(it.product_id)] || 0) }))
      .filter((r) => r.quantity > 0);
    if (saleItems.length === 0) return Alert.alert('Add items', 'Enter a quantity for at least one product.');

    const short = saleItems.find((s) => {
      const row = stockRows.find((r) => num(r.product_id) === s.product_id);
      return row ? s.quantity > row.remaining : false;
    });
    if (short) {
      const row = stockRows.find((r) => num(r.product_id) === short.product_id);
      return Alert.alert('Not enough in the van', `${row?.product_name}: only ${Math.round(row?.remaining ?? 0)} left.`);
    }
    if (saleType === 'lpo' && !customerId) return Alert.alert('Pick a customer', 'An LPO sale must be booked against a customer account.');
    if (saleType === 'lpo' && !lpoNumber.trim()) return Alert.alert('LPO number required', 'Enter the LPO / order number from the school.');

    // what the driver picked, priced like the van stock — becomes the slip's lines
    const slipLines: ReceiptLine[] = saleItems.map((s) => {
      const row = stockRows.find((r) => num(r.product_id) === s.product_id);
      return {
        code: String(s.product_id).padStart(4, '0'),
        description: String(row?.product_name ?? 'Item').toUpperCase(),
        qty: s.quantity,
        price: num(row?.price),
        discPct: 0,
      };
    });
    const school = customerOpts.find((c) => c.value === customerId);
    const lpoNo = lpoNumber.trim();
    const sellerName = [user?.first_name, user?.last_name].filter(Boolean).join(' ') || data.agent?.name || data.driver?.name || '';

    recordSale.mutate(
      {
        dispatch_id: id,
        sale_type: saleType,
        customer_name: saleType === 'cash' ? saleCustomer || undefined : undefined,
        customer_phone: saleType === 'cash' ? salePhone || undefined : undefined,
        customer_id: saleType === 'lpo' ? (customerId as number) : undefined,
        lpo_number: saleType === 'lpo' ? lpoNumber.trim() : undefined,
        items: saleItems,
      },
      {
        onSuccess: (r: any) => {
          const receipt = receiptFromSale({
            response: r,
            saleType,
            lines: slipLines,
            customerName: saleType === 'lpo' ? school?.label : saleCustomer,
            customerPhone: saleType === 'lpo' ? school?.phone : salePhone || undefined,
            lpoNumber: saleType === 'lpo' ? lpoNo : undefined,
            dispatchNumber: data.order_number,
            salesPerson: sellerName,
          });
          setSaleQty({}); setSaleCustomer(''); setSalePhone(''); setLpoNumber(''); setCustomerId(null); setSheet(null);
          refetch(); stock.refetch();
          navigation.navigate('Receipt', { receipt, fresh: true });
        },
        onError: (e) => Alert.alert('Failed', (e as Error).message),
      }
    );
  };

  const submitReturns = () => {
    // one entry per product, never per dispatch line
    const returns = returnable
      .map((r) => ({ product_id: r.product_id, quantity: num(returnQty[r.product_id] || 0) }))
      .filter((r) => r.quantity > 0);
    if (returns.length === 0) return Alert.alert('Add returns', 'Enter a returned quantity for at least one product.');

    const overs = returns.filter((r) => {
      const row = returnable.find((x) => x.product_id === r.product_id);
      return row ? r.quantity > row.loaded - row.returned : false;
    });
    if (overs.length > 0) {
      const row = returnable.find((x) => x.product_id === overs[0].product_id);
      return Alert.alert(
        'More than was loaded',
        `${row?.product_name}: ${overs[0].quantity} returned but only ${Math.round((row?.loaded ?? 0) - (row?.returned ?? 0))} are outstanding.`
      );
    }
    recordReturns.mutate(
      { dispatch_id: id, returns },
      {
        onSuccess: (r: any) => { setReturnQty({}); setSheet(null); if (r?.reconciliation) setLastRecon(r.reconciliation); Alert.alert('Returns recorded'); refetch(); },
        onError: (e) => Alert.alert('Failed', (e as Error).message),
      }
    );
  };

  const submitExpense = () => {
    const amt = num(expenseAmount);
    if (!expenseCategory) return Alert.alert('Pick a category', 'Choose what the money went on.');
    if (amt <= 0) return Alert.alert('Enter an amount');
    recordExpense.mutate(
      { dispatch_id: id, expense_category_id: expenseCategory, amount: amt, description: expenseDesc || undefined },
      {
        onSuccess: () => {
          setExpenseAmount(''); setExpenseDesc(''); setExpenseCategory(null); setSheet(null);
          Alert.alert('Expense recorded', 'Approved on the spot — it already counts against what this dispatch owes.');
          expenses.refetch();
        },
        onError: (e) => Alert.alert('Failed', (e as Error).message),
      }
    );
  };

  const onApprove = (e: DispatchExpense) =>
    Alert.alert('Approve expense', `Approve ${kes(num(e.amount))}? It will be subtracted from what's expected.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Approve',
        onPress: () =>
          approveExpense.mutate(num(e.id), {
            onSuccess: () => { expenses.refetch(); refetch(); },
            onError: (err) => Alert.alert('Failed', (err as Error).message),
          }),
      },
    ]);

  const onReject = (e: DispatchExpense) =>
    Alert.alert('Reject expense', `Reject ${kes(num(e.amount))}? It stays on record for audit but never subtracts.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reject',
        style: 'destructive',
        onPress: () =>
          rejectExpense.mutate(
            { expenseId: num(e.id), reason: 'Rejected from mobile' },
            { onSuccess: () => { expenses.refetch(); refetch(); }, onError: (err) => Alert.alert('Failed', (err as Error).message) }
          ),
      },
    ]);

  const onVoid = (e: DispatchPayment) => {
    if (!hasEntryId(e)) return Alert.alert("Can't void this entry", 'It has no ledger id to reverse.');
    return Alert.alert('Void collection', `Reverse ${kes(num(e.amount))}? A reversal is posted — the original row is kept.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Void',
        style: 'destructive',
        onPress: () =>
          voidCollection.mutate(
            { entryId: entryId(e), reason: 'Voided from mobile' },
            {
              onSuccess: () => { refetch(); Alert.alert('Voided'); },
              onError: (err) => Alert.alert('Failed', (err as Error).message),
            }
          ),
      },
    ]);
  };

  const saveCorrection = () => {
    if (!editing) return;
    const amt = num(editValue);
    if (amt <= 0) return Alert.alert('Enter the corrected amount');
    const eid = entryId(editing);
    if (eid <= 0) return Alert.alert("Can't correct this entry", 'It has no ledger id to re-post against.');
    editCollection.mutate(
      { entry_id: eid, amount: amt, reason: 'Corrected from mobile' },
      {
        onSuccess: () => {
          setEditing(null); setEditValue('');
          refetch();
          Alert.alert('Corrected', 'The original was voided and the new amount posted, both linked for audit.');
        },
        onError: (err) => Alert.alert('Failed', (err as Error).message),
      }
    );
  };

  return (
    <Screen bottomPad={120}>
      <ScreenTitleBar
        title={data.order_number}
        onBack={() => navigation.goBack()}
        right={<StatusBadge label={String(data.status ?? '').toUpperCase()} tone={STATUS_TONE[data.status]} />}
      />

      {/* who / where, in one line */}
      <View style={styles.crewStrip}>
        <CrewChip icon="truck-outline" value={data.vehicle?.registration_number ?? '—'} />
        <CrewChip icon="map-marker-path" value={data.route?.name || (data.customer?.name ?? 'School delivery')} />
        <CrewChip icon="steering" value={data.driver?.name || '—'} />
        <CrewChip icon="account-tie-outline" value={data.agent?.name || '—'} />
      </View>

      {/* the day as a journey — the next step glows */}
      {glance && (
        <View style={styles.journey}>
          {glance.steps.map((s, i) => {
            const isNow = i === glance.current;
            return (
              <React.Fragment key={s.key}>
                {i > 0 && <View style={[styles.journeyLine, s.done || isNow ? styles.journeyLineOn : null]} />}
                <View style={styles.journeyStep}>
                  <View style={[styles.journeyDot, s.done && styles.journeyDotDone, isNow && styles.journeyDotNow]}>
                    {s.done ? (
                      <Ionicons name="checkmark" size={14} color={colors.onPrimary} />
                    ) : (
                      <Text style={[styles.journeyNum, isNow && { color: colors.onSecondaryFixed }]}>{i + 1}</Text>
                    )}
                  </View>
                  <Text style={[styles.journeyLabel, (s.done || isNow) && { color: colors.onSurface, fontFamily: fonts.sansBold }]} numberOfLines={1}>{s.label}</Text>
                </View>
              </React.Fragment>
            );
          })}
        </View>
      )}

      {/* a school delivery is never cash — its money lives on the school's invoice */}
      {glance && isSchool && (
        <View style={[styles.moneyCard, styles.moneyBlue]}>
          <View style={styles.moneyTop}>
            <MaterialCommunityIcons name="school-outline" size={30} color={colors.onTertiaryContainer} />
            <Text style={styles.moneyLabel}>ON SCHOOL ACCOUNT</Text>
          </View>
          <Text style={styles.moneyBig}>{kes(glance.lpo || num(data.total_amount))}</Text>
          <Text style={styles.moneyNote}>
            Paid later against the invoice{data.customer?.name ? ` by ${data.customer.name}` : ''} — not cash on the road.
          </Text>
        </View>
      )}

      {/* MONEY — a traffic light, not a spreadsheet */}
      {glance && !isSchool && (
        <View
          style={[
            styles.moneyCard,
            glance.toCollect <= 0 ? styles.moneyGreen : data.status === 'completed' ? styles.moneyRed : styles.moneyAmber,
          ]}
        >
          <View style={styles.moneyTop}>
            <MaterialCommunityIcons
              name={glance.toCollect <= 0 ? 'check-decagram' : data.status === 'completed' ? 'alert-octagon' : 'cash-clock'}
              size={30}
              color={glance.toCollect <= 0 ? colors.onSuccessContainer : data.status === 'completed' ? colors.onErrorContainer : colors.onWarningContainer}
            />
            <Text style={styles.moneyLabel}>
              {glance.toCollect <= 0 ? (glance.overpaid > 0 ? 'ALL PAID · EXTRA RECEIVED' : 'ALL MONEY IN') : data.status === 'completed' ? 'SHORT' : 'STILL TO COLLECT'}
            </Text>
          </View>
          <Text style={styles.moneyBig}>{kes(glance.toCollect > 0 ? glance.toCollect : glance.overpaid || glance.collected)}</Text>
          <View style={styles.moneyBar}>
            <View style={[styles.moneyFill, { width: `${Math.min(100, glance.expected > 0 ? (glance.collected / glance.expected) * 100 : 100)}%` }]} />
          </View>
          <View style={styles.moneyFoot}>
            <Text style={styles.moneyFootText}>In: {kes(glance.collected)}</Text>
            <Text style={styles.moneyFootText}>Expected: {kes(glance.expected)}</Text>
          </View>
          {glance.lpo > 0 && (
            <Text style={styles.moneyNote}>+ {kes(glance.lpo)} on school/LPO accounts (paid later, not cash today)</Text>
          )}
          {glance.out && glance.returned === 0 && glance.toCollect > 0 && (
            <Text style={styles.moneyNote}>Counts everything loaded. Record what comes back and this drops.</Text>
          )}
        </View>
      )}

      {/* VAN — loaded vs sold vs back vs still inside */}
      {glance && glance.loaded > 0 && (
        <Card style={styles.vanCard}>
          <View style={styles.vanHead}>
            <MaterialCommunityIcons name="truck-cargo-container" size={22} color={colors.primary} />
            <Text style={styles.vanTitle}>{Math.round(glance.loaded)} pcs loaded</Text>
          </View>
          <View style={styles.vanBar}>
            {[
              { v: glance.sold, c: colors.success },
              { v: glance.returned, c: colors.secondary },
              { v: glance.inVan, c: colors.primaryContainer },
            ].map((seg, i) => (seg.v > 0 ? <View key={i} style={{ flex: seg.v, backgroundColor: seg.c }} /> : null))}
            {glance.sold + glance.returned + glance.inVan === 0 && <View style={{ flex: 1, backgroundColor: colors.surfaceContainerHigh }} />}
          </View>
          <View style={styles.vanLegend}>
            <Legend color={colors.success} label="On slips" value={glance.sold} />
            <Legend color={colors.secondary} label="Back" value={glance.returned} />
            <Legend color={colors.primaryContainer} label="Not counted" value={glance.inVan} />
          </View>
          {glance.inVan > 0 && glance.collected > 0 && (
            <Text style={styles.vanNote}>
              Till/M-Pesa payments aren't tied to pieces, so bread paid that way stays "not counted" until returns are recorded.
            </Text>
          )}
        </Card>
      )}

      {isDriver && data.status === 'pending' && (
        <PrimaryButton label="Van loaded — start the route" variant="dark" icon="play" iconRight={false} style={{ marginTop: spacing.lg, borderRadius: radius.full }}
          onPress={() => changeStatus.mutate({ id, status: 'active' })} disabled={busy} />
      )}

      {canAct && (isDriver || isAdmin) && (
        <>
          <Text style={styles.ask}>What are you doing now?</Text>
          <View style={styles.actionRow}>
            <ActionBtn icon="cart-arrow-right" label="SELL" hint="Make a slip" color={colors.primaryContainer} ink={colors.onSecondaryFixed} active={sheet === 'sale'} onPress={() => toggle('sale')} />
            <ActionBtn icon="hand-coin-outline" label="GET PAID" hint="Cash · M-Pesa" color={colors.success} ink="#fff" active={sheet === 'collection'} onPress={() => toggle('collection')} />
            <ActionBtn icon="keyboard-return" label="BRING BACK" hint="Unsold bread" color={colors.secondary} ink="#fff" active={sheet === 'returns'} onPress={() => toggle('returns')} />
            <ActionBtn icon="gas-station-outline" label="SPENT" hint="Fuel · parking" color={colors.inverseSurface} ink="#fff" active={sheet === 'expense'} onPress={() => toggle('expense')} />
          </View>
        </>
      )}

      {sheet === 'collection' && (
        <Card style={styles.sheet}>
          <Text style={styles.sheetTitle}>Get paid</Text>
          <View style={styles.methodRow}>
            <MethodTab label="Cash" icon="cash" active={payMethod === 'cash'} onPress={() => setPayMethod('cash')} />
            <MethodTab label="M-Pesa" icon="cellphone-check" active={payMethod === 'mpesa_manual'} onPress={() => setPayMethod('mpesa_manual')} />
            <MethodTab label="STK Prompt" icon="cellphone-message" active={payMethod === 'stk'} onPress={() => setPayMethod('stk')} />
          </View>
          <Text style={styles.fieldLabel}>Amount (KES)</Text>
          <View style={styles.field}><Text style={styles.kesPrefix}>KES</Text>
            <TextInput style={styles.moneyInput} keyboardType="numeric" value={amount} onChangeText={setAmount} placeholder="0" placeholderTextColor={colors.outline} />
          </View>
          {!!glance && glance.toCollect > 0 && (
            <Pressable style={styles.quickFill} onPress={() => setAmount(String(Math.round(glance.toCollect)))}>
              <Ionicons name="flash-outline" size={16} color={colors.primary} />
              <Text style={styles.quickFillText}>Full balance · {kes(glance.toCollect)}</Text>
            </Pressable>
          )}
          {(payMethod === 'stk' || payMethod === 'mpesa_manual') && (
            <>
              <Text style={[styles.fieldLabel, { marginTop: spacing.md }]}>Phone number{payMethod === 'stk' ? '' : ' (optional)'}</Text>
              <View style={styles.field}><Ionicons name="call-outline" size={18} color={colors.onSurfaceVariant} />
                <TextInput style={[styles.moneyInput, { fontSize: 18 }]} keyboardType="phone-pad" value={phone} onChangeText={setPhone} placeholder="0722000000" placeholderTextColor={colors.outline} />
              </View>
            </>
          )}
          {payMethod === 'cash' && (
            <>
              <Text style={[styles.fieldLabel, { marginTop: spacing.md }]}>Notes (optional)</Text>
              <TextInput style={styles.notes} multiline value={notes} onChangeText={setNotes} placeholder="e.g. balance next drop…" placeholderTextColor={colors.outline} />
            </>
          )}
          {stkRef && (
            <View style={styles.stkBox}>
              <Ionicons name={stk.data?.status === 'success' ? 'checkmark-circle' : stk.data?.status === 'failed' ? 'close-circle' : 'time-outline'} size={18}
                color={stk.data?.status === 'success' ? colors.success : stk.data?.status === 'failed' ? colors.error : colors.primary} />
              <Text style={styles.stkText}>
                {stk.data?.status === 'success' ? `Paid • ${stk.data.receipt_number}` : stk.data?.status === 'failed' ? `Failed • ${stk.data.result_description || 'declined'}` : 'Waiting for customer to approve…'}
              </Text>
            </View>
          )}
          <PrimaryButton label={payMethod === 'stk' ? 'Send STK Prompt' : 'Record Collection'} icon={payMethod === 'stk' ? 'phone-portrait-outline' : 'save-outline'} iconRight={false} style={{ marginTop: spacing.lg }} onPress={submitCollection} disabled={busy} />
          <Text style={styles.hintNote}>Manual cash entries can be voided or corrected below; M-Pesa confirmations can't.</Text>
        </Card>
      )}

      {sheet === 'sale' && (
        <Card style={styles.sheet}>
          <Text style={styles.sheetTitle}>1 · Who is buying?</Text>
          <View style={styles.methodRow}>
            <BuyerCard icon="storefront-outline" title="Shop / walk-in" sub="Pays now" active={saleType === 'cash'} onPress={() => setSaleType('cash')} />
            <BuyerCard icon="school-outline" title="School / LPO" sub="Pays later" active={saleType === 'lpo'} onPress={() => setSaleType('lpo')} />
          </View>

          {saleType === 'cash' ? (
            <>
              <View style={styles.field}><Ionicons name="person-outline" size={18} color={colors.onSurfaceVariant} />
                <TextInput style={[styles.moneyInput, { fontSize: 16 }]} value={saleCustomer} onChangeText={setSaleCustomer} placeholder="Customer name (optional)" placeholderTextColor={colors.outline} />
              </View>
              <View style={[styles.field, { marginTop: spacing.sm }]}><Ionicons name="call-outline" size={18} color={colors.onSurfaceVariant} />
                <TextInput style={[styles.moneyInput, { fontSize: 16 }]} keyboardType="phone-pad" value={salePhone} onChangeText={setSalePhone} placeholder="Phone (optional)" placeholderTextColor={colors.outline} />
              </View>
            </>
          ) : (
            <>
              <Select
                label="School / credit customer"
                placeholder={customers.isLoading ? 'Loading customers…' : 'Search a customer'}
                value={customerId}
                options={customerOpts}
                onChange={(v) => setCustomerId(num(v))}
              />
              <Text style={[styles.fieldLabel, { marginTop: spacing.md }]}>LPO number</Text>
              <View style={styles.field}><MaterialCommunityIcons name="file-document-outline" size={18} color={colors.onSurfaceVariant} />
                <TextInput style={[styles.moneyInput, { fontSize: 16 }]} value={lpoNumber} onChangeText={setLpoNumber} placeholder="e.g. LPO-2026-0142" placeholderTextColor={colors.outline} autoCapitalize="characters" />
              </View>
              <Text style={styles.hintNote}>
                A credit sale gets its own delivery note and invoice immediately — it's never expected as cash today.
              </Text>
            </>
          )}

          <Text style={[styles.sheetTitle, { marginTop: spacing.lg }]}>2 · How many?</Text>
          {stock.isLoading ? (
            <Text style={styles.hintNote}>Checking what's in the van…</Text>
          ) : stockRows.length === 0 ? (
            <Text style={styles.hintNote}>The van is empty — nothing left to sell.</Text>
          ) : (
            stockRows.map((it) => {
              const pid = String(it.product_id);
              const q = num(saleQty[pid] || 0);
              return (
                <View key={pid} style={[styles.posRow, q > 0 && styles.posRowOn]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.qtyName} numberOfLines={1}>{it.product_name}</Text>
                    <Text style={styles.qtyHint} numberOfLines={1}>{kes(num(it.price))} · {Math.round(it.remaining)} left</Text>
                  </View>
                  <Pressable style={styles.stepBtn} hitSlop={6} onPress={() => bump(pid, -1, it.remaining)}>
                    <Ionicons name="remove" size={22} color={colors.onSurface} />
                  </Pressable>
                  <TextInput
                    style={styles.stepInput}
                    keyboardType="numeric"
                    value={saleQty[pid] ?? ''}
                    onChangeText={(v) => setSaleQty((s) => ({ ...s, [pid]: v.replace(/\D/g, '') }))}
                    placeholder="0"
                    placeholderTextColor={colors.outline}
                    selectTextOnFocus
                  />
                  <Pressable style={[styles.stepBtn, styles.stepBtnPlus]} hitSlop={6} onPress={() => bump(pid, 1, it.remaining)} onLongPress={() => bump(pid, 10, it.remaining)}>
                    <Ionicons name="add" size={22} color={colors.onSecondaryFixed} />
                  </Pressable>
                </View>
              );
            })
          )}
          <Text style={styles.hintNote}>Tip: hold + to add 10 at a time.</Text>

          <View style={styles.till}>
            <View>
              <Text style={styles.tillLabel}>{saleUnits} pcs</Text>
              <Text style={styles.tillTotal}>{kes(saleTotal)}</Text>
            </View>
            <Pressable style={[styles.tillBtn, (busy || saleUnits === 0) && { opacity: 0.5 }]} onPress={submitSale} disabled={busy || saleUnits === 0}>
              <MaterialCommunityIcons name="receipt" size={20} color={colors.onSecondaryFixed} />
              <Text style={styles.tillBtnText}>{recordSale.isPending ? 'Saving…' : 'Save & make slip'}</Text>
            </Pressable>
          </View>
        </Card>
      )}

      {sheet === 'returns' && (
        <Card style={styles.sheet}>
          <Text style={styles.sheetTitle}>Bringing back (unsold)</Text>
          {stockRows.length > 0 && (
            <Pressable
              style={styles.quickFill}
              onPress={() =>
                setReturnQty(
                  Object.fromEntries(stockRows.map((s) => [num(s.product_id), s.remaining > 0 ? String(Math.round(s.remaining)) : '']))
                )
              }
            >
              <Ionicons name="flash-outline" size={16} color={colors.primary} />
              <Text style={styles.quickFillText}>Everything still in the van</Text>
            </Pressable>
          )}
          <View style={{ height: spacing.sm }} />
          {returnable.map((r) => {
            const left = r.loaded - r.returned;
            const q = num(returnQty[r.product_id] || 0);
            const set = (n: number) =>
              setReturnQty((s) => ({ ...s, [r.product_id]: n > 0 ? String(Math.min(n, Math.round(left))) : '' }));
            return (
              <View key={r.product_id} style={[styles.posRow, q > 0 && styles.posRowOn]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.qtyName} numberOfLines={1}>{r.product_name}</Text>
                  <Text style={styles.qtyHint} numberOfLines={1}>
                    {[`${Math.round(r.loaded)} loaded`, r.lines > 1 ? `${r.lines} loads` : '', r.returned ? `${Math.round(r.returned)} already back` : '']
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                </View>
                <Pressable style={styles.stepBtn} hitSlop={6} onPress={() => set(q - 1)}>
                  <Ionicons name="remove" size={22} color={colors.onSurface} />
                </Pressable>
                <TextInput
                  style={styles.stepInput}
                  keyboardType="numeric"
                  value={returnQty[r.product_id] ?? ''}
                  onChangeText={(v) => setReturnQty((s) => ({ ...s, [r.product_id]: v.replace(/\D/g, '') }))}
                  placeholder="0"
                  placeholderTextColor={colors.outline}
                  selectTextOnFocus
                />
                <Pressable style={[styles.stepBtn, styles.stepBtnPlus]} hitSlop={6} onPress={() => set(q + 1)} onLongPress={() => set(q + 10)}>
                  <Ionicons name="add" size={22} color={colors.onSecondaryFixed} />
                </Pressable>
              </View>
            );
          })}
          <PrimaryButton label="Record Returns" icon="save-outline" iconRight={false} style={{ marginTop: spacing.lg }} onPress={submitReturns} disabled={busy} />
        </Card>
      )}

      {sheet === 'expense' && (
        <Card style={styles.sheet}>
          <Text style={styles.sheetTitle}>Money spent on the road</Text>
          <Select
            label="Category"
            placeholder={categories.isLoading ? 'Loading categories…' : 'Parking, fuel, tyre repair…'}
            value={expenseCategory}
            options={categoryOpts}
            onChange={(v) => setExpenseCategory(num(v))}
          />
          <Text style={[styles.fieldLabel, { marginTop: spacing.md }]}>Amount (KES)</Text>
          <View style={styles.field}><Text style={styles.kesPrefix}>KES</Text>
            <TextInput style={styles.moneyInput} keyboardType="numeric" value={expenseAmount} onChangeText={setExpenseAmount} placeholder="0" placeholderTextColor={colors.outline} />
          </View>
          <Text style={[styles.fieldLabel, { marginTop: spacing.md }]}>Description (optional)</Text>
          <TextInput style={styles.notes} multiline value={expenseDesc} onChangeText={setExpenseDesc} placeholder="e.g. parking at Bomet stage" placeholderTextColor={colors.outline} />
          <PrimaryButton label="Record Expense" icon="save-outline" iconRight={false} style={{ marginTop: spacing.lg }} onPress={submitExpense} disabled={busy} />
          <Text style={styles.hintNote}>Paid out of this dispatch's cash-in-hand. Counts into net expected straight away.</Text>
        </Card>
      )}

      {/* every sale is a slip that can be reprinted */}
      {sales.length > 0 && (
        <>
          <Text style={styles.section}>Slips ({sales.length})</Text>
          {sales.map((s: any, i: number) => {
            const inv = invoiceFor(s);
            const lpo = isSchool || !!inv || String(s.sale_type ?? '').toLowerCase() === 'lpo';
            const paid = String(s.status ?? '').toLowerCase() === 'paid' || num(s.collected_amount) >= num(s.expected_amount);
            return (
              <Pressable
                key={`${s.id ?? i}`}
                onPress={() =>
                  navigation.navigate('Receipt', {
                    receipt: receiptFromDispatchSale(s, {
                      dispatchNumber: data.order_number,
                      salesPerson: data.agent?.name || data.driver?.name || seller,
                      date: data.dispatch_date,
                      lpo,
                      invoice: inv,
                      deliveryNote: deliveryNoteFor(s),
                    }),
                  })
                }
              >
                <Card style={styles.slipRow}>
                  <View style={[styles.slipIcon, lpo && { backgroundColor: colors.tertiaryFixed }]}>
                    <MaterialCommunityIcons name={lpo ? 'school-outline' : 'storefront-outline'} size={20} color={lpo ? colors.tertiary : colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemName} numberOfLines={1}>{s.customer_name || (lpo ? 'School' : 'Walk-in')}</Text>
                    <Text style={styles.itemSub} numberOfLines={1}>
                      {inv?.invoice_number ?? (lpo ? 'LPO' : 'Cash sale')} · {paid ? 'paid' : lpo ? 'pays later' : 'not paid yet'}
                    </Text>
                  </View>
                  <Text style={styles.itemSubtotal}>{kes(num(s.expected_amount ?? s.total ?? s.amount), false)}</Text>
                  <Ionicons name="print-outline" size={18} color={colors.outline} style={{ marginLeft: spacing.sm }} />
                </Card>
              </Pressable>
            );
          })}
        </>
      )}

      <Pressable style={styles.breakdownToggle} onPress={() => setShowBreakdown((v) => !v)}>
        <Text style={styles.breakdownText}>{showBreakdown ? 'Hide' : 'Show'} full money breakdown</Text>
        <Ionicons name={showBreakdown ? 'chevron-up' : 'chevron-down'} size={18} color={colors.primary} />
      </Pressable>
      {showBreakdown && (
        <View style={styles.reconGrid}>
          {reconCells.map((c) => (
            <View key={c.label} style={styles.reconCell}>
              <Text style={styles.reconLabel}>{c.label}</Text>
              <Text style={[styles.reconValue, c.tone ? { color: c.tone } : null]}>{kes(c.value)}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Payments ledger: field collections + KCB/M-Pesa IPNs matched by route+date */}
      <View style={{ marginTop: spacing.xl }}>
        <PaymentList
          payments={payments}
          totals={paymentsTotal}
          title="Payments"
          exportName={`${data.order_number}-payments`}
          emptyLabel={
            String(data.dispatch_type ?? '') === 'school'
              ? 'A school dispatch settles through its invoice, not this ledger.'
              : 'Nothing collected against this dispatch yet.'
          }
          canEdit={(p) => isEditableEntry(p) && hasEntryId(p) && (isDriver || isAdmin) && canAct}
          onCorrect={(p) => { setEditing(p); setEditValue(String(num(p.amount))); }}
          onVoid={onVoid}
        />

        {editing && (
          <Card style={styles.sheet}>
            <Text style={styles.sheetTitle}>Correct amount</Text>
            <Text style={styles.hintNote}>
              Recorded {kes(num(editing.amount))}. The original is voided and the corrected amount re-posted, both
              linked for audit.
            </Text>
            <View style={[styles.field, { marginTop: spacing.md }]}>
              <Text style={styles.kesPrefix}>KES</Text>
              <TextInput style={styles.moneyInput} keyboardType="numeric" value={editValue} onChangeText={setEditValue} placeholder="0" placeholderTextColor={colors.outline} />
            </View>
            <View style={styles.adminActions}>
              <PrimaryButton label="Save Correction" icon="save-outline" iconRight={false} style={{ flex: 1 }} onPress={saveCorrection} disabled={editCollection.isPending} />
              <PrimaryButton label="Cancel" variant="secondary" style={{ flex: 1 }} onPress={() => { setEditing(null); setEditValue(''); }} />
            </View>
          </Card>
        )}
      </View>

      {/* Expenses */}
      {expenseRows.length > 0 && (
        <>
          <View style={styles.sectionHead}>
            <Text style={styles.section}>Expenses ({expenseRows.length})</Text>
            {pendingExpenses.length > 0 && (
              <Text style={styles.pendingPill}>{pendingExpenses.length} pending</Text>
            )}
          </View>
          {expenseRows.map((e, i) => {
            const st = String(e.status ?? 'pending').toLowerCase();
            return (
              <Card key={`${e.id}-${i}`} style={styles.expenseRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName}>
                    {e.category_name ?? e.category ?? e.expense_category ?? 'Expense'}
                  </Text>
                  <Text style={styles.itemSub}>{e.description || e.created_on || '—'}</Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: spacing.xs }}>
                  <Text style={styles.itemSubtotal}>{kes(num(e.amount), false)}</Text>
                  <StatusBadge label={st.toUpperCase()} tone={EXPENSE_TONE[st] ?? 'neutral'} mono={false} />
                </View>
                {isAdmin && st === 'pending' && (
                  <View style={styles.rowActions}>
                    <IconAction icon="check-circle-outline" tone={colors.success} onPress={() => onApprove(e)} />
                    <IconAction icon="close-circle-outline" tone={colors.error} onPress={() => onReject(e)} />
                  </View>
                )}
              </Card>
            );
          })}
        </>
      )}

      <Text style={styles.section}>Items ({items.length})</Text>
      {items.map((it, i) => (
        <Card key={`${it.product_id}-${i}`} style={styles.itemRow}>
          <View style={styles.itemIcon}><MaterialCommunityIcons name="bread-slice-outline" size={20} color={colors.primary} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.itemName}>{it.product_name}</Text>
            <Text style={styles.itemSub}>
              {Math.round(it.quantity)} × {kes(it.price, false)}
              {it.returned_quantity ? `   ·   ${Math.round(num(it.returned_quantity))} returned` : ''}
            </Text>
          </View>
          <Text style={styles.itemSubtotal}>{kes(it.subtotal, false)}</Text>
        </Card>
      ))}

      {isAdmin && canAct && (
        <View style={styles.adminActions}>
          <PrimaryButton label="Confirm Returns" variant="dark" icon="checkmark-circle-outline" iconRight={false} style={{ flex: 1 }}
            onPress={() => Alert.alert('Confirm', 'Complete this dispatch?', [{ text: 'Cancel', style: 'cancel' }, { text: 'Confirm', onPress: () => changeStatus.mutate({ id, status: 'completed' }) }])} disabled={busy} />
          <PrimaryButton label="Report" variant="secondary" icon="document-text-outline" iconRight={false} style={{ flex: 1 }}
            onPress={() => navigation.navigate('DispatchReport', { id, orderNumber: data.order_number })} />
        </View>
      )}
      {data.status === 'completed' && (
        <PrimaryButton label="View Report" icon="document-text-outline" iconRight={false} style={{ marginTop: spacing.lg }}
          onPress={() => navigation.navigate('DispatchReport', { id, orderNumber: data.order_number })} />
      )}
    </Screen>
  );
}

function CrewChip({ icon, value }: { icon: any; value: string }) {
  return (
    <View style={styles.crewChip}>
      <MaterialCommunityIcons name={icon} size={15} color={colors.primary} />
      <Text style={styles.crewText} numberOfLines={1}>{value}</Text>
    </View>
  );
}

function Legend({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <View style={styles.legend}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendValue}>{Math.round(value)}</Text>
      <Text style={styles.legendLabel}>{label}</Text>
    </View>
  );
}

function BuyerCard({ icon, title, sub, active, onPress }: { icon: any; title: string; sub: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.buyer, active && styles.buyerOn]} onPress={onPress}>
      <MaterialCommunityIcons name={icon} size={30} color={active ? colors.onSecondaryFixed : colors.onSurfaceVariant} />
      <Text style={[styles.buyerTitle, active && { color: colors.onSecondaryFixed }]}>{title}</Text>
      <Text style={styles.buyerSub}>{sub}</Text>
      {active && <Ionicons name="checkmark-circle" size={20} color={colors.onSecondaryFixed} style={styles.buyerTick} />}
    </Pressable>
  );
}

function ActionBtn({ icon, label, hint, color, ink, active, onPress }: { icon: any; label: string; hint: string; color: string; ink: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.actionBtn, { backgroundColor: color }, active && styles.actionBtnActive, pressed && { transform: [{ scale: 0.97 }] }]}
      onPress={onPress}
    >
      <MaterialCommunityIcons name={icon} size={34} color={ink} />
      <Text style={[styles.actionLabel, { color: ink }]} numberOfLines={1}>{label}</Text>
      <Text style={[styles.actionHint, { color: ink }]} numberOfLines={1}>{hint}</Text>
    </Pressable>
  );
}

function IconAction({ icon, tone, onPress }: { icon: any; tone: string; onPress: () => void }) {
  return (
    <Pressable hitSlop={8} onPress={onPress} style={styles.iconAction}>
      <MaterialCommunityIcons name={icon} size={22} color={tone} />
    </Pressable>
  );
}

function MethodTab({ label, icon, active, onPress }: { label: string; icon: any; active: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.methodTab, active && styles.methodTabActive]} onPress={onPress}>
      <MaterialCommunityIcons name={icon} size={18} color={active ? colors.onSecondaryFixed : colors.onSurfaceVariant} />
      <Text style={[styles.methodTabText, active && { color: colors.onSecondaryFixed }]} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  crewStrip: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: -spacing.sm },
  crewChip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.surfaceContainerHigh, borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 6, maxWidth: '48%' },
  crewText: { ...type.bodySm, fontSize: 13, fontFamily: fonts.sansSemibold, color: colors.onSurface, flexShrink: 1 },

  journey: { flexDirection: 'row', alignItems: 'flex-start', marginTop: spacing.lg, marginBottom: spacing.md },
  journeyStep: { alignItems: 'center', width: 56 },
  journeyLine: { flex: 1, height: 3, backgroundColor: colors.surfaceContainerHighest, marginTop: 13, borderRadius: 2 },
  journeyLineOn: { backgroundColor: colors.primary },
  journeyDot: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.surfaceContainerHighest, alignItems: 'center', justifyContent: 'center' },
  journeyDotDone: { backgroundColor: colors.primary },
  journeyDotNow: { backgroundColor: colors.primaryContainer, borderWidth: 3, borderColor: colors.primaryFixed, transform: [{ scale: 1.15 }] },
  journeyNum: { ...type.labelSm, fontFamily: fonts.monoSemibold, color: colors.onSurfaceVariant },
  journeyLabel: { ...type.labelSm, fontSize: 11, color: colors.onSurfaceVariant, marginTop: 6 },

  moneyCard: { borderRadius: radius.card, padding: spacing.lg, marginTop: spacing.sm },
  moneyAmber: { backgroundColor: colors.warningContainer },
  moneyGreen: { backgroundColor: colors.successContainer },
  moneyRed: { backgroundColor: colors.errorContainer },
  moneyBlue: { backgroundColor: colors.tertiaryFixed },
  moneyTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  moneyLabel: { ...type.labelSm, fontSize: 13, letterSpacing: 1, fontFamily: fonts.sansExtrabold, color: colors.onSurface },
  moneyBig: { ...type.metricXl, fontSize: 38, lineHeight: 46, color: colors.onSurface, marginTop: spacing.sm },
  moneyBar: { height: 10, borderRadius: 5, backgroundColor: 'rgba(33,26,20,0.10)', overflow: 'hidden', marginTop: spacing.md },
  moneyFill: { height: '100%', backgroundColor: colors.onSurface, borderRadius: 5 },
  moneyFoot: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm },
  moneyFootText: { ...type.bodySm, fontFamily: fonts.monoMedium, color: colors.onSurfaceVariant },
  moneyNote: { ...type.bodySm, color: colors.onSurfaceVariant, marginTop: spacing.sm },

  vanCard: { marginTop: spacing.md },
  vanHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  vanTitle: { ...type.titleMd, fontFamily: fonts.sansBold, color: colors.onSurface },
  vanBar: { flexDirection: 'row', height: 22, borderRadius: 11, overflow: 'hidden', marginTop: spacing.md, gap: 2, backgroundColor: colors.surfaceContainerHigh },
  vanLegend: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.md },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 12, height: 12, borderRadius: 6 },
  legendValue: { ...type.titleMd, fontFamily: fonts.monoSemibold, color: colors.onSurface },
  legendLabel: { ...type.bodySm, color: colors.onSurfaceVariant },
  vanNote: { ...type.bodySm, fontSize: 12, color: colors.onSurfaceVariant, marginTop: spacing.sm },

  ask: { ...type.titleMd, fontFamily: fonts.sansBold, color: colors.onSurface, marginTop: spacing.xl },
  buyer: { flex: 1, alignItems: 'center', paddingVertical: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surfaceContainerHigh, borderWidth: 2, borderColor: 'transparent' },
  buyerOn: { backgroundColor: colors.primaryFixed, borderColor: colors.primaryContainer },
  buyerTitle: { ...type.titleMd, fontSize: 15, fontFamily: fonts.sansBold, color: colors.onSurface, marginTop: 4 },
  buyerSub: { ...type.bodySm, fontSize: 12, color: colors.onSurfaceVariant },
  buyerTick: { position: 'absolute', top: 8, right: 8 },

  posRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, borderRadius: radius.md, marginBottom: spacing.sm, backgroundColor: colors.surfaceContainerLow },
  posRowOn: { backgroundColor: colors.primaryFixed },
  stepBtn: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceContainerHighest },
  stepBtnPlus: { backgroundColor: colors.primaryContainer },
  stepInput: { width: 52, height: 42, textAlign: 'center', ...type.titleMd, fontFamily: fonts.monoSemibold, color: colors.onSurface, backgroundColor: colors.surfaceContainerLowest, borderRadius: radius.md },

  till: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.inverseSurface, borderRadius: radius.lg, padding: spacing.md, marginTop: spacing.md },
  tillLabel: { ...type.labelSm, color: colors.inverseOnSurface },
  tillTotal: { ...type.metricXl, fontSize: 24, color: colors.inversePrimary },
  tillBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.primaryContainer, borderRadius: radius.full, paddingHorizontal: spacing.md, height: 48 },
  tillBtnText: { ...type.titleMd, fontSize: 15, fontFamily: fonts.sansBold, color: colors.onSecondaryFixed },

  quickFill: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: colors.primaryFixed, borderRadius: radius.full, paddingHorizontal: 12, paddingVertical: 6, marginTop: spacing.sm },
  quickFillText: { ...type.bodySm, fontFamily: fonts.sansSemibold, color: colors.onPrimaryFixedVariant },

  slipRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  slipIcon: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.primaryFixed, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md },
  breakdownToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: spacing.md, marginTop: spacing.md },
  breakdownText: { ...type.bodySm, fontFamily: fonts.sansSemibold, color: colors.primary },

  section: { ...type.headlineLgMobile, color: colors.onSurface, marginTop: spacing.xl, marginBottom: spacing.md },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pendingPill: { ...type.labelSm, color: colors.onWarningContainer, backgroundColor: colors.warningContainer, paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.full },
  reconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, backgroundColor: colors.surfaceContainer, borderRadius: radius.card, padding: spacing.md },
  reconCell: { width: '47%', flexGrow: 1, backgroundColor: colors.surfaceContainerLowest, borderRadius: radius.md, padding: spacing.md },
  reconLabel: { ...type.labelSm, color: colors.onSurfaceVariant },
  reconValue: { ...type.metricXl, fontSize: 20, color: colors.onSurface, marginTop: spacing.xs },

  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.lg },
  actionBtn: { width: '47%', flexGrow: 1, alignItems: 'flex-start', paddingVertical: spacing.md, paddingHorizontal: spacing.md, borderRadius: radius.lg, minHeight: 112, justifyContent: 'flex-end' },
  actionBtnActive: { borderWidth: 3, borderColor: colors.onSurface },
  actionLabel: { ...type.titleMd, fontFamily: fonts.sansExtrabold, letterSpacing: 0.5, marginTop: spacing.sm },
  actionHint: { ...type.bodySm, fontSize: 12, opacity: 0.85 },

  sheet: { marginTop: spacing.md },
  sheetTitle: { ...type.titleMd, fontFamily: fonts.sansBold, fontSize: 18, color: colors.onSurface, marginBottom: spacing.md },
  methodRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  methodTab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, height: 46, borderRadius: radius.md, backgroundColor: colors.surfaceContainerHigh, paddingHorizontal: spacing.xs },
  methodTabActive: { backgroundColor: colors.primaryContainer },
  methodTabText: { ...type.bodySm, fontFamily: fonts.sansSemibold, color: colors.onSurfaceVariant },

  fieldLabel: { ...type.labelSm, color: colors.onSurfaceVariant, marginBottom: spacing.sm },
  field: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surfaceContainerLow, borderRadius: radius.md, paddingHorizontal: spacing.md, height: 56 },
  kesPrefix: { ...type.labelSm, fontSize: 14, color: colors.onSurfaceVariant },
  moneyInput: { flex: 1, ...type.metricXl, fontSize: 22, color: colors.onSurface, height: '100%' },
  notes: { minHeight: 80, backgroundColor: colors.surfaceContainerLow, borderRadius: radius.md, padding: spacing.md, ...type.bodyLg, color: colors.onSurface, textAlignVertical: 'top' },

  stkBox: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surfaceContainerHigh, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.md },
  stkText: { ...type.bodyLg, color: colors.onSurface, flex: 1 },
  hintNote: { ...type.bodySm, color: colors.onSurfaceVariant, marginTop: spacing.sm, fontStyle: 'italic' },

  qtyName: { ...type.bodyLg, color: colors.onSurface },
  qtyHint: { ...type.labelSm, fontSize: 11, color: colors.onSurfaceVariant, marginTop: 2 },

  itemRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  expenseRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  rowActions: { flexDirection: 'row', gap: spacing.xs, marginLeft: spacing.sm },
  iconAction: { padding: spacing.xs },
  itemIcon: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.surfaceContainerHigh, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md },
  itemName: { ...type.titleMd, color: colors.onSurface },
  itemSub: { ...type.bodySm, color: colors.onSurfaceVariant, marginTop: 2 },
  itemSubtotal: { ...type.labelSm, fontSize: 14, fontFamily: fonts.monoSemibold, color: colors.onSurface },

  adminActions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
});
