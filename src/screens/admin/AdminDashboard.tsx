import React from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CompositeScreenProps } from '@react-navigation/native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Card, Avatar, SyncIcon, ProgressBar } from '../../components';
import DispatchCard from '../../components/DispatchCard';
import { Loading, ErrorState, EmptyState } from '../../components/StateView';
import { colors, type, fonts, spacing, radius } from '../../theme';
import { kes, kesShort } from '../../utils/format';
import { useDashboardSummary, useDispatchReport, useDispatches } from '../../api/hooks';
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
  const summary = useDashboardSummary();
  const report = useDispatchReport();
  const active = useDispatches(undefined, 'active');

  const t = summary.data?.totals;
  const worst = (summary.data?.routes ?? []).filter((r) => r.dispatched > 0 || r.collected > 0).slice(0, 8);
  const counts = report.data?.status_counts;
  const activeList = active.data ?? [];

  const refreshAll = () => {
    summary.refetch();
    report.refetch();
    active.refetch();
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.marginMobile, paddingBottom: spacing.xl }}
      refreshControl={<RefreshControl refreshing={summary.isRefetching} onRefresh={refreshAll} tintColor={colors.primary} />}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Avatar initials={(user?.first_name?.[0] ?? 'A') + (user?.last_name?.[0] ?? '')} size={48} ring />
          <View>
            <Text style={styles.title}>Good evening, {user?.first_name ?? 'Admin'}</Text>
            <Text style={styles.date}>{prettyDate()}</Text>
          </View>
        </View>
        <SyncIcon />
      </View>

      {summary.isLoading ? (
        <Loading label="Rolling up all routes…" />
      ) : summary.isError ? (
        <ErrorState message={(summary.error as Error)?.message} onRetry={refreshAll} />
      ) : (
        <>
          {/* Collected hero */}
          <View style={styles.hero}>
            <Text style={styles.heroLabel}>COLLECTED TODAY</Text>
            <Text style={styles.heroValue}>{kes(t?.collected ?? 0)}</Text>
            <Text style={styles.heroSub}>
              across {summary.data?.routes.length ?? 0} routes · {t?.routesShort ?? 0} short
            </Text>
          </View>

          {/* KPI grid */}
          <View style={styles.kpiRow}>
            <Kpi icon="cube-outline" label="Dispatched" value={kes(t?.dispatched ?? 0, false)} />
            <Kpi icon="swap-vertical-outline" label="Net Position" value={kes(t?.netPosition ?? 0, false)} tone={(t?.netPosition ?? 0) > 0 ? colors.error : colors.success} />
          </View>
          <View style={styles.kpiRow}>
            <Kpi icon="alert-circle-outline" label="Shortages" value={kes(t?.shortages ?? 0, false)} tone={(t?.shortages ?? 0) > 0 ? colors.error : colors.success} />
            <Kpi icon="cash-multiple" label="Returns" value={kes(t?.returns ?? 0, false)} />
          </View>

          <Text style={styles.note}>
            "Collected" is combined cash + M-Pesa. A dedicated M-Pesa-by-till figure and the 7-day trend
            need backend endpoints (details in the chat).
          </Text>

          {/* Route performance */}
          <View style={styles.sectionHead}>
            <Text style={styles.section}>Route Performance</Text>
            <Pressable onPress={() => navigation.navigate('Route')}>
              <Text style={styles.viewAll}>All {summary.data?.routes.length ?? 0} →</Text>
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
                    <Text style={[styles.routePct, { color: r.pct < 0.5 ? colors.error : colors.primary }]}>{Math.round(r.pct * 100)}%</Text>
                  </View>
                  <ProgressBar progress={r.pct} height={8} fillColor={r.pct < 0.5 ? colors.error : colors.primaryContainer} />
                  <Text style={styles.routeFig}>{kes(r.collected, false)} / {kes(r.dispatched, false)} KES</Text>
                </Card>
              </Pressable>
            ))
          )}

          {/* Status breakdown */}
          {counts && (
            <Card style={styles.statusCard}>
              {(['pending', 'active', 'completed', 'cancelled'] as const).map((k, i) => (
                <View key={k} style={[styles.statusItem, i > 0 && styles.statusBorder]}>
                  <Text style={styles.statusCount}>{counts[k] ?? 0}</Text>
                  <Text style={styles.statusLabel}>{k[0].toUpperCase() + k.slice(1)}</Text>
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

function Kpi({ icon, label, value, tone }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; value: string; tone?: string }) {
  return (
    <Card style={styles.kpi}>
      <MaterialCommunityIcons name={icon} size={22} color={tone ?? colors.onSurface} />
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text style={[styles.kpiValue, tone ? { color: tone } : null]}>{value}</Text>
    </Card>
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
  kpi: { flex: 1, gap: spacing.xs },
  kpiLabel: { ...type.labelSm, color: colors.onSurfaceVariant, marginTop: spacing.sm },
  kpiValue: { ...type.metricXl, fontSize: 24, color: colors.onSurface },

  note: { ...type.bodySm, color: colors.onSurfaceVariant, marginTop: spacing.md, fontStyle: 'italic' },

  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.xl },
  section: { ...type.headlineLg, color: colors.onSurface },
  sectionSub: { ...type.bodySm, color: colors.onSurfaceVariant, marginBottom: spacing.md },
  viewAll: { ...type.titleMd, color: colors.primary },

  routeCard: { marginBottom: spacing.sm, gap: spacing.sm },
  routeTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  routeName: { ...type.titleMd, color: colors.onSurface, flex: 1, marginRight: spacing.sm },
  routePct: { ...type.titleMd, fontFamily: fonts.monoSemibold },
  routeFig: { ...type.labelSm, color: colors.onSurfaceVariant },

  statusCard: { flexDirection: 'row', marginTop: spacing.lg, paddingVertical: spacing.md },
  statusItem: { flex: 1, alignItems: 'center' },
  statusBorder: { borderLeftWidth: 1, borderLeftColor: colors.outlineVariant },
  statusCount: { ...type.headlineLg, fontFamily: fonts.sansBold, color: colors.onSurface },
  statusLabel: { ...type.labelSm, color: colors.onSurfaceVariant, marginTop: 2 },
});
