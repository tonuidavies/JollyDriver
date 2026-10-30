import React from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CompositeScreenProps } from '@react-navigation/native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Card, Avatar, SyncIcon, ProgressBar } from '../../components';
import DispatchCard from '../../components/DispatchCard';
import { Loading, ErrorState, EmptyState } from '../../components/StateView';
import { colors, type, fonts, spacing, radius } from '../../theme';
import { kes, kesShort } from '../../utils/format';
import { useAdminDashboard, useDispatchReport, useDispatches } from '../../api/hooks';
import { useAuth } from '../../context/AuthContext';
import { prettyDate } from '../../api/dates';
import { AdminTabsParamList, RootStackParamList } from '../../navigation/types';

type Props = CompositeScreenProps<
  BottomTabScreenProps<AdminTabsParamList, 'Home'>,
  NativeStackScreenProps<RootStackParamList>
>;

export default function AdminDashboard({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const dash = useAdminDashboard();
  const report = useDispatchReport();
  const active = useDispatches(undefined, 'active');

  const k = dash.data?.kpis;
  const attention = dash.data?.attention;
  const routes = dash.data?.routes ?? [];
  const worst = routes.filter((r) => r.dispatched > 0 || r.collected > 0).slice(0, 8);
  const trend = dash.data?.trend ?? [];
  const tills = dash.data?.mpesaByTill ?? [];
  const counts = report.data?.status_counts;
  const activeList = active.data ?? [];

  const refreshAll = () => {
    dash.refetch();
    report.refetch();
    active.refetch();
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.marginMobile, paddingBottom: spacing.xl }}
      refreshControl={<RefreshControl refreshing={dash.isRefetching} onRefresh={refreshAll} tintColor={colors.primary} />}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Avatar initials={(user?.first_name?.[0] ?? 'A') + (user?.last_name?.[0] ?? '')} size={48} ring />
          <View>
            <Text style={styles.title}>Good day, {user?.first_name ?? 'Admin'}</Text>
            <Text style={styles.date}>{prettyDate()}</Text>
          </View>
        </View>
        <SyncIcon />
      </View>

      {dash.isLoading ? (
        <Loading label="Pulling today's figures…" />
      ) : dash.isError ? (
        <ErrorState message={(dash.error as Error)?.message} onRetry={refreshAll} />
      ) : (
        <>
          {/* Collected hero — mirrors the web dashboard's hero band */}
          <View style={styles.hero}>
            <Text style={styles.heroLabel}>COLLECTED TODAY</Text>
            <Text style={styles.heroValue}>{kes(k?.collectedToday ?? 0)}</Text>
            <Text style={styles.heroSub}>
              {(k?.vehiclesShort ?? 0) > 0
                ? `${k?.vehiclesShort} vehicle${k?.vehiclesShort === 1 ? '' : 's'} short today`
                : 'No vehicles short today'}
              {k?.vehiclesOnRoad ? ` · ${k.vehiclesOnRoad} on the road` : ''}
            </Text>
          </View>

          {/* KPI grid. Dispatched + M-Pesa are live; Returned / Cash / Short are
              only known at EOD, so the server reports yesterday for those. */}
          <View style={styles.kpiRow}>
            <Kpi icon="cube-outline" label="Dispatched" period="TODAY" value={kes(k?.dispatchedToday ?? 0, false)} delta={k?.dispatchedChangePct ?? null} />
            <Kpi icon="cellphone-check" label="M-Pesa" period="TODAY" value={kes(k?.mpesaToday ?? 0, false)} delta={k?.mpesaChangePct ?? null} tone={colors.tertiary} />
          </View>
          <View style={styles.kpiRow}>
            <Kpi icon="package-variant-closed" label="Returned" period="YESTERDAY" value={kes(k?.returnedYesterday ?? 0, false)} />
            <Kpi icon="cash-multiple" label="Cash" period="YESTERDAY" value={kes(k?.cashYesterday ?? 0, false)} />
          </View>
          <View style={styles.kpiRow}>
            <Kpi
              icon="alert-circle-outline"
              label="Short"
              period="YESTERDAY"
              value={kes(k?.shortYesterday ?? 0, false)}
              tone={(k?.shortYesterday ?? 0) > 0 ? colors.error : colors.success}
            />
            <Kpi icon="map-marker-path" label="Routes Active" period="TODAY" value={String(k?.vehiclesOnRoad ?? 0)} />
          </View>

          {dash.data?.degraded && (
            <Text style={styles.note}>
              Live KPI endpoint unavailable — these figures are rolled up from route performance.
            </Text>
          )}

          {/* Needs attention */}
          <View style={styles.sectionHead}>
            <Text style={styles.section}>Needs Attention</Text>
            {attention ? (
              <Text style={styles.badgeCount}>
                {attention.vehicles.length + (attention.openDispatches > 0 ? 1 : 0) + (attention.overdueInvoices > 0 ? 1 : 0)}
              </Text>
            ) : null}
          </View>
          <Card style={styles.attentionCard}>
            {!attention ? (
              <Text style={styles.attentionOk}>Attention feed unavailable.</Text>
            ) : attention.vehicles.length === 0 ? (
              attention.openDispatches === 0 && attention.overdueInvoices === 0 ? (
                <Text style={styles.attentionOk}>Nothing needs attention right now.</Text>
              ) : (
                <>
                  {attention.openDispatches > 0 && (
                    <Pressable style={styles.attentionRow} onPress={() => navigation.navigate('Dispatches')}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.attentionName}>
                          {attention.openDispatches} dispatch{attention.openDispatches === 1 ? '' : 'es'} still open
                        </Text>
                        <Text style={styles.attentionMeta}>
                          No end-of-day yet{attention.oldestOpen ? ` · oldest since ${attention.oldestOpen}` : ''}
                        </Text>
                      </View>
                    </Pressable>
                  )}
                  {attention.overdueInvoices > 0 && (
                    <Pressable style={styles.attentionRow} onPress={() => navigation.navigate('Invoices')}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.attentionName}>
                          {attention.overdueInvoices} school invoice{attention.overdueInvoices === 1 ? '' : 's'} overdue
                        </Text>
                        <Text style={styles.attentionMeta}>{kes(attention.outstandingLpo)} owed on school/LPO accounts</Text>
                      </View>
                    </Pressable>
                  )}
                </>
              )
            ) : (
              <>
                <Text style={styles.attentionTotal}>{kes(attention.outstanding)} outstanding</Text>
                {attention.vehicles.slice(0, 6).map((v, i) => (
                  <View key={`${v.name}-${i}`} style={styles.attentionRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.attentionName}>{v.name}</Text>
                      <Text style={styles.attentionMeta}>{v.route} · {v.agent}</Text>
                    </View>
                    <Text style={styles.attentionAmt}>{kes(v.shortage, false)}</Text>
                  </View>
                ))}
                <Text style={styles.attentionMeta}>
                  {attention.agentsAffected} agent{attention.agentsAffected === 1 ? '' : 's'} affected
                  {attention.openDispatches ? ` · ${attention.openDispatches} open, no EOD` : ''}
                  {attention.overpaymentToday ? ` · ${kes(attention.overpaymentToday)} overpayment swept` : ''}
                </Text>
              </>
            )}
          </Card>

          {/* Route performance */}
          <View style={styles.sectionHead}>
            <Text style={styles.section}>Route Performance</Text>
            <Pressable onPress={() => navigation.navigate('Route')}>
              <Text style={styles.viewAll}>All {routes.length} →</Text>
            </Pressable>
          </View>
          <Text style={styles.sectionSub}>Collected vs dispatched · worst first</Text>

          {worst.length === 0 ? (
            <EmptyState icon="map-outline" message="No route activity today." />
          ) : (
            worst.map((r) => (
              <Pressable key={r.id} onPress={() => navigation.navigate('RouteRecon', { routeId: r.id, routeName: r.name })}>
                <Card style={styles.routeCard}>
                  <View style={styles.routeTop}>
                    <Text style={styles.routeName} numberOfLines={1}>{r.name}</Text>
                    {r.dispatched > 0 ? (
                      <Text style={[styles.routePct, { color: r.pct < 0.5 ? colors.error : colors.primary }]}>{Math.round(r.pct * 100)}%</Text>
                    ) : (
                      <Text style={[styles.routePct, { color: colors.onSurfaceVariant, fontSize: 13 }]}>no trip today</Text>
                    )}
                  </View>
                  {r.dispatched > 0 && (
                    <ProgressBar progress={r.pct} height={8} fillColor={r.pct < 0.5 ? colors.error : colors.primaryContainer} />
                  )}
                  <Text style={styles.routeFig}>
                    {r.dispatched > 0
                      ? `${kes(r.collected, false)} of ${kes(r.dispatched, false)} KES collected`
                      : `${kes(r.collected)} came in (till / M-Pesa)`}
                  </Text>
                </Card>
              </Pressable>
            ))
          )}

          {/* 7-day trend */}
          {trend.length > 0 && (
            <>
              <View style={styles.sectionHead}>
                <Text style={styles.section}>Trend</Text>
                <Pressable onPress={() => navigation.navigate('ReportView', { kind: 'summary', title: 'Period Summary' })}>
                  <Text style={styles.viewAll}>7 days →</Text>
                </Pressable>
              </View>
              <Card>
                <TrendChart rows={trend} />
                <View style={styles.legend}>
                  <Legend color={colors.secondary} label="Dispatched" />
                  <Legend color={colors.success} label="Collected" />
                </View>
              </Card>
            </>
          )}

          {/* M-Pesa by till */}
          {tills.length > 0 && (
            <>
              <View style={styles.sectionHead}>
                <Text style={styles.section}>M-Pesa by Till</Text>
                <Pressable onPress={() => navigation.navigate('ReportView', { kind: 'mpesa_recon', title: 'M-Pesa Reconciliation' })}>
                  <Text style={styles.viewAll}>Recon →</Text>
                </Pressable>
              </View>
              <Card>
                {tills.map((t, i) => {
                  const max = tills[0]?.amount || 1;
                  return (
                    <View key={`${t.name}-${i}`} style={styles.tillRow}>
                      <Text style={styles.tillName} numberOfLines={1}>{t.name}</Text>
                      <View style={{ flex: 1 }}>
                        <ProgressBar progress={t.amount / max} height={6} fillColor={colors.tertiaryContainer} />
                      </View>
                      <Text style={styles.tillAmt}>{kes(t.amount, false)}</Text>
                    </View>
                  );
                })}
              </Card>
            </>
          )}

          {/* Status breakdown */}
          {counts && (
            <Card style={styles.statusCard}>
              {(['pending', 'active', 'completed', 'cancelled'] as const).map((s, i) => (
                <View key={s} style={[styles.statusItem, i > 0 && styles.statusBorder]}>
                  <Text style={styles.statusCount}>{counts[s] ?? 0}</Text>
                  <Text style={styles.statusLabel}>{s[0].toUpperCase() + s.slice(1)}</Text>
                </View>
              ))}
            </Card>
          )}

          {/* Live deliveries */}
          {activeList.length > 0 && (
            <>
              <Text style={[styles.section, { marginTop: spacing.xl }]}>Live Deliveries</Text>
              {activeList.map((d) => (
                <DispatchCard key={d.id} order={d} onPress={() => navigation.navigate('DispatchDetail', { id: d.id, orderNumber: d.order_number })} />
              ))}
            </>
          )}
        </>
      )}
    </ScrollView>
  );
}

