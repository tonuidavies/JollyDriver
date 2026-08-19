import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Alert } from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Screen, Card, StatusBadge, PrimaryButton, ScreenTitleBar, Select } from '../../components';
import { Loading, ErrorState } from '../../components/StateView';
import { colors, type, fonts, spacing, radius } from '../../theme';
import { kes } from '../../utils/format';
import {
  useDispatchDetail, useRecordCollection, useChangeStatus, useInitiateStk, useStkStatus,
  useRecordSale, useRecordReturns, useRemainingStock, useExpenseCategories, useDispatchExpenses,
  useRecordExpense, useApproveExpense, useRejectExpense, useVoidCollection, useEditCollection,
  useCustomerSearch,
} from '../../api/hooks';
import {
  DispatchStatus, DispatchItem, Reconciliation, RemainingStockItem, DispatchExpense, CollectionEntry,
} from '../../api/types';
import { useAuth } from '../../context/AuthContext';
import { RootStackParamList } from '../../navigation/types';

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
const isEditableEntry = (e: CollectionEntry) => {
  const m = String(e.method ?? '').toLowerCase();
  const src = String(e.source ?? '').toLowerCase();
  const voided = String(e.status ?? '').toLowerCase().includes('void');
  return !voided && m === 'cash' && !src.includes('kcb') && !src.includes('mpesa');
};

const entryId = (e: CollectionEntry) => num(e.entry_id ?? e.id);

