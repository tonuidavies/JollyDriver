import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Card, ScreenTitleBar, Select, RangeChips } from '../../components';
import { Loading, ErrorState, EmptyState } from '../../components/StateView';
import { colors, type, fonts, spacing, radius } from '../../theme';
import { kes } from '../../utils/format';
import { rangeFor, RangePreset } from '../../api/dates';
import { useShortage, useOverpayment, useVehicles } from '../../api/hooks';
import { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Shortages'>;
const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const rowsOf = (d: unknown): any[] => {
  const root: any = (d as any)?.data ?? d;
  if (Array.isArray(root)) return root;
  for (const k of ['dispatches', 'rows', 'shortages', 'overpayments', 'entries']) {
    if (Array.isArray(root?.[k])) return root[k];
  }
  const arrays = Object.values(root ?? {}).filter(Array.isArray) as any[][];
  return arrays.sort((a, b) => b.length - a.length)[0] ?? [];
};
const str = (r: any, keys: string[], fallback = '—') => {
  for (const k of keys) if (r?.[k] != null && r[k] !== '') return String(r[k]);
  return fallback;
};

/**
 * Finance → Shortages. Every dispatch that came back short in the range, plus
 * the mirror image (overpayments swept to company revenue) on the same period.
 */
export default function ShortagesScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [preset, setPreset] = useState<RangePreset>('7d');
  const [vehicleId, setVehicleId] = useState<number | null>(null);
  const [tab, setTab] = useState<'shortage' | 'overpayment'>('shortage');
  const range = rangeFor(preset);
  const vehicles = useVehicles();

  const query = { from: range.from, to: range.to, vehicle_id: vehicleId ?? undefined };
  // only the visible tab hits the network
  const shortage = useShortage(query, tab === 'shortage');
  const overpayment = useOverpayment(query, tab === 'overpayment');
  const active = tab === 'shortage' ? shortage : overpayment;

  const rows = useMemo(() => rowsOf(active.data), [active.data]);
  const total = useMemo(
    () => rows.reduce((s, r) => s + num(r.shortage_amount ?? r.shortage ?? r.overpayment_value ?? r.overpayment ?? r.amount ?? r.value), 0),
    [rows]
  );

  const vehicleOpts = [
    { label: 'All vehicles', value: 0 },
    ...((vehicles.data ?? []) as any[]).map((v) => ({ label: v.registration_number, value: num(v.id) })),
  ];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.marginMobile, paddingBottom: spacing.xl }}
      refreshControl={<RefreshControl refreshing={active.isRefetching} onRefresh={active.refetch} tintColor={colors.primary} />}
      showsVerticalScrollIndicator={false}
    >
      <ScreenTitleBar title="Shortages" onBack={() => navigation.goBack()} showSync={false} />

      <View style={styles.tabs}>
        <Tab label="Short" icon="alert-circle-outline" active={tab === 'shortage'} onPress={() => setTab('shortage')} />
        <Tab label="Overpaid" icon="cash-plus" active={tab === 'overpayment'} onPress={() => setTab('overpayment')} />
      </View>

      <RangeChips value={preset} onChange={setPreset} />
      <Select value={vehicleId ?? 0} options={vehicleOpts} onChange={(v) => setVehicleId(num(v) || null)} placeholder="All vehicles" />

      <Card style={styles.totalCard}>
        <Text style={styles.totalLabel}>
          {tab === 'shortage' ? 'TOTAL SHORT' : 'TOTAL SWEPT TO REVENUE'} · {range.from} → {range.to}
        </Text>
        <Text style={[styles.totalValue, { color: tab === 'shortage' ? colors.error : colors.success }]}>{kes(total)}</Text>
        <Text style={styles.totalSub}>{rows.length} dispatch{rows.length === 1 ? '' : 'es'}</Text>
      </Card>

      {active.isLoading ? (
        <Loading label="Running report…" />
      ) : active.isError ? (
        <ErrorState message={(active.error as Error)?.message} onRetry={active.refetch} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon="checkmark-done-outline"
          message={tab === 'shortage' ? 'Nothing short in this period.' : 'No overpayments in this period.'}
        />
      ) : (
        rows.map((r, i) => {
          const amount = num(r.shortage_amount ?? r.shortage ?? r.overpayment_value ?? r.overpayment ?? r.amount ?? r.value);
          const dispatchId = num(r.dispatch_id ?? r.id);
          return (
            <Card key={`${dispatchId}-${i}`} style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{str(r, ['order_number', 'dispatch_number', 'reference'], `Dispatch #${dispatchId}`)}</Text>
                <Text style={styles.rowSub}>
                  {str(r, ['vehicle', 'registration_number', 'vehicle_registration'])} · {str(r, ['route', 'route_name'])}
                </Text>
                <Text style={styles.rowSub}>
                  {str(r, ['agent', 'agent_name', 'driver', 'driver_name'])} · {str(r, ['dispatch_date', 'date', 'created_on'])}
                </Text>
              </View>
              <Text style={[styles.rowAmt, { color: tab === 'shortage' ? colors.error : colors.success }]}>
                {kes(amount, false)}
              </Text>
            </Card>
          );
        })
      )}
    </ScrollView>
  );
}

function Tab({ label, icon, active, onPress }: { label: string; icon: any; active: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.tab, active && styles.tabActive]} onPress={onPress}>
      <MaterialCommunityIcons name={icon} size={18} color={active ? colors.onSecondaryFixed : colors.onSurfaceVariant} />
      <Text style={[styles.tabText, active && { color: colors.onSecondaryFixed }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, height: 46, borderRadius: radius.md, backgroundColor: colors.surfaceContainerHigh },
  tabActive: { backgroundColor: colors.primaryContainer },
  tabText: { ...type.bodySm, fontFamily: fonts.sansSemibold, color: colors.onSurfaceVariant },
  totalCard: { marginTop: spacing.md, marginBottom: spacing.lg },
  totalLabel: { ...type.labelSm, color: colors.onSurfaceVariant },
  totalValue: { ...type.metricXl, fontSize: 28, marginTop: spacing.xs },
  totalSub: { ...type.bodySm, color: colors.onSurfaceVariant, marginTop: 2 },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  rowTitle: { ...type.titleMd, fontFamily: fonts.sansBold, color: colors.onSurface },
  rowSub: { ...type.bodySm, color: colors.onSurfaceVariant, marginTop: 2 },
  rowAmt: { ...type.labelSm, fontSize: 15, fontFamily: fonts.monoSemibold },
});
