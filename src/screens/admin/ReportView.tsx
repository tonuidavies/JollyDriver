import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Card, ScreenTitleBar, RangeChips } from '../../components';
import { Loading, ErrorState, EmptyState } from '../../components/StateView';
import { colors, type, fonts, spacing, radius } from '../../theme';
import { kes } from '../../utils/format';
import { rangeFor, currentMonth, RangePreset } from '../../api/dates';
import * as api from '../../api/endpoints';
import { asTable, ReportTable } from '../../api/tables';
import { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'ReportView'>;

type Range = { from: string; to: string };

/** Each report takes the picked range in whatever shape its endpoint expects. */
const FETCHERS: Record<string, (r: Range, preset: RangePreset) => Promise<any>> = {
  daily_recon: (r) => api.dailyRecon({ date: r.to }),
  weekly_sales: (r) => api.weeklySales(r),
  shortage: (r) => api.shortageReport(r),
  overpayment: (r) => api.overpaymentReport(r),
  mpesa_recon: (r) => api.mpesaRecon({ ...r, limit: 0 }),
  route_performance: (r) => api.routePerformance(r),
  agent_performance: (r) => api.agentPerformance(r),
  lpo_sales: (r) => api.lpoSales(r),
  commission: (r) => api.commissionReport(r),
  cashflow: (r) => api.cashflowReport(r),
  monthly_sales_by_vehicle: () => api.monthlySalesByVehicle({ month: currentMonth() }),
  summary: (_r, preset) => api.reportsSummary(preset === '30d' ? '30d' : preset === '90d' ? '90d' : '7d'),
  needs_attention: (r) => api.needsAttention(r.to),
};

/** Reports that ignore the range picker entirely. */
const NO_RANGE = new Set(['monthly_sales_by_vehicle']);

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
  const [preset, setPreset] = useState<RangePreset>(kind === 'daily_recon' || kind === 'needs_attention' ? 'today' : '7d');
  const range = rangeFor(preset);
  const fetcher = FETCHERS[kind];
  const { data, isLoading, isError, error, refetch, isRefetching } = useQuery({
    queryKey: ['reportview', kind, preset],
    queryFn: () => (fetcher ? fetcher(range, preset) : Promise.resolve(null)),
  });

  // some endpoints return a bare array once the envelope is unwrapped
  const raw: any = Array.isArray(data) ? { rows: data } : (data as any) ?? {};
  // most reports are the web's table format — render it as one, and show the rest generically
  const table = asTable(raw);
  const payload: any = table
    ? Object.fromEntries(Object.entries(raw).filter(([k]) => !TABLE_KEYS.has(k)))
    : raw;
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

      {!NO_RANGE.has(kind) && (
        <>
          <RangeChips value={preset} onChange={setPreset} />
          <Text style={styles.rangeNote}>
            {kind === 'daily_recon' || kind === 'needs_attention' ? range.to : `${range.from} → ${range.to}`}
          </Text>
        </>
      )}

      {isLoading ? <Loading label="Running report…" /> : isError ? <ErrorState message={(error as Error)?.message} onRetry={refetch} /> : (
        <>
          {table && <TableReport table={table} chart={raw.chart} />}

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

          {!table && scalars.length === 0 && objects.length === 0 && arrays.length === 0 && (
            <EmptyState icon="file-tray-outline" message="No data for this period." />
          )}
        </>
      )}
    </ScrollView>
  );
}

/** Keys the table renderer owns; matrix_days/vehicles are the web's day×vehicle grid, too wide for a phone. */
const TABLE_KEYS = new Set(['summary', 'columns', 'rows', 'chart', 'matrix_days', 'vehicles', 'notice']);

function TableReport({ table, chart }: { table: ReportTable; chart: unknown }) {
  const bars = Array.isArray(chart) ? chart.filter((c: any) => c && c.label != null && c.pct != null) : [];
  return (
    <>
      {table.summary.length > 0 && (
        <View style={styles.kpiGrid}>
          {table.summary.map((s, i) => (
            <View key={`${s.label}-${i}`} style={styles.kpi}>
              <Text style={styles.kpiLabel}>{s.label}</Text>
              <Text style={styles.kpiValue}>{s.value}</Text>
            </View>
          ))}
        </View>
      )}

      {bars.length > 0 && (
        <Card style={{ marginTop: spacing.md, gap: spacing.sm }}>
          {bars.slice(0, 12).map((b: any, i: number) => (
            <View key={i}>
              <View style={styles.barHead}>
                <Text style={styles.barLabel} numberOfLines={1}>{String(b.label)}</Text>
                <Text style={styles.barValue}>{String(b.valueFmt ?? `${Math.round(Number(b.pct) || 0)}%`)}</Text>
              </View>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { width: `${Math.max(2, Math.min(100, Number(b.pct) || 0))}%`, backgroundColor: b.color || colors.primaryContainer }]} />
              </View>
            </View>
          ))}
        </Card>
      )}

      <Text style={styles.section}>Rows ({table.rows.length})</Text>
      {table.rows.length === 0 ? (
        <EmptyState icon="file-tray-outline" message="Nothing in this period." />
      ) : (
        table.rows.slice(0, 80).map((row, i) => (
          <Card key={i} style={styles.rowCard}>
            <Text style={styles.rowMain}>{row[0]?.text == null ? '—' : String(row[0].text)}</Text>
            <View style={styles.rowChips}>
              {table.columns.slice(1).map((c, ci) => {
                const cell = row[ci + 1];
                if (!cell || cell.text == null || cell.text === '') return null;
                return cell.isPill ? (
                  <Text key={ci} style={[styles.pill, { backgroundColor: cell.pillBg || colors.surfaceContainerHigh, color: cell.pillColor || colors.onSurface }]}>
                    {String(cell.text)}
                  </Text>
                ) : (
                  <View key={ci} style={styles.chip}>
                    <Text style={styles.chipKey}>{c.label}</Text>
                    <Text style={styles.chipVal}>{String(cell.text)}</Text>
                  </View>
                );
              })}
            </View>
          </Card>
        ))
      )}
      {table.rows.length > 80 && <Text style={styles.more}>Showing first 80 of {table.rows.length}.</Text>}
    </>
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
  rangeNote: { ...type.bodySm, color: colors.onSurfaceVariant, marginBottom: spacing.md },
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
  pill: { ...type.labelSm, fontSize: 11, fontFamily: fonts.sansBold, borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 3, overflow: 'hidden', alignSelf: 'center' },
  barHead: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  barLabel: { ...type.bodySm, color: colors.onSurface, flex: 1 },
  barValue: { ...type.bodySm, fontFamily: fonts.monoMedium, color: colors.onSurfaceVariant },
  barTrack: { height: 8, borderRadius: 4, backgroundColor: colors.surfaceContainerHigh, overflow: 'hidden', marginTop: 4 },
  barFill: { height: '100%', borderRadius: 4 },
});
