import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, RefreshControl, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Card, ScreenTitleBar, StatusBadge, FormModal, Field, Select } from '../../components';
import { Loading, ErrorState, EmptyState } from '../../components/StateView';
import { colors, type, fonts, spacing, radius } from '../../theme';
import { kes } from '../../utils/format';
import { ymd } from '../../api/dates';
import { useInvoices, useRecordAccountPayment } from '../../api/hooks';
import { PaymentMethod } from '../../api/types';
import { RootStackParamList } from '../../navigation/types';
import { Receipt } from '../../utils/receipt';
import { sheetDate } from '../../utils/dispatchSheet';

/** invoices/list has no line items — the slip carries the invoice total as one delivered line. */
const invoiceSlip = (inv: any): Receipt => ({
  invoiceNumber: String(inv.invoice_number || `INV-${inv.id}`),
  accountNumber: inv.customer_phone || undefined,
  deliveryNote: inv.delivery_note_number || undefined,
  lpoNumber: inv.lpo_number || undefined,
  issuedAt: String(inv.issued_on || inv.created_on || new Date().toISOString()).replace(' ', 'T'),
  salesPerson: '',
  billTo: [String(inv.customer_name || 'CUSTOMER').toUpperCase(), inv.due_date ? `DUE ${sheetDate(inv.due_date).toUpperCase()}` : ''].filter(Boolean),
  lines: [{ code: '', description: `GOODS DELIVERED${inv.lpo_number ? ` · LPO ${inv.lpo_number}` : ''}`, qty: 1, price: invoiceTotal(inv), discPct: 0 }],
  saleType: 'lpo',
});

type Props = NativeStackScreenProps<RootStackParamList, 'Invoices'>;
const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const invoiceTotal = (inv: any) => num(inv.subtotal ?? inv.total ?? inv.amount);
const invoiceBalance = (inv: any) => num(inv.balance ?? invoiceTotal(inv) - num(inv.paid_amount));

const FILTERS = [
  { label: 'All', value: undefined },
  { label: 'Issued', value: 'issued' },
  { label: 'Partial', value: 'partially_paid' },
  { label: 'Paid', value: 'paid' },
  { label: 'Overdue', value: 'overdue' },
];
const TONE: Record<string, 'success' | 'partial' | 'pending' | 'error' | 'neutral'> = {
  paid: 'success', partially_paid: 'partial', issued: 'pending', overdue: 'error', cancelled: 'neutral',
};

const METHODS: { label: string; value: PaymentMethod }[] = [
  { label: 'Cash', value: 'cash' },
  { label: 'M-Pesa', value: 'mpesa' },
  { label: 'Till', value: 'till' },
  { label: 'Cheque', value: 'cheque' },
  { label: 'Bank transfer', value: 'bank_transfer' },
];

const REFERENCE_HINT: Record<PaymentMethod, string> = {
  cash: 'Receipt no. (optional)',
  mpesa: 'M-Pesa code',
  till: 'Till code',
  cheque: 'Cheque number',
  bank_transfer: 'Bank reference',
};

