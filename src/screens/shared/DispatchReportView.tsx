import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Screen, Card, ScreenTitleBar, StatusBadge } from '../../components';
import { Loading, ErrorState } from '../../components/StateView';
import { colors, type, fonts, spacing, radius } from '../../theme';
import { kes } from '../../utils/format';
import { useDispatchDetail } from '../../api/hooks';
import { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'DispatchReport'>;
const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);

export default function DispatchReportView({ route, navigation }: Props) {
  const { id, orderNumber } = route.params;
  const { data, isLoading, isError, error, refetch } = useDispatchDetail(id);

  const totals = useMemo(() => {
    const items = data?.items ?? [];
    const dispatched = num(data?.total_amount);
    const returns = num(data?.returns_value);
    const netExpected = num(data?.net_expected ?? dispatched);
    const shortage = num(data?.shortage_amount);
    const netUnits = items.reduce((s, it) => s + (num(it.quantity) - num(it.returned_quantity)), 0);
    return { dispatched, returns, netExpected, shortage, netUnits };
  }, [data]);

  if (isLoading) return <Screen><Loading label="Loading report…" /></Screen>;
  if (isError || !data)
    return (
      <Screen>
        <ScreenTitleBar title="Report" onBack={() => navigation.goBack()} />
        <ErrorState message={(error as Error)?.message} onRetry={refetch} />
      </Screen>
    );

  const items = data.items ?? [];

  return (
    <Screen>
      <ScreenTitleBar title={`Report · ${orderNumber ?? data.order_number}`} onBack={() => navigation.goBack()} />

      <Card>
        <Row label="Route" value={data.route?.name ?? '—'} />
        <Row label="Vehicle" value={data.vehicle?.registration_number ?? '—'} />
        <Row label="Driver" value={data.driver?.name || '—'} />
        <Row label="Agent" value={data.agent?.name || '—'} />
        <Row label="Date" value={data.dispatch_date} />
        <View style={[styles.metaRow, { marginTop: spacing.xs }]}>
          <Text style={styles.metaLabel}>Status</Text>
          <StatusBadge label={data.status.toUpperCase()} tone={data.status === 'completed' ? 'success' : 'partial'} />
        </View>
      </Card>

      {/* Reconciliation summary */}
      <Text style={styles.section}>Reconciliation</Text>
      <View style={styles.reconGrid}>
        <ReconCell label="Dispatched" value={kes(totals.dispatched)} />
        <ReconCell label="Returns" value={kes(totals.returns)} />
        <ReconCell label="Net Expected" value={kes(totals.netExpected)} tone={colors.primary} />
        <ReconCell label="Shortage" value={kes(totals.shortage)} tone={totals.shortage > 0 ? colors.error : colors.success} />
      </View>

      {/* Items table */}
      <Text style={styles.section}>Items</Text>
      <Card padded={false} style={{ overflow: 'hidden' }}>
        <View style={[styles.tr, styles.th]}>
          <Text style={[styles.cell, styles.thText, { flex: 3 }]}>Product</Text>
          <Text style={[styles.cell, styles.thText, styles.right]}>Qty</Text>
          <Text style={[styles.cell, styles.thText, styles.right]}>Ret.</Text>
          <Text style={[styles.cell, styles.thText, styles.right, { flex: 1.5 }]}>Subtotal</Text>
        </View>
        {items.map((it, i) => (
          <View key={`${it.product_id}-${i}`} style={styles.tr}>
            <Text style={[styles.cell, { flex: 3 }]} numberOfLines={1}>{it.product_name}</Text>
            <Text style={[styles.cell, styles.right, styles.mono]}>{Math.round(num(it.quantity))}</Text>
            <Text style={[styles.cell, styles.right, styles.mono, { color: num(it.returned_quantity) > 0 ? colors.error : colors.onSurfaceVariant }]}>{Math.round(num(it.returned_quantity))}</Text>
            <Text style={[styles.cell, styles.right, styles.mono, { flex: 1.5 }]}>{kes(num(it.subtotal), false)}</Text>
          </View>
        ))}
        <View style={[styles.tr, styles.totalRow]}>
          <Text style={[styles.cell, { flex: 3, fontFamily: fonts.sansBold }]}>Total dispatched</Text>
          <Text style={[styles.cell, styles.right, styles.mono, { flex: 3.5, color: colors.primary }]}>{kes(totals.dispatched)}</Text>
        </View>
      </Card>

      <Text style={styles.note}>
        Line-by-line matched M-Pesa/KCB payments print on the web report; the mobile API returns the reconciled
        totals above. (A per-dispatch payments endpoint would let me list each receipt here too.)
      </Text>

      <View style={styles.sign}>
        <View style={styles.signBlock}><View style={styles.signLine} /><Text style={styles.signLabel}>Reconciled by (Agent)</Text></View>
        <View style={styles.signBlock}><View style={styles.signLine} /><Text style={styles.signLabel}>Verified by (Office)</Text></View>
      </View>
    </Screen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaRow}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}
function ReconCell({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <View style={styles.reconCell}>
      <Text style={styles.reconLabel}>{label}</Text>
      <Text style={[styles.reconValue, tone ? { color: tone } : null]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  metaLabel: { ...type.labelSm, color: colors.onSurfaceVariant },
  metaValue: { ...type.bodyLg, fontFamily: fonts.sansSemibold, color: colors.onSurface, maxWidth: '65%', textAlign: 'right' },

  section: { ...type.headlineLgMobile, color: colors.onSurface, marginTop: spacing.xl, marginBottom: spacing.md },
  reconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  reconCell: { width: '47%', flexGrow: 1, backgroundColor: colors.surfaceContainerLowest, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.outlineVariant },
  reconLabel: { ...type.labelSm, color: colors.onSurfaceVariant },
  reconValue: { ...type.metricXl, fontSize: 20, color: colors.onSurface, marginTop: spacing.xs },

  tr: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.outlineVariant },
  th: { backgroundColor: colors.surfaceContainerHigh, borderTopWidth: 0 },
  thText: { ...type.labelSm, color: colors.onSurfaceVariant },
  cell: { ...type.bodySm, color: colors.onSurface, flex: 1 },
  right: { textAlign: 'right' },
  mono: { fontFamily: fonts.monoMedium },
  totalRow: { backgroundColor: colors.surfaceContainerLow },

  note: { ...type.bodySm, color: colors.onSurfaceVariant, marginTop: spacing.md, fontStyle: 'italic' },
  sign: { flexDirection: 'row', gap: spacing.lg, marginTop: spacing.xl },
  signBlock: { flex: 1 },
  signLine: { height: 1, backgroundColor: colors.outline, marginBottom: spacing.xs },
  signLabel: { ...type.labelSm, color: colors.onSurfaceVariant },
});
