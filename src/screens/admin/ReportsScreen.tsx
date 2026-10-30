import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Card, ScreenTitleBar } from '../../components';
import { colors, type, fonts, spacing, radius } from '../../theme';
import { kes } from '../../utils/format';
import { useReportsSummary } from '../../api/hooks';
import { figure } from '../../api/tables';
import { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Reports'>;

type Entry =
  | { kind: string; title: string; desc: string; icon: string; screen?: undefined }
  | { screen: 'Shortages' | 'Commissions'; title: string; desc: string; icon: string; kind?: undefined };

/** Same catalogue as the web Reports page, in the same order. */
const REPORTS: Entry[] = [
  { kind: 'daily_recon', title: 'Daily Reconciliation', desc: 'Dispatched vs collected vs shortage, per vehicle, for one day', icon: 'scale-balance' },
  { kind: 'weekly_sales', title: 'Weekly Sales Summary', desc: 'Units sold and revenue, per product, over a date range', icon: 'chart-bar' },
  { screen: 'Shortages', title: 'Shortage Report', desc: 'Every dispatch with an EOD shortage recorded in the range', icon: 'alert-circle-outline' },
  { kind: 'overpayment', title: 'Overpayment Report', desc: 'Collections swept to company revenue for exceeding the sale', icon: 'cash-plus' },
  { kind: 'mpesa_recon', title: 'M-Pesa Reconciliation', desc: 'KCB/M-Pesa transactions, matched vs unmatched', icon: 'cellphone-check' },
  { kind: 'route_performance', title: 'Route Performance', desc: 'Dispatched, collected and collection rate, per route', icon: 'map-marker-path' },
  { kind: 'agent_performance', title: 'Agent Performance', desc: 'Trips, shortages and accuracy, per agent', icon: 'account-tie-outline' },
  { screen: 'Commissions', title: 'Commission Earned', desc: 'Every commission line — agent, product, rate and earnings', icon: 'percent-outline' },
  { kind: 'lpo_sales', title: 'LPO / Credit Sales', desc: 'School deliveries, delivery notes and invoice status', icon: 'file-document-outline' },
  { kind: 'cashflow', title: 'Cashflow', desc: 'AR collections per day and method vs what was invoiced', icon: 'bank-outline' },
  { kind: 'monthly_sales_by_vehicle', title: 'Monthly Sales by Vehicle', desc: 'Net sales per active vehicle, per day, for a month', icon: 'truck-outline' },
  { kind: 'summary', title: 'Period Summary', desc: 'Period totals plus the day-by-day chart', icon: 'chart-box-outline' },
  { kind: 'needs_attention', title: 'Needs Attention', desc: 'Vehicles short now, open dispatches, overpayment swept', icon: 'bell-alert-outline' },
];

const PERIODS: { label: string; value: '7d' | '30d' | '90d' }[] = [
  { label: '7 Days', value: '7d' },
  { label: '30 Days', value: '30d' },
  { label: '90 Days', value: '90d' },
];

export default function ReportsScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('7d');
  const summary = useReportsSummary(period);
  const s: any = (summary.data as any) ?? {};
  // totals arrive pre-formatted: { dispatched: "KES 0", collected: "KES 9,516,508", shortage: "KES 0" }
  const t: any = s.totals ?? { dispatched: s.dispatched, collected: s.collected, shortage: s.shortages ?? s.shortage };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.marginMobile, paddingBottom: spacing.xl }}
      refreshControl={<RefreshControl refreshing={summary.isRefetching} onRefresh={summary.refetch} tintColor={colors.primary} />}
      showsVerticalScrollIndicator={false}
    >
      <ScreenTitleBar title="Reports" onBack={() => navigation.goBack()} showSync={false} />
      <Text style={styles.blurb}>Generate operational reports across the business.</Text>

      <View style={styles.periodRow}>
        {PERIODS.map((p) => {
          const active = p.value === period;
          return (
            <Pressable key={p.value} style={[styles.chip, active && styles.chipActive]} onPress={() => setPeriod(p.value)}>
              <Text style={[styles.chipText, active && { color: colors.onSecondaryFixed }]}>{p.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.kpiRow}>
        <Kpi label="Dispatched" value={kes(figure(t.dispatched), false)} />
        <Kpi label="Collected" value={kes(figure(t.collected), false)} tone={colors.success} />
      </View>
      <View style={styles.kpiRow}>
        <Kpi label="Shortages" value={kes(figure(t.shortage), false)} tone={figure(t.shortage) > 0 ? colors.error : undefined} />
        <Kpi label="Period" value={String(s.period ?? period).toUpperCase()} />
      </View>

      <Text style={styles.section}>All Reports</Text>
      {REPORTS.map((r) => (
        <Pressable
          key={r.kind ?? r.screen}
          onPress={() =>
            r.screen
              ? navigation.navigate(r.screen)
              : navigation.navigate('ReportView', { kind: r.kind as string, title: r.title })
          }
        >
          <Card style={styles.row}>
            <View style={styles.icon}><MaterialCommunityIcons name={r.icon as any} size={24} color={colors.primary} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{r.title}</Text>
              <Text style={styles.desc}>{r.desc}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.outline} />
          </Card>
        </Pressable>
      ))}
    </ScrollView>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <Card style={styles.kpi}>
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text style={[styles.kpiValue, tone ? { color: tone } : null]}>{value}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  blurb: { ...type.bodySm, color: colors.onSurfaceVariant, marginBottom: spacing.md },
  periodRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.full, backgroundColor: colors.surfaceContainerHigh },
  chipActive: { backgroundColor: colors.primaryContainer },
  chipText: { ...type.bodySm, fontFamily: fonts.sansSemibold, color: colors.onSurfaceVariant },
  kpiRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  kpi: { flex: 1 },
  kpiLabel: { ...type.labelSm, color: colors.onSurfaceVariant },
  kpiValue: { ...type.metricXl, fontSize: 20, color: colors.onSurface, marginTop: spacing.xs },
  section: { ...type.headlineLgMobile, color: colors.onSurface, marginTop: spacing.md, marginBottom: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  icon: { width: 46, height: 46, borderRadius: radius.md, backgroundColor: colors.surfaceContainerHigh, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md },
  title: { ...type.titleMd, fontFamily: fonts.sansBold, color: colors.onSurface },
  desc: { ...type.bodySm, color: colors.onSurfaceVariant, marginTop: 2 },
});
