import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Card, ScreenTitleBar, PrimaryButton, StatusBadge, FormModal, Field, Select } from '../../components';
import { Loading, ErrorState, EmptyState } from '../../components/StateView';
import { colors, type, fonts, spacing, radius } from '../../theme';
import { kes } from '../../utils/format';
import { ymd } from '../../api/dates';
import { useCustomer, useInvoices, useRecordAccountPayment } from '../../api/hooks';
import { PaymentMethod } from '../../api/types';
import { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'CustomerDetail'>;
const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);

const METHODS: { label: string; value: PaymentMethod }[] = [
  { label: 'Cash', value: 'cash' },
  { label: 'M-Pesa', value: 'mpesa' },
  { label: 'Till', value: 'till' },
  { label: 'Cheque', value: 'cheque' },
  { label: 'Bank transfer', value: 'bank_transfer' },
];

const TONE: Record<string, 'success' | 'partial' | 'pending' | 'error' | 'neutral'> = {
  paid: 'success', partially_paid: 'partial', issued: 'pending', overdue: 'error', cancelled: 'neutral',
};

/**
 * A customer's account: outstanding AR, their invoices (created automatically by
 * every LPO sale), and a payment posted against the account as a whole.
 */
export default function CustomerDetail({ route, navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { id, name } = route.params;
  const cust = useCustomer(id);
  const invoices = useInvoices();
  const pay = useRecordAccountPayment();

  const [payOpen, setPayOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [paidOn, setPaidOn] = useState(ymd());
  const [reference, setReference] = useState('');

  const c: any = (cust.data as any)?.data ?? cust.data ?? {};
  const balance = num(c.outstanding ?? c.outstanding_balance ?? c.balance ?? c.ar_balance);
  const credit = num(c.account_credit ?? c.credit_balance);

  const theirInvoices = useMemo(() => {
    const all: any[] = Array.isArray(invoices.data) ? invoices.data : (invoices.data as any)?.data ?? [];
    return all.filter((inv) => num(inv.customer_id ?? inv.customer?.id) === num(id));
  }, [invoices.data, id]);

  const submitPayment = () => {
    const amt = num(amount);
    if (amt <= 0) return Alert.alert('Enter an amount');
    pay.mutate(
      { customer_id: num(id), amount: amt, payment_method: method, paid_on: paidOn || undefined, reference: reference || undefined },
      {
        onSuccess: () => {
          setPayOpen(false); setAmount(''); setReference(''); setMethod('cash');
          cust.refetch(); invoices.refetch();
          Alert.alert('Payment recorded', 'Allocated to the oldest outstanding invoices first.');
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
        showsVerticalScrollIndicator={false}
      >
        <ScreenTitleBar title={name ?? c.name ?? 'Customer'} onBack={() => navigation.goBack()} showSync={false} />

        {cust.isLoading ? <Loading /> : cust.isError ? <ErrorState onRetry={cust.refetch} /> : (
          <>
            <Card style={styles.hero}>
              <Text style={styles.heroLabel}>OUTSTANDING BALANCE</Text>
              <Text style={styles.heroValue}>{kes(balance)}</Text>
              {credit > 0 && <Text style={styles.heroCredit}>{kes(credit)} account credit on file</Text>}
              <View style={styles.metaWrap}>
                {c.phone ? <Meta icon="phone-outline" text={String(c.phone)} /> : null}
                {c.contact_person ? <Meta icon="account-outline" text={String(c.contact_person)} /> : null}
                {c.customer_type ? <Meta icon="tag-outline" text={String(c.customer_type)} /> : null}
                {c.payment_terms_days ? <Meta icon="calendar-clock" text={`${c.payment_terms_days}d terms`} /> : null}
                {c.credit_limit ? <Meta icon="credit-card-outline" text={`${kes(num(c.credit_limit))} limit`} /> : null}
              </View>
            </Card>

            <PrimaryButton
              label="Record Payment on Account"
              icon="cash-outline"
              iconRight={false}
              style={{ marginTop: spacing.lg }}
              onPress={() => setPayOpen(true)}
            />

            <Text style={styles.section}>Invoices ({theirInvoices.length})</Text>
            {invoices.isLoading ? (
              <Loading />
            ) : theirInvoices.length === 0 ? (
              <EmptyState icon="receipt-outline" message="No invoices for this customer yet." />
            ) : (
              theirInvoices.map((inv, i) => {
                const st = String(inv.status || 'issued');
                const bal = num(inv.balance ?? inv.balance_due ?? (num(inv.total) - num(inv.paid)));
                return (
                  <Card key={inv.id ?? i} style={styles.invRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.invNo}>{inv.invoice_number || `Invoice #${inv.id}`}</Text>
                      <Text style={styles.invSub}>
                        {inv.lpo_number ? `LPO ${inv.lpo_number}` : inv.delivery_note_number ? `DN ${inv.delivery_note_number}` : ''}
                        {inv.due_date ? ` · due ${inv.due_date}` : ''}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: spacing.xs }}>
                      <Text style={styles.invAmt}>{kes(bal || num(inv.total ?? inv.amount), false)}</Text>
                      <StatusBadge label={st.replace('_', ' ').toUpperCase()} tone={TONE[st] ?? 'neutral'} mono={false} />
                    </View>
                  </Card>
                );
              })
            )}

            <Text style={styles.note}>
              Every LPO sale is invoiced automatically the moment it's recorded — there's nothing to create here.
            </Text>
          </>
        )}
      </ScrollView>

      <FormModal visible={payOpen} title="Record Payment on Account" onClose={() => setPayOpen(false)} onSubmit={submitPayment} submitLabel="Record Payment" busy={pay.isPending}>
        <Field label="Amount (KES)" value={amount} onChangeText={setAmount} placeholder="0" keyboardType="numeric" />
        <Select label="Method" value={method} options={METHODS} onChange={(v) => setMethod(v as PaymentMethod)} searchable={false} />
        <Field label="Paid on" value={paidOn} onChangeText={setPaidOn} placeholder="YYYY-MM-DD" />
        <Field label="Reference" value={reference} onChangeText={setReference} placeholder="Cheque no. / M-Pesa code / bank ref" />
      </FormModal>
    </View>
  );
}

function Meta({ icon, text }: { icon: any; text: string }) {
  return (
    <View style={styles.meta}>
      <MaterialCommunityIcons name={icon} size={15} color={colors.onSurfaceVariant} />
      <Text style={styles.metaText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { backgroundColor: colors.secondaryFixed },
  heroLabel: { ...type.labelSm, color: colors.onSecondaryFixedVariant },
  heroValue: { ...type.displayLg, color: colors.onSurface, marginTop: spacing.xs },
  heroCredit: { ...type.bodySm, color: colors.onSecondaryFixedVariant, marginTop: spacing.xs },
  metaWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.md },
  meta: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  metaText: { ...type.bodySm, color: colors.onSurfaceVariant, textTransform: 'capitalize' },
  section: { ...type.headlineLgMobile, color: colors.onSurface, marginTop: spacing.xl, marginBottom: spacing.md },
  invRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  invNo: { ...type.titleMd, fontFamily: fonts.sansBold, color: colors.onSurface },
  invSub: { ...type.bodySm, color: colors.onSurfaceVariant, marginTop: 2 },
  invAmt: { ...type.labelSm, fontSize: 14, fontFamily: fonts.monoSemibold, color: colors.onSurface },
  note: { ...type.bodySm, color: colors.onSurfaceVariant, fontStyle: 'italic', marginTop: spacing.md },
});
