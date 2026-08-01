import React from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Card, ScreenTitleBar } from '../../components';
import { Loading, ErrorState, EmptyState } from '../../components/StateView';
import { colors, type, fonts, spacing, radius } from '../../theme';
import { kes } from '../../utils/format';
import * as api from '../../api/endpoints';
import { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'ReportView'>;

const FETCHERS: Record<string, () => Promise<any>> = {
  daily_recon: () => api.dailyRecon({}),
  weekly_sales: () => api.weeklySales({}),
  shortage: () => api.shortageReport({}),
  overpayment: () => api.overpaymentReport({}),
  mpesa_recon: () => api.mpesaRecon({}),
  route_performance: () => api.routePerformance({}),
  agent_performance: () => api.agentPerformance({}),
  lpo_sales: () => api.lpoSales({}),
  monthly_sales_by_vehicle: () => api.monthlySalesByVehicle({}),
  summary: () => api.reportsSummary('7d'),
  needs_attention: () => api.needsAttention(),
};

const MONEY = /(value|total|collected|dispatched|amount|shortage|revenue|sales|overpay|balance|net|expected|cash|mpesa|paid|lpo)/i;
const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : NaN);

function fmt(key: string, v: any): string {
  if (v == null) return '—';
  if (typeof v === 'number' || (!isNaN(num(v)) && typeof v !== 'boolean' && String(v).trim() !== '')) {
    const n = num(v);
    if (!isNaN(n) && MONEY.test(key)) return kes(n);
    if (!isNaN(n)) return String(n);
  }
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  return String(v);
}

function labelize(k: string): string {
  return k.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
}

export default function ReportView({ route, navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { kind, title } = route.params;
  const fetcher = FETCHERS[kind] ?? (() => Promise.resolve(null));
  const { data, isLoading, isError, error, refetch, isRefetching } = useQuery({ queryKey: ['reportview', kind], queryFn: fetcher });

  const payload = (data as any) ?? {};
  const scalars = Object.entries(payload).filter(([, v]) => v == null || typeof v !== 'object');
  const objects = Object.entries(payload).filter(([, v]) => v && typeof v === 'object' && !Array.isArray(v));
  const arrays = Object.entries(payload).filter(([, v]) => Array.isArray(v)) as [string, any[]][];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.marginMobile, paddingBottom: spacing.xl }}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
      showsVerticalScrollIndicator={false}
    >
      <ScreenTitleBar title={title} onBack={() => navigation.goBack()} showSync={false} />

      {isLoading ? <Loading label="Running report…" /> : isError ? <ErrorState message={(error as Error)?.message} onRetry={refetch} /> : (
        <>
          {/* top-level scalar KPIs */}
          {scalars.length > 0 && (
            <View style={styles.kpiGrid}>
              {scalars.map(([k, v]) => (
                <View key={k} style={styles.kpi}>
                  <Text style={styles.kpiLabel}>{labelize(k)}</Text>
                  <Text style={styles.kpiValue}>{fmt(k, v)}</Text>
                </View>
              ))}
            </View>
          )}

          {/* nested objects (e.g. status_counts) */}
          {objects.map(([k, obj]) => (
            <View key={k}>
              <Text style={styles.section}>{labelize(k)}</Text>
              <Card>
                {Object.entries(obj as object).map(([ik, iv], i) => (
                  <View key={ik} style={[styles.kv, i > 0 && styles.kvBorder]}>
                    <Text style={styles.kvKey}>{labelize(ik)}</Text>
                    <Text style={styles.kvVal}>{fmt(ik, iv)}</Text>
                  </View>
                ))}
              </Card>
            </View>
          ))}

          {/* arrays → row lists */}
          {arrays.map(([k, rows]) => (
            <View key={k}>
              <Text style={styles.section}>{labelize(k)} ({rows.length})</Text>
              {rows.length === 0 ? (
                <EmptyState icon="file-tray-outline" message="No rows." />
              ) : (
                rows.slice(0, 60).map((row, i) => <RowCard key={i} row={row} />)
              )}
              {rows.length > 60 && <Text style={styles.more}>Showing first 60 of {rows.length}.</Text>}
            </View>
          ))}

          {scalars.length === 0 && objects.length === 0 && arrays.length === 0 && (
            <EmptyState icon="file-tray-outline" message="No data for this period." />
          )}
        </>
      )}
    </ScrollView>
  );
}

function RowCard({ row }: { row: any }) {
  if (row == null || typeof row !== 'object') {
    return <Card style={styles.rowCard}><Text style={styles.rowMain}>{String(row)}</Text></Card>;
  }
  const entries = Object.entries(row).filter(([, v]) => v == null || typeof v !== 'object');
  const titleKey = entries.find(([k]) => /name|route|vehicle|agent|product|order|customer|registration/i.test(k));
  const rest = entries.filter(([k]) => k !== titleKey?.[0]).slice(0, 5);
  return (
    <Card style={styles.rowCard}>
      {titleKey && <Text style={styles.rowMain}>{fmt(titleKey[0], titleKey[1])}</Text>}
      <View style={styles.rowChips}>
        {rest.map(([k, v]) => (
          <View key={k} style={styles.chip}>
            <Text style={styles.chipKey}>{labelize(k)}</Text>
            <Text style={styles.chipVal}>{fmt(k, v)}</Text>
          </View>
        ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  kpi: { width: '47%', flexGrow: 1, backgroundColor: colors.surfaceContainerLowest, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.outlineVariant },
  kpiLabel: { ...type.labelSm, color: colors.onSurfaceVariant },
  kpiValue: { ...type.metricXl, fontSize: 20, color: colors.onSurface, marginTop: spacing.xs },
  section: { ...type.headlineLgMobile, color: colors.onSurface, marginTop: spacing.xl, marginBottom: spacing.md },
  kv: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm },
  kvBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.outlineVariant },
  kvKey: { ...type.bodyLg, color: colors.onSurfaceVariant, textTransform: 'capitalize' },
  kvVal: { ...type.bodyLg, fontFamily: fonts.sansSemibold, color: colors.onSurface },
  rowCard: { marginBottom: spacing.sm },
  rowMain: { ...type.titleMd, color: colors.onSurface },
  rowChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  chip: { backgroundColor: colors.surfaceContainerHigh, borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  chipKey: { ...type.labelSm, fontSize: 10, color: colors.onSurfaceVariant },
  chipVal: { ...type.bodySm, fontFamily: fonts.monoMedium, color: colors.onSurface },
  more: { ...type.bodySm, color: colors.onSurfaceVariant, fontStyle: 'italic', textAlign: 'center', marginTop: spacing.sm },
});
