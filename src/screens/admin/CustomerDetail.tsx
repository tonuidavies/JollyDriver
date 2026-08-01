import React, { useState, useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, Alert } from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Card, ScreenTitleBar, PrimaryButton } from '../../components';
import { Loading, ErrorState, EmptyState } from '../../components/StateView';
import { colors, type, fonts, spacing, radius } from '../../theme';
import { kes } from '../../utils/format';
import { useCustomer, useUninvoiced, useCreateInvoice } from '../../api/hooks';
import { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'CustomerDetail'>;
const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const saleId = (s: any) => num(s.dispatch_sale_id ?? s.id ?? s.sale_id);
const saleAmt = (s: any) => num(s.amount ?? s.total ?? s.subtotal ?? s.value);

export default function CustomerDetail({ route, navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { id, name } = route.params;
  const cust = useCustomer(id);
  const uninv = useUninvoiced(id);
  const createInvoice = useCreateInvoice();
  const [selected, setSelected] = useState<Record<number, boolean>>({});

  const c: any = (cust.data as any)?.data ?? cust.data ?? {};
  const balance = num(c.outstanding ?? c.outstanding_balance ?? c.balance ?? c.ar_balance);
  const sales: any[] = Array.isArray(uninv.data) ? uninv.data : (uninv.data as any)?.data ?? [];

  const selectedIds = useMemo(() => Object.keys(selected).filter((k) => selected[Number(k)]).map(Number), [selected]);
  const selectedTotal = useMemo(() => sales.filter((s) => selected[saleId(s)]).reduce((sum, s) => sum + saleAmt(s), 0), [sales, selected]);

  const makeInvoice = () => {
    if (selectedIds.length === 0) return Alert.alert('Select deliveries', 'Choose at least one un-invoiced delivery.');
    createInvoice.mutate(
      { customer_id: id, dispatch_sale_ids: selectedIds },
      { onSuccess: () => { setSelected({}); uninv.refetch(); cust.refetch(); Alert.alert('Invoice created'); }, onError: (e) => Alert.alert('Failed', (e as Error).message) }
    );
  };

  return (
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
            <View style={styles.metaWrap}>
              {c.phone ? <Meta icon="phone-outline" text={String(c.phone)} /> : null}
              {c.contact_person ? <Meta icon="account-outline" text={String(c.contact_person)} /> : null}
              {c.customer_type ? <Meta icon="tag-outline" text={String(c.customer_type)} /> : null}
              {c.payment_terms_days ? <Meta icon="calendar-clock" text={`${c.payment_terms_days}d terms`} /> : null}
            </View>
          </Card>

          <Text style={styles.section}>Un-invoiced Deliveries</Text>
          {uninv.isLoading ? <Loading /> : sales.length === 0 ? (
            <EmptyState icon="checkmark-done-outline" message="Nothing waiting to be invoiced." />
          ) : (
            <>
              {sales.map((s, i) => {
                const sid = saleId(s);
                const on = !!selected[sid];
                return (
                  <Pressable key={sid || i} onPress={() => setSelected((p) => ({ ...p, [sid]: !on }))}>
                    <Card style={[styles.saleRow, on && styles.saleRowOn]}>
                      <Ionicons name={on ? 'checkbox' : 'square-outline'} size={22} color={on ? colors.primary : colors.outline} />
                      <View style={{ flex: 1, marginLeft: spacing.sm }}>
                        <Text style={styles.saleName}>{s.lpo_number || s.order_number || s.reference || `Delivery #${sid}`}</Text>
                        <Text style={styles.saleSub}>{s.date || s.created_on || s.dispatch_date || ''}</Text>
                      </View>
                      <Text style={styles.saleAmt}>{kes(saleAmt(s), false)}</Text>
                    </Card>
                  </Pressable>
                );
              })}
              <View style={styles.selBar}>
                <Text style={styles.selText}>{selectedIds.length} selected · {kes(selectedTotal)}</Text>
              </View>
              <PrimaryButton label="Create Invoice" icon="file-document-outline" iconRight={false} style={{ marginTop: spacing.sm }} onPress={makeInvoice} disabled={createInvoice.isPending} />
            </>
          )}

          <PrimaryButton label="View Invoices" variant="secondary" icon="receipt-outline" iconRight={false} style={{ marginTop: spacing.lg }} onPress={() => navigation.navigate('Invoices')} />
        </>
      )}
    </ScrollView>
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
  metaWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.md },
  meta: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  metaText: { ...type.bodySm, color: colors.onSurfaceVariant, textTransform: 'capitalize' },
  section: { ...type.headlineLgMobile, color: colors.onSurface, marginTop: spacing.xl, marginBottom: spacing.md },
  saleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  saleRowOn: { borderWidth: 1, borderColor: colors.primaryContainer },
  saleName: { ...type.titleMd, fontSize: 16, color: colors.onSurface },
  saleSub: { ...type.bodySm, color: colors.onSurfaceVariant, marginTop: 2 },
  saleAmt: { ...type.labelSm, fontSize: 14, fontFamily: fonts.monoSemibold, color: colors.onSurface },
  selBar: { marginTop: spacing.sm },
  selText: { ...type.bodyLg, color: colors.onSurfaceVariant },
});
