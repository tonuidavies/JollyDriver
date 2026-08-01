import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Alert } from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Screen, Card, StatusBadge, PrimaryButton, ScreenTitleBar } from '../../components';
import { Loading, ErrorState } from '../../components/StateView';
import { colors, type, fonts, spacing, radius } from '../../theme';
import { kes } from '../../utils/format';
import {
  useDispatchDetail, useRecordCollection, useChangeStatus, useInitiateStk, useStkStatus,
  useRecordSale, useRecordReturns, useRemainingStock,
} from '../../api/hooks';
import { DispatchStatus, DispatchItem, Reconciliation, RemainingStockItem } from '../../api/types';
import { useAuth } from '../../context/AuthContext';
import { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'DispatchDetail'>;
type Sheet = 'collection' | 'sale' | 'returns' | null;
type PayChannel = 'cash' | 'mpesa_manual' | 'stk';

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const STATUS_TONE: Record<DispatchStatus, 'success' | 'partial' | 'pending' | 'error' | 'neutral'> = {
  draft: 'neutral', pending: 'pending', active: 'partial', completed: 'success', cancelled: 'error',
};

export default function DispatchDetail({ route, navigation }: Props) {
  const { id } = route.params;
  const { activeView } = useAuth();
  const { data, isLoading, isError, error, refetch } = useDispatchDetail(id);

  const changeStatus = useChangeStatus();
  const recordCollection = useRecordCollection();
  const initiateStk = useInitiateStk();
  const recordSale = useRecordSale();
  const recordReturns = useRecordReturns();

  const [sheet, setSheet] = useState<Sheet>(null);
  const [lastRecon, setLastRecon] = useState<Reconciliation | null>(null);

  // collection form
  const [payMethod, setPayMethod] = useState<PayChannel>('cash');
  const [amount, setAmount] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [stkRef, setStkRef] = useState<{ invoice_number?: string; checkout_request_id?: string } | null>(null);
  const stk = useStkStatus(stkRef);

  // sale / returns quantities keyed by product_id
  const [saleQty, setSaleQty] = useState<Record<string, string>>({});
  const [saleCustomer, setSaleCustomer] = useState('');
  const [salePhone, setSalePhone] = useState('');
  const [returnQty, setReturnQty] = useState<Record<number, string>>({});

  const stock = useRemainingStock(id, sheet === 'sale');

  const items: DispatchItem[] = data?.items ?? [];

  const reconCells = useMemo(() => {
    if (!data) return [];
    const dispatched = num(data.total_amount);
    const r = lastRecon;
    const cells: { label: string; value: number; tone?: string }[] = [
      { label: 'Dispatched', value: dispatched },
    ];
    if (r) cells.push({ label: 'Sold', value: r.sales_total });
    cells.push({ label: 'Returns', value: r ? r.returns_value : num(data.returns_value) });
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
    return cells;
  }, [data, lastRecon]);

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
  const busy = recordCollection.isPending || initiateStk.isPending || recordSale.isPending || recordReturns.isPending || changeStatus.isPending;
  const toggle = (s: Sheet) => setSheet((prev) => (prev === s ? null : s));

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
      recordCollection.mutate(
        { dispatch_id: id, amount: amt, method: payMethod, phone_number: phone || undefined, notes: notes || undefined },
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
    }
  };

  const submitSale = () => {
    const rows = (stock.data ?? []) as RemainingStockItem[];
    const saleItems = rows
      .map((it) => ({ product_id: num(it.product_id), quantity: num(saleQty[String(it.product_id)] || 0) }))
      .filter((r) => r.quantity > 0);
    if (saleItems.length === 0) return Alert.alert('Add items', 'Enter a quantity for at least one product.');
    recordSale.mutate(
      { dispatch_id: id, sale_type: 'cash', customer_name: saleCustomer || undefined, customer_phone: salePhone || undefined, items: saleItems },
      {
        onSuccess: () => { setSaleQty({}); setSaleCustomer(''); setSalePhone(''); setSheet(null); Alert.alert('Sale recorded'); refetch(); stock.refetch(); },
        onError: (e) => Alert.alert('Failed', (e as Error).message),
      }
    );
  };

  const submitReturns = () => {
    const returns = items
      .map((it) => ({ product_id: it.product_id, quantity: num(returnQty[it.product_id] || 0) }))
      .filter((r) => r.quantity > 0);
    if (returns.length === 0) return Alert.alert('Add returns', 'Enter a returned quantity for at least one product.');
    recordReturns.mutate(
      { dispatch_id: id, returns },
      {
        onSuccess: (r: any) => { setReturnQty({}); setSheet(null); if (r?.reconciliation) setLastRecon(r.reconciliation); Alert.alert('Returns recorded'); refetch(); },
        onError: (e) => Alert.alert('Failed', (e as Error).message),
      }
    );
  };

  return (
    <Screen bottomPad={120}>
      <ScreenTitleBar
        title={data.order_number}
        onBack={() => navigation.goBack()}
        right={<StatusBadge label={data.status.toUpperCase()} tone={STATUS_TONE[data.status]} />}
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
        </Card>
      )}

      {sheet === 'sale' && (
        <Card style={styles.sheet}>
          <Text style={styles.sheetTitle}>Record Sale (cash / walk-in)</Text>
          <View style={styles.field}><Ionicons name="person-outline" size={18} color={colors.onSurfaceVariant} />
            <TextInput style={[styles.moneyInput, { fontSize: 16 }]} value={saleCustomer} onChangeText={setSaleCustomer} placeholder="Customer name (optional)" placeholderTextColor={colors.outline} />
          </View>
          <View style={[styles.field, { marginTop: spacing.sm }]}><Ionicons name="call-outline" size={18} color={colors.onSurfaceVariant} />
            <TextInput style={[styles.moneyInput, { fontSize: 16 }]} keyboardType="phone-pad" value={salePhone} onChangeText={setSalePhone} placeholder="Phone (optional)" placeholderTextColor={colors.outline} />
          </View>
          <Text style={[styles.fieldLabel, { marginTop: spacing.md }]}>Products (remaining in van)</Text>
          {stock.isLoading ? (
            <Text style={styles.hintNote}>Loading stock…</Text>
          ) : (
            ((stock.data ?? []) as RemainingStockItem[]).map((it) => (
              <QtyRow key={String(it.product_id)} name={`${it.product_name}  ·  ${Math.round(num(it.remaining_qty))} left`}
                value={saleQty[String(it.product_id)] ?? ''} onChange={(v) => setSaleQty((q) => ({ ...q, [String(it.product_id)]: v }))} />
            ))
          )}
          <PrimaryButton label="Record Sale" icon="save-outline" iconRight={false} style={{ marginTop: spacing.lg }} onPress={submitSale} disabled={busy} />
          <Text style={styles.hintNote}>School / LPO credit sales arrive with the Customers module.</Text>
        </Card>
      )}

      {sheet === 'returns' && (
        <Card style={styles.sheet}>
          <Text style={styles.sheetTitle}>Record Returns (unsold)</Text>
          {items.map((it) => (
            <QtyRow key={it.product_id}
              name={`${it.product_name}${it.returned_quantity ? `  ·  ${Math.round(num(it.returned_quantity))} returned` : ''}`}
              value={returnQty[it.product_id] ?? ''} onChange={(v) => setReturnQty((q) => ({ ...q, [it.product_id]: v }))} />
          ))}
          <PrimaryButton label="Record Returns" icon="save-outline" iconRight={false} style={{ marginTop: spacing.lg }} onPress={submitReturns} disabled={busy} />
        </Card>
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

function MethodTab({ label, icon, active, onPress }: { label: string; icon: any; active: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.methodTab, active && styles.methodTabActive]} onPress={onPress}>
      <MaterialCommunityIcons name={icon} size={18} color={active ? colors.onSecondaryFixed : colors.onSurfaceVariant} />
      <Text style={[styles.methodTabText, active && { color: colors.onSecondaryFixed }]}>{label}</Text>
    </Pressable>
  );
}