export default function InvoicesScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [status, setStatus] = useState<string | undefined>(undefined);
  const { data, isLoading, isError, refetch, isRefetching } = useInvoices(status);
  const pay = useRecordAccountPayment();
  const [payFor, setPayFor] = useState<any | null>(null);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [paidOn, setPaidOn] = useState(ymd());
  const [reference, setReference] = useState('');

  const list: any[] = Array.isArray(data) ? data : (data as any)?.data ?? [];

  const submitPayment = () => {
    if (!payFor) return;
    const amt = num(amount);
    if (amt <= 0) return Alert.alert('Enter an amount');
    const customerId = num(payFor.customer_id ?? payFor.customer?.id);
    if (!customerId) {
      return Alert.alert('No customer on this invoice', 'Payments post against the customer account, so this one has to be settled on the web.');
    }
    pay.mutate(
      { customer_id: customerId, amount: amt, payment_method: method, paid_on: paidOn || undefined, reference: reference || undefined },
      {
        onSuccess: () => {
          setPayFor(null); setAmount(''); setReference(''); setMethod('cash');
          refetch();
          Alert.alert('Payment recorded', 'Posted to the customer account and allocated to their oldest outstanding invoices first.');
        },
        onError: (e) => Alert.alert('Failed', (e as Error).message),
      }
    );
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.marginMobile, paddingBottom: spacing.xl }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        <ScreenTitleBar title="Invoices" onBack={() => navigation.goBack()} showSync={false} />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {FILTERS.map((f) => {
            const active = status === f.value;
            return (
              <Pressable key={f.label} style={[styles.chip, active && styles.chipActive]} onPress={() => setStatus(f.value)}>
                <Text style={[styles.chipText, active && { color: colors.onSecondaryFixed }]}>{f.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {isLoading ? <Loading /> : isError ? <ErrorState onRetry={refetch} /> : list.length === 0 ? (
          <EmptyState icon="receipt-outline" message="No invoices." />
        ) : (
          list.map((inv: any, i: number) => {
            const bal = invoiceBalance(inv);
            const raw = String(inv.status || 'issued');
            // the list flags overdue separately from status, like the web's red row
            const st = inv.is_overdue && raw !== 'paid' ? 'overdue' : raw;
            return (
              <Pressable key={inv.id ?? i} onPress={() => bal > 0 && setPayFor(inv)}>
                <Card style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.top}>
                      <Text style={styles.inv} numberOfLines={1}>{inv.invoice_number || inv.number || `Invoice #${inv.id}`}</Text>
                      <StatusBadge label={st.replace('_', ' ').toUpperCase()} tone={TONE[st] ?? 'neutral'} mono={false} />
                    </View>
                    <Text style={styles.cust} numberOfLines={1}>{inv.customer_name || inv.customer || ''}</Text>
                    <Text style={styles.meta}>
                      {kes(invoiceTotal(inv))}{inv.due_date ? `  ·  due ${sheetDate(inv.due_date)}` : ''}
                    </Text>
                    {bal > 0 && <Text style={styles.bal}>Owes {kes(bal)} · tap to pay</Text>}
                  </View>
                  <Pressable hitSlop={8} style={styles.printBtn} onPress={() => navigation.navigate('Receipt', { receipt: invoiceSlip(inv) })}>
                    <Ionicons name="print-outline" size={20} color={colors.primary} />
                  </Pressable>
                </Card>
              </Pressable>
            );
          })
        )}
        <Text style={styles.note}>
          Tap an unpaid invoice to record a payment. Payments post against the customer's account as a whole and are
          allocated to their oldest outstanding invoices first — any surplus stays as visible account credit.
        </Text>
      </ScrollView>

      <FormModal visible={!!payFor} title="Record Payment on Account" onClose={() => setPayFor(null)} onSubmit={submitPayment} submitLabel="Record Payment" busy={pay.isPending}>
        {payFor && (
          <>
            <Text style={styles.payFor}>{payFor.invoice_number || `Invoice #${payFor.id}`} · {payFor.customer_name || ''}</Text>
            <Field label="Amount (KES)" value={amount} onChangeText={setAmount} placeholder="0" keyboardType="numeric" />
            <Select label="Method" value={method} options={METHODS} onChange={(v) => setMethod(v as PaymentMethod)} searchable={false} />
            <Field label="Paid on" value={paidOn} onChangeText={setPaidOn} placeholder="YYYY-MM-DD" />
            <Field label="Reference" value={reference} onChangeText={setReference} placeholder={REFERENCE_HINT[method]} />
          </>
        )}
      </FormModal>
    </View>
  );
}

const styles = StyleSheet.create({
  filters: { gap: spacing.sm, paddingBottom: spacing.md },
  chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.full, backgroundColor: colors.surfaceContainerHigh },
  chipActive: { backgroundColor: colors.primaryContainer },
  chipText: { ...type.bodySm, fontFamily: type.titleMd.fontFamily, color: colors.onSurfaceVariant },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  inv: { ...type.titleMd, fontFamily: fonts.sansBold, color: colors.onSurface, flexShrink: 1 },
  meta: { ...type.labelSm, fontSize: 13, fontFamily: fonts.monoSemibold, color: colors.onSurface, marginTop: 2 },
  cust: { ...type.bodySm, color: colors.onSurfaceVariant, marginTop: 2 },
  bal: { ...type.labelSm, color: colors.error, marginTop: 2 },
  printBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceContainerHigh, alignItems: 'center', justifyContent: 'center', marginLeft: spacing.sm },
  note: { ...type.bodySm, color: colors.onSurfaceVariant, fontStyle: 'italic', marginTop: spacing.sm },
  payFor: { ...type.bodyLg, color: colors.onSurfaceVariant },
});
