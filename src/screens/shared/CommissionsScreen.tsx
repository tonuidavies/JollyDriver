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
import { useMyCommissionRates, useCommissionReport, useAgents } from '../../api/hooks';
import { useAuth } from '../../context/AuthContext';
import { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Commissions'>;
const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const str = (r: any, keys: string[], fallback = '—') => {
  for (const k of keys) if (r?.[k] != null && r[k] !== '') return String(r[k]);
  return fallback;
};
const rowsOf = (d: unknown): any[] => {
  const root: any = (d as any)?.data ?? d;
  if (Array.isArray(root)) return root;
  for (const k of ['commissions', 'rows', 'lines', 'entries']) if (Array.isArray(root?.[k])) return root[k];
  const arrays = Object.values(root ?? {}).filter(Array.isArray) as any[][];
  return arrays.sort((a, b) => b.length - a.length)[0] ?? [];
};

/** How a rate reads depends on its type — per-unit is money, percentage isn't. */
function rateLabel(r: any): string {
  const t = String(r.rate_type ?? r.type ?? '').toLowerCase();
  const v = num(r.rate ?? r.amount ?? r.value);
  if (t.includes('percent')) return `${v}%`;
  if (t.includes('unit') || t === '') return `${kes(v)} / unit`;
  return `${kes(v)} (${t})`;
}

/**
 * Commissions. Agents see the rates that actually apply to them (their own rate
 * always beats their route's default, so an overridden route rate never shows).
 * Admins additionally get the earned-commission report, filterable by agent.
 */
export default function CommissionsScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { activeView } = useAuth();
  const isAdmin = activeView === 'admin';

  const [tab, setTab] = useState<'rates' | 'earned'>(isAdmin ? 'earned' : 'rates');
  const [preset, setPreset] = useState<RangePreset>('7d');
  const [agentId, setAgentId] = useState<number | null>(null);
  const range = rangeFor(preset);

  const rates = useMyCommissionRates();
  const agents = useAgents();
  const earned = useCommissionReport({ from: range.from, to: range.to, agent_id: agentId ?? undefined }, tab === 'earned');

  const rateRows = useMemo(() => rowsOf(rates.data), [rates.data]);
  const earnedRows = useMemo(() => rowsOf(earned.data), [earned.data]);
  const earnedTotal = useMemo(
    () => earnedRows.reduce((s, r) => s + num(r.commission_earned ?? r.commission ?? r.earned ?? r.amount), 0),
    [earnedRows]
  );

  const agentOpts = [
    { label: 'All agents', value: 0 },
    ...((agents.data ?? []) as any[]).map((a) => ({
      label: `${a.first_name ?? ''} ${a.last_name ?? ''}`.trim() || `Agent ${a.id}`,
      value: num(a.id),
    })),
  ];

  const active = tab === 'rates' ? rates : earned;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.marginMobile, paddingBottom: spacing.xl }}
      refreshControl={<RefreshControl refreshing={active.isRefetching} onRefresh={active.refetch} tintColor={colors.primary} />}
      showsVerticalScrollIndicator={false}
    >
      <ScreenTitleBar title="Commissions" onBack={() => navigation.goBack()} showSync={false} />

      <View style={styles.tabs}>
        <Tab label="My Rates" icon="percent-outline" active={tab === 'rates'} onPress={() => setTab('rates')} />
        <Tab label="Earned" icon="cash-multiple" active={tab === 'earned'} onPress={() => setTab('earned')} />
      </View>

      {tab === 'rates' ? (
        <>
          <Text style={styles.blurb}>
            Rates are configured on the web. Your own rate always wins over your route's default, so anything you
            override won't be listed here. An empty list is normal.
          </Text>
          {rates.isLoading ? (
            <Loading label="Loading rates…" />
          ) : rates.isError ? (
            <ErrorState message={(rates.error as Error)?.message} onRetry={rates.refetch} />
          ) : rateRows.length === 0 ? (
            <EmptyState icon="pricetags-outline" message="No commission rates apply to you." />
          ) : (
            rateRows.map((r, i) => (
              <Card key={`${r.product_id}-${i}`} style={styles.row}>
                <View style={styles.rowIcon}>
                  <MaterialCommunityIcons name="bread-slice-outline" size={20} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{str(r, ['product_name', 'product'], `Product ${r.product_id}`)}</Text>
                  <Text style={styles.rowSub}>
                    {str(r, ['route_name', 'route'], 'All routes')}
                    {r.scope ? ` · ${r.scope}` : ''}
                  </Text>
                </View>
                <Text style={styles.rowAmt}>{rateLabel(r)}</Text>
              </Card>
            ))
          )}
        </>
      ) : (
        <>
          <RangeChips value={preset} onChange={setPreset} />
          {isAdmin && (
            <Select value={agentId ?? 0} options={agentOpts} onChange={(v) => setAgentId(num(v) || null)} placeholder="All agents" />
          )}

          <Card style={styles.totalCard}>
            <Text style={styles.totalLabel}>COMMISSION EARNED · {range.from} → {range.to}</Text>
            <Text style={styles.totalValue}>{kes(earnedTotal)}</Text>
            <Text style={styles.totalSub}>{earnedRows.length} line{earnedRows.length === 1 ? '' : 's'} · not every dispatch earns one</Text>
          </Card>

          {earned.isLoading ? (
            <Loading label="Running report…" />
          ) : earned.isError ? (
            <ErrorState message={(earned.error as Error)?.message} onRetry={earned.refetch} />
          ) : earnedRows.length === 0 ? (
            <EmptyState icon="cash-outline" message="No commission recorded in this period." />
          ) : (
            earnedRows.map((r, i) => (
              <Card key={i} style={styles.earnedCard}>
                <View style={styles.earnedTop}>
                  <Text style={styles.rowTitle}>{str(r, ['product_name', 'product'])}</Text>
                  <Text style={styles.earnedAmt}>{kes(num(r.commission_earned ?? r.commission ?? r.earned ?? r.amount), false)}</Text>
                </View>
                <Text style={styles.rowSub}>
                  {str(r, ['agent', 'agent_name'])} · {str(r, ['route', 'route_name', 'school', 'customer_name'])}
                </Text>
                <View style={styles.chipRow}>
                  <Chip label="Qty" value={str(r, ['quantity_sold', 'quantity', 'qty'])} />
                  <Chip label="Unit" value={kes(num(r.unit_price ?? r.price), false)} />
                  <Chip label="Sale" value={kes(num(r.sale_amount ?? r.amount_sold ?? r.total), false)} />
                  <Chip label="Rate" value={rateLabel(r)} />
                  <Chip label="Date" value={str(r, ['date', 'dispatch_date', 'created_on'])} />
                </View>
              </Card>
            ))
          )}
        </>
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

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.chip}>
      <Text style={styles.chipKey}>{label}</Text>
      <Text style={styles.chipVal}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, height: 46, borderRadius: radius.md, backgroundColor: colors.surfaceContainerHigh },
  tabActive: { backgroundColor: colors.primaryContainer },
  tabText: { ...type.bodySm, fontFamily: fonts.sansSemibold, color: colors.onSurfaceVariant },
  blurb: { ...type.bodySm, color: colors.onSurfaceVariant, marginBottom: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  rowIcon: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.surfaceContainerHigh, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md },
  rowTitle: { ...type.titleMd, color: colors.onSurface },
  rowSub: { ...type.bodySm, color: colors.onSurfaceVariant, marginTop: 2 },
  rowAmt: { ...type.labelSm, fontSize: 14, fontFamily: fonts.monoSemibold, color: colors.primary },
  totalCard: { marginTop: spacing.md, marginBottom: spacing.lg },
  totalLabel: { ...type.labelSm, color: colors.onSurfaceVariant },
  totalValue: { ...type.metricXl, fontSize: 28, color: colors.primary, marginTop: spacing.xs },
  totalSub: { ...type.bodySm, color: colors.onSurfaceVariant, marginTop: 2 },
  earnedCard: { marginBottom: spacing.sm },
  earnedTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  earnedAmt: { ...type.labelSm, fontSize: 15, fontFamily: fonts.monoSemibold, color: colors.success },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  chip: { backgroundColor: colors.surfaceContainerHigh, borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  chipKey: { ...type.labelSm, fontSize: 10, color: colors.onSurfaceVariant },
  chipVal: { ...type.bodySm, fontFamily: fonts.monoMedium, color: colors.onSurface },
});