export default function DispatchDetail({ route, navigation }: Props) {
  const { id } = route.params;
  const { activeView } = useAuth();
  const { data, isLoading, isError, error, refetch } = useDispatchDetail(id);

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
  /** Collections posted from this screen — kept so cash entries stay correctable
   *  even when dispatch/detail doesn't return a collections array. */
  const [posted, setPosted] = useState<CollectionEntry[]>([]);
  const [editing, setEditing] = useState<CollectionEntry | null>(null);
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

  const stock = useRemainingStock(id, sheet === 'sale');
  const categories = useExpenseCategories();
  const expenses = useDispatchExpenses(id);
  // only hit customers/search once the LPO tab is actually open
  const customers = useCustomerSearch('', sheet === 'sale' && saleType === 'lpo');

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

  const collections: CollectionEntry[] = useMemo(() => {
    const raw = (data as any)?.collections ?? (data as any)?.ledger_entries;
    const fromDetail: CollectionEntry[] = Array.isArray(raw) ? raw : Array.isArray(raw?.data) ? raw.data : [];
    const seen = new Set(fromDetail.map((e) => entryId(e)).filter(Boolean));
    return [...fromDetail, ...posted.filter((p) => !seen.has(entryId(p)))];
  }, [data, posted]);

  const reconCells = useMemo(() => {
    if (!data) return [];
    const dispatched = num(data.total_amount);
    const r = lastRecon;
    const cells: { label: string; value: number; tone?: string }[] = [
      { label: 'Dispatched', value: dispatched },
    ];
    if (r) cells.push({ label: 'Sold', value: r.sales_total });
    cells.push({ label: 'Returns', value: r ? r.returns_value : num(data.returns_value) });
    if (r && r.lpo_value) cells.push({ label: 'LPO / Credit', value: r.lpo_value });
    cells.push({ label: 'Net Expected', value: r ? r.net_expected : num(data.net_expected ?? dispatched) });
    if (r) {
      cells.push({ label: 'Collected', value: r.collected, tone: colors.primary });
      cells.push({ label: 'Unaccounted', value: r.unaccounted_value });
      cells.push({ label: 'Variance', value: r.variance, tone: r.variance < 0 ? colors.error : colors.success });
      if (r.overpayment_value > 0) cells.push({ label: 'Overpaid', value: r.overpayment_value });
    } else {
      const short = num(data.shortage_amount);
      cells.push({ label: 'Shortage', value: short, tone: short > 0 ? colors.error : colors.success });
    }
    if (approvedExpenseTotal > 0) cells.push({ label: 'Expenses', value: approvedExpenseTotal });
    return cells;
  }, [data, lastRecon, approvedExpenseTotal]);

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
  }));

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
      recordCollection.mutate(
        { dispatch_id: id, amount: amt, method, phone_number: phone || undefined, notes: notes || undefined },
        {
          onSuccess: (r) => {
            const eid = num((r as any).entry_id ?? (r as any).id);
            if (eid) {
              setPosted((p) => [
                ...p,
                { entry_id: eid, amount: amt, method, source: 'MANUAL', transaction_id: r.transaction_id, notes, created_on: new Date().toISOString() },
              ]);
            }
            setAmount(''); setNotes(''); setPhone('');
            if (r.reconciliation) setLastRecon(r.reconciliation);
            Alert.alert('Collection recorded', `${r.transaction_id}\nBalance after: ${kes(r.balance_after)}`);
            refetch();
          },
          onError: (e) => Alert.alert('Failed', (e as Error).message),
        }
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
          setSaleQty({}); setSaleCustomer(''); setSalePhone(''); setLpoNumber(''); setCustomerId(null); setSheet(null);
          const dn = r?.delivery_note_number ?? r?.delivery_note;
          const inv = r?.invoice_number ?? r?.invoice?.invoice_number;
          Alert.alert(
            'Sale recorded',
            saleType === 'lpo'
              ? `Credit sale booked${dn ? `\nDelivery note: ${dn}` : ''}${inv ? `\nInvoice: ${inv}` : ''}\nSettle it later from Invoices.`
              : 'Cash sale recorded.'
          );
          refetch(); stock.refetch();
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
          Alert.alert('Expense recorded', 'Saved as pending — it only affects net expected once an admin approves it.');
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

  const onVoid = (e: CollectionEntry) =>
    Alert.alert('Void collection', `Reverse ${kes(num(e.amount))}? A reversal is posted — the original row is kept.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Void',
        style: 'destructive',
        onPress: () =>
          voidCollection.mutate(
            { entryId: entryId(e), reason: 'Voided from mobile' },
            {
              onSuccess: () => { setPosted((p) => p.filter((x) => entryId(x) !== entryId(e))); refetch(); Alert.alert('Voided'); },
              onError: (err) => Alert.alert('Failed', (err as Error).message),
            }
          ),
      },
    ]);

  const saveCorrection = () => {
    if (!editing) return;
    const amt = num(editValue);
    if (amt <= 0) return Alert.alert('Enter the corrected amount');
    const eid = entryId(editing);
    editCollection.mutate(
      { entry_id: eid, amount: amt, reason: 'Corrected from mobile' },
      {
        onSuccess: () => {
          setPosted((p) => p.map((x) => (entryId(x) === eid ? { ...x, amount: amt } : x)));
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

      <View style={styles.cardGrid}>
        <InfoCard icon="truck-outline" label="Vehicle" value={data.vehicle?.registration_number ?? '—'} />
        <InfoCard icon="account-outline" label="Driver" value={data.driver?.name || '—'} />
        <InfoCard icon="account-tie-outline" label="Agent" value={data.agent?.name || '—'} />
        <InfoCard icon="map-marker-path" label="Route" value={data.route?.name || '—'} />
      </View>

      <Text style={styles.section}>Reconciliation</Text>
      <View style={styles.reconGrid}>
        {reconCells.map((c) => (
          <View key={c.label} style={styles.reconCell}>
            <Text style={styles.reconLabel}>{c.label}</Text>
            <Text style={[styles.reconValue, c.tone ? { color: c.tone } : null]}>{kes(c.value)}</Text>
          </View>
        ))}
      </View>

      {canAct && (isDriver || isAdmin) && (
        <View style={styles.actionRow}>
          <ActionBtn icon="cart-outline" label="Record Sale" active={sheet === 'sale'} onPress={() => toggle('sale')} />
          <ActionBtn icon="cash-multiple" label="Record Collection" active={sheet === 'collection'} onPress={() => toggle('collection')} />
          <ActionBtn icon="package-variant-closed" label="Record Returns" active={sheet === 'returns'} onPress={() => toggle('returns')} />
          <ActionBtn icon="receipt" label="Record Expense" active={sheet === 'expense'} onPress={() => toggle('expense')} />
        </View>
      )}

      {sheet === 'collection' && (
        <Card style={styles.sheet}>
          <Text style={styles.sheetTitle}>Record Collection</Text>
          <View style={styles.methodRow}>
            <MethodTab label="Cash" icon="cash" active={payMethod === 'cash'} onPress={() => setPayMethod('cash')} />
            <MethodTab label="M-Pesa" icon="cellphone-check" active={payMethod === 'mpesa_manual'} onPress={() => setPayMethod('mpesa_manual')} />
            <MethodTab label="STK Prompt" icon="cellphone-message" active={payMethod === 'stk'} onPress={() => setPayMethod('stk')} />
          </View>
          <Text style={styles.fieldLabel}>Amount (KES)</Text>
          <View style={styles.field}><Text style={styles.kesPrefix}>KES</Text>
            <TextInput style={styles.moneyInput} keyboardType="numeric" value={amount} onChangeText={setAmount} placeholder="0" placeholderTextColor={colors.outline} />
          </View>
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
          <Text style={styles.sheetTitle}>Record Sale</Text>
          <View style={styles.methodRow}>
            <MethodTab label="Cash / walk-in" icon="cash" active={saleType === 'cash'} onPress={() => setSaleType('cash')} />
            <MethodTab label="LPO / credit" icon="file-document-outline" active={saleType === 'lpo'} onPress={() => setSaleType('lpo')} />
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

          <Text style={[styles.fieldLabel, { marginTop: spacing.md }]}>Products (remaining in van)</Text>
          {stock.isLoading ? (
            <Text style={styles.hintNote}>Loading stock…</Text>
          ) : (
            stockRows.map((it) => (
              <QtyRow
                key={String(it.product_id)}
                name={it.product_name}
                hint={`${Math.round(it.remaining)} left in the van`}
                value={saleQty[String(it.product_id)] ?? ''}
                onChange={(v) => setSaleQty((q) => ({ ...q, [String(it.product_id)]: v }))}
              />
            ))
          )}
          <PrimaryButton label={saleType === 'lpo' ? 'Record Credit Sale' : 'Record Sale'} icon="save-outline" iconRight={false} style={{ marginTop: spacing.lg }} onPress={submitSale} disabled={busy} />
        </Card>
      )}

      {sheet === 'returns' && (
        <Card style={styles.sheet}>
          <Text style={styles.sheetTitle}>Record Returns (unsold)</Text>
          {returnable.map((r) => (
            <QtyRow
              key={r.product_id}
              name={r.product_name}
              hint={[
                `${Math.round(r.loaded)} loaded`,
                r.lines > 1 ? `${r.lines} loads` : '',
                r.returned ? `${Math.round(r.returned)} already returned` : '',
              ]
                .filter(Boolean)
                .join('  ·  ')}
              value={returnQty[r.product_id] ?? ''}
              onChange={(v) => setReturnQty((q) => ({ ...q, [r.product_id]: v }))}
            />
          ))}
          <PrimaryButton label="Record Returns" icon="save-outline" iconRight={false} style={{ marginTop: spacing.lg }} onPress={submitReturns} disabled={busy} />
        </Card>
      )}

      {sheet === 'expense' && (
        <Card style={styles.sheet}>
          <Text style={styles.sheetTitle}>Record Expense</Text>
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
          <Text style={styles.hintNote}>Paid out of this dispatch's cash-in-hand. Saved pending — an admin has to approve it.</Text>
        </Card>
      )}

      {/* Collections posted (manual cash can be voided / corrected) */}
      {collections.length > 0 && (
        <>
          <Text style={styles.section}>Collections ({collections.length})</Text>
          {collections.map((e, i) => {
            const editable = isEditableEntry(e) && (isDriver || isAdmin) && canAct;
            return (
              <Card key={`${entryId(e)}-${i}`} style={styles.expenseRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName}>{kes(num(e.amount))}</Text>
                  <Text style={styles.itemSub}>
                    {String(e.method ?? e.source ?? 'cash').replace('_', ' ')}
                    {e.transaction_id ? ` · ${e.transaction_id}` : ''}
                  </Text>
                </View>
                {editable && (
                  <View style={styles.rowActions}>
                    <IconAction
                      icon="pencil-outline"
                      tone={colors.secondary}
                      onPress={() => { setEditing(e); setEditValue(String(num(e.amount))); }}
                    />
                    <IconAction icon="close-circle-outline" tone={colors.error} onPress={() => onVoid(e)} />
                  </View>
                )}
              </Card>
            );
          })}

          {editing && (
            <Card style={styles.sheet}>
              <Text style={styles.sheetTitle}>Correct amount</Text>
              <Text style={styles.hintNote}>
                Recorded {kes(num(editing.amount))}. The original is voided and the corrected amount re-posted.
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
        </>
      )}

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

      {isDriver && data.status === 'pending' && (
        <PrimaryButton label="Start Route" variant="dark" icon="play" iconRight={false} style={{ marginTop: spacing.lg, borderRadius: radius.full }}
          onPress={() => changeStatus.mutate({ id, status: 'active' })} disabled={busy} />
      )}
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

function InfoCard({ icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <Card style={styles.infoCard}>
      <MaterialCommunityIcons name={icon} size={22} color={colors.primary} />
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={1}>{value}</Text>
    </Card>
  );
}

function ActionBtn({ icon, label, active, onPress }: { icon: any; label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.actionBtn, active && styles.actionBtnActive]} onPress={onPress}>
      <MaterialCommunityIcons name={icon} size={22} color={active ? colors.onSecondaryFixed : colors.primary} />
      <Text style={[styles.actionLabel, active && { color: colors.onSecondaryFixed }]} numberOfLines={2}>{label}</Text>
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

function QtyRow({ name, hint, value, onChange }: { name: string; hint?: string; value: string; onChange: (v: string) => void }) {
  return (
    <View style={styles.qtyRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.qtyName} numberOfLines={1}>{name}</Text>
        {!!hint && <Text style={styles.qtyHint} numberOfLines={1}>{hint}</Text>}
      </View>
      <TextInput style={styles.qtyInput} keyboardType="numeric" value={value} onChangeText={onChange} placeholder="0" placeholderTextColor={colors.outline} />
    </View>
  );
}

const styles = StyleSheet.create({
  cardGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  infoCard: { width: '47%', flexGrow: 1, gap: 2 },
  infoLabel: { ...type.labelSm, color: colors.onSurfaceVariant, marginTop: spacing.sm },
  infoValue: { ...type.titleMd, color: colors.onSurface },

  section: { ...type.headlineLgMobile, color: colors.onSurface, marginTop: spacing.xl, marginBottom: spacing.md },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pendingPill: { ...type.labelSm, color: colors.onWarningContainer, backgroundColor: colors.warningContainer, paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.full },
  reconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, backgroundColor: colors.surfaceContainer, borderRadius: radius.card, padding: spacing.md },
  reconCell: { width: '47%', flexGrow: 1, backgroundColor: colors.surfaceContainerLowest, borderRadius: radius.md, padding: spacing.md },
  reconLabel: { ...type.labelSm, color: colors.onSurfaceVariant },
  reconValue: { ...type.metricXl, fontSize: 20, color: colors.onSurface, marginTop: spacing.xs },

  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.lg },
  actionBtn: { width: '47%', flexGrow: 1, alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceContainerHigh },
  actionBtnActive: { backgroundColor: colors.primaryContainer },
  actionLabel: { ...type.labelSm, color: colors.onSurface, textAlign: 'center' },

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

  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm },
  qtyName: { ...type.bodyLg, color: colors.onSurface },
  qtyHint: { ...type.labelSm, fontSize: 11, color: colors.onSurfaceVariant, marginTop: 2 },
  qtyInput: { width: 80, height: 44, backgroundColor: colors.surfaceContainerLow, borderRadius: radius.md, textAlign: 'center', ...type.titleMd, color: colors.onSurface },

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