function QtyRow({ name, value, onChange }: { name: string; value: string; onChange: (v: string) => void }) {
  return (
    <View style={styles.qtyRow}>
      <Text style={styles.qtyName} numberOfLines={1}>{name}</Text>
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
  reconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, backgroundColor: colors.surfaceContainer, borderRadius: radius.card, padding: spacing.md },
  reconCell: { width: '47%', flexGrow: 1, backgroundColor: colors.surfaceContainerLowest, borderRadius: radius.md, padding: spacing.md },
  reconLabel: { ...type.labelSm, color: colors.onSurfaceVariant },
  reconValue: { ...type.metricXl, fontSize: 20, color: colors.onSurface, marginTop: spacing.xs },

  actionRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  actionBtn: { flex: 1, alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceContainerHigh },
  actionBtnActive: { backgroundColor: colors.primaryContainer },
  actionLabel: { ...type.labelSm, color: colors.onSurface, textAlign: 'center' },

  sheet: { marginTop: spacing.md },
  sheetTitle: { ...type.titleMd, fontFamily: fonts.sansBold, fontSize: 18, color: colors.onSurface, marginBottom: spacing.md },
  methodRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  methodTab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, height: 46, borderRadius: radius.md, backgroundColor: colors.surfaceContainerHigh },
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
  qtyName: { ...type.bodyLg, color: colors.onSurface, flex: 1 },
  qtyInput: { width: 80, height: 44, backgroundColor: colors.surfaceContainerLow, borderRadius: radius.md, textAlign: 'center', ...type.titleMd, color: colors.onSurface },

  itemRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  itemIcon: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.surfaceContainerHigh, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md },
  itemName: { ...type.titleMd, color: colors.onSurface },
  itemSub: { ...type.bodySm, color: colors.onSurfaceVariant, marginTop: 2 },
  itemSubtotal: { ...type.labelSm, fontSize: 14, fontFamily: fonts.monoSemibold, color: colors.onSurface },

  adminActions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
});
