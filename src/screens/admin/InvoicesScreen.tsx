import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, RefreshControl, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Card, ScreenTitleBar, StatusBadge, FormModal, Field } from '../../components';
import { Loading, ErrorState, EmptyState } from '../../components/StateView';
import { colors, type, fonts, spacing, radius } from '../../theme';
import { kes } from '../../utils/format';
import { useInvoices, useRecordInvoicePayment } from '../../api/hooks';
import { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Invoices'>;
const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);

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

export default function InvoicesScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [status, setStatus] = useState<string | undefined>(undefined);
  const { data, isLoading, isError, refetch, isRefetching } = useInvoices(status);
  const pay = useRecordInvoicePayment();
  const [payFor, setPayFor] = useState<any | null>(null);
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');

  const list: any[] = Array.isArray(data) ? data : (data as any)?.data ?? [];

  const submitPayment = () => {
    if (!payFor) return;
    const amt = num(amount);
    if (amt <= 0) return Alert.alert('Enter an amount');
    pay.mutate(
      { invoice_id: num(payFor.id ?? payFor.invoice_id), amount: amt, reference: reference || undefined },
      { onSuccess: () => { setPayFor(null); setAmount(''); setReference(''); refetch(); Alert.alert('Payment recorded'); }, onError: (e) => Alert.alert('Failed', (e as Error).message) }
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
            const bal = num(inv.balance ?? inv.balance_due ?? (num(inv.total) - num(inv.paid)));
            const st = String(inv.status || 'issued');
            return (
              <Pressable key={inv.id ?? i} onPress={() => bal > 0 && setPayFor(inv)}>
                <Card style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inv}>{inv.invoice_number || inv.number || `Invoice #${inv.id}`}</Text>
                    <Text style={styles.cust}>{inv.customer_name || inv.customer || ''}{inv.due_date ? ` · due ${inv.due_date}` : ''}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: spacing.xs }}>
                    <Text style={styles.amt}>{kes(num(inv.total ?? inv.amount), false)}</Text>
                    <StatusBadge label={st.replace('_', ' ').toUpperCase()} tone={TONE[st] ?? 'neutral'} mono={false} />
                  </View>
                </Card>
              </Pressable>
            );
          })
        )}
        <Text style={styles.note}>Tap an unpaid invoice to record a payment.</Text>
      </ScrollView>

      <FormModal visible={!!payFor} title="Record Payment" onClose={() => setPayFor(null)} onSubmit={submitPayment} submitLabel="Record Payment" busy={pay.isPending}>
        {payFor && (
          <>
            <Text style={styles.payFor}>{payFor.invoice_number || `Invoice #${payFor.id}`} · {payFor.customer_name || ''}</Text>
            <Field label="Amount (KES)" value={amount} onChangeText={setAmount} placeholder="0" keyboardType="numeric" />
            <Field label="Reference" value={reference} onChangeText={setReference} placeholder="Cheque / M-Pesa / bank ref" />
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
  inv: { ...type.titleMd, fontFamily: fonts.sansBold, color: colors.onSurface },
  cust: { ...type.bodySm, color: colors.onSurfaceVariant, marginTop: 2 },
  amt: { ...type.labelSm, fontSize: 14, fontFamily: fonts.monoSemibold, color: colors.onSurface },
  note: { ...type.bodySm, color: colors.onSurfaceVariant, fontStyle: 'italic', marginTop: spacing.sm },
  payFor: { ...type.bodyLg, color: colors.onSurfaceVariant },
});