function Kpi({
  icon, label, period, value, tone, delta,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  period?: string;
  value: string;
  tone?: string;
  delta?: number | null;
}) {
  const d = delta == null ? null : Number(delta);
  return (
    <Card style={styles.kpi}>
      <MaterialCommunityIcons name={icon} size={20} color={tone ?? colors.onSurface} />
      <Text style={styles.kpiLabel}>{label}</Text>
      {period ? <Text style={styles.kpiPeriod}>{period}</Text> : null}
      <Text style={[styles.kpiValue, tone ? { color: tone } : null]}>{value}</Text>
      {d != null && Number.isFinite(d) ? (
        <Text style={[styles.kpiDelta, { color: d < 0 ? colors.error : colors.success }]}>
          {d > 0 ? '+' : ''}{d.toFixed(1)}% vs yesterday
        </Text>
      ) : null}
    </Card>
  );
}

function TrendChart({ rows }: { rows: { label: string; dispatched: number; collected: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => Math.max(r.dispatched, r.collected)));
  return (
    <View style={styles.chart}>
      {rows.slice(-7).map((r, i) => (
        <View key={`${r.label}-${i}`} style={styles.chartCol}>
          <View style={styles.chartBars}>
            <View style={[styles.bar, { height: Math.max(2, (r.dispatched / max) * 90), backgroundColor: colors.secondary }]} />
            <View style={[styles.bar, { height: Math.max(2, (r.collected / max) * 90), backgroundColor: colors.success }]} />
          </View>
          <Text style={styles.chartLabel}>{r.label}</Text>
          <Text style={styles.chartValue}>{kesShort(r.collected)}</Text>
        </View>
      ))}
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
  title: { ...type.titleMd, fontFamily: fonts.sansBold, fontSize: 20, color: colors.onSurface },
  date: { ...type.labelSm, color: colors.onSurfaceVariant, marginTop: 2 },

  hero: { backgroundColor: colors.primary, borderRadius: radius.card, padding: spacing.lg },
  heroLabel: { ...type.labelSm, color: colors.inverseOnSurface, opacity: 0.85 },
  heroValue: { ...type.displayLg, color: colors.onPrimary, marginTop: spacing.xs },
  heroSub: { ...type.bodyLg, color: colors.inverseOnSurface, opacity: 0.9, marginTop: spacing.xs },

  kpiRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
  kpi: { flex: 1, gap: 2 },
  kpiLabel: { ...type.labelSm, color: colors.onSurfaceVariant, marginTop: spacing.sm },
  kpiPeriod: { ...type.labelSm, fontSize: 9, color: colors.outline },
  kpiValue: { ...type.metricXl, fontSize: 22, color: colors.onSurface, marginTop: 2 },
  kpiDelta: { ...type.bodySm, fontSize: 11 },

  note: { ...type.bodySm, color: colors.onSurfaceVariant, marginTop: spacing.md, fontStyle: 'italic' },

  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.xl },
  section: { ...type.headlineLg, color: colors.onSurface },
  sectionSub: { ...type.bodySm, color: colors.onSurfaceVariant, marginBottom: spacing.md },
  viewAll: { ...type.titleMd, color: colors.primary },
  badgeCount: { ...type.labelSm, color: colors.onSurfaceVariant, backgroundColor: colors.surfaceContainerHigh, paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.full },

  attentionCard: { marginTop: spacing.md, gap: spacing.sm },
  attentionOk: { ...type.bodyLg, color: colors.onSurfaceVariant },
  attentionTotal: { ...type.titleMd, fontFamily: fonts.sansBold, color: colors.error },
  attentionRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs },
  attentionName: { ...type.titleMd, fontSize: 15, color: colors.onSurface },
  attentionMeta: { ...type.bodySm, color: colors.onSurfaceVariant },
  attentionAmt: { ...type.labelSm, fontSize: 14, fontFamily: fonts.monoSemibold, color: colors.error },

  routeCard: { marginBottom: spacing.sm, gap: spacing.sm },
  routeTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  routeName: { ...type.titleMd, color: colors.onSurface, flex: 1, marginRight: spacing.sm },
  routePct: { ...type.titleMd, fontFamily: fonts.monoSemibold },
  routeFig: { ...type.labelSm, color: colors.onSurfaceVariant },

  chart: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 130, marginTop: spacing.sm },
  chartCol: { flex: 1, alignItems: 'center', gap: 2 },
  chartBars: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 92 },
  bar: { width: 8, borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  chartLabel: { ...type.labelSm, fontSize: 10, color: colors.onSurfaceVariant },
  chartValue: { ...type.labelSm, fontSize: 9, fontFamily: fonts.monoMedium, color: colors.outline },
  legend: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { ...type.labelSm, color: colors.onSurfaceVariant },

  tillRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs },
  tillName: { ...type.bodySm, color: colors.onSurface, width: 110 },
  tillAmt: { ...type.labelSm, fontSize: 12, fontFamily: fonts.monoSemibold, color: colors.onSurface, width: 70, textAlign: 'right' },

  statusCard: { flexDirection: 'row', marginTop: spacing.lg, paddingVertical: spacing.md },
  statusItem: { flex: 1, alignItems: 'center' },
  statusBorder: { borderLeftWidth: 1, borderLeftColor: colors.outlineVariant },
  statusCount: { ...type.headlineLg, fontFamily: fonts.sansBold, color: colors.onSurface },
  statusLabel: { ...type.labelSm, color: colors.onSurfaceVariant, marginTop: 2 },
});
