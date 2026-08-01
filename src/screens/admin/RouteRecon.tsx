import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Card, ScreenTitleBar, ProgressBar } from '../../components';
import DispatchCard from '../../components/DispatchCard';
import { Loading, ErrorState, EmptyState } from '../../components/StateView';
import { colors, type, spacing, radius } from '../../theme';
import { kes } from '../../utils/format';
import { useRouteReport, useDispatches } from '../../api/hooks';
import { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'RouteRecon'>;

export default function RouteRecon({ route, navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { routeId, routeName } = route.params;
  const report = useRouteReport(routeId);
  const dispatches = useDispatches();

  const onRoute = useMemo(
    () => (dispatches.data ?? []).filter((d) => d.route?.id === routeId),
    [dispatches.data, routeId]
  );

  const dispatched = report.data?.dispatched_total ?? 0;
  const collected = report.data?.collected_total ?? 0;
  const netExpected = report.data?.net_expected_total ?? dispatched; // dispatched − returns
  const short = Math.max(0, netExpected - collected);
  const base = netExpected || dispatched;
  const collectedPct = base > 0 ? collected / base : 0;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.marginMobile, paddingBottom: spacing.xl }}
      refreshControl={<RefreshControl refreshing={report.isRefetching} onRefresh={() => { report.refetch(); dispatches.refetch(); }} tintColor={colors.primary} />}
      showsVerticalScrollIndicator={false}
    >
      <ScreenTitleBar title={routeName ?? report.data?.route?.name ?? 'Route'} onBack={() => navigation.goBack()} />

      {report.isLoading ? (
        <Loading label="Loading reconciliation…" />
      ) : report.isError ? (
        <ErrorState message={(report.error as Error)?.message} onRetry={report.refetch} />
      ) : (
        <>
          <Card style={styles.hero}>
            <Text style={styles.heroLabel}>DISPATCHED</Text>
            <Text style={styles.heroValue}>{kes(dispatched)}</Text>
            <View style={{ marginTop: spacing.md }}>
              <View style={styles.progressRow}>
                <Text style={styles.progressLabel}>Collected {kes(collected)}</Text>
                <Text style={styles.progressPct}>{Math.round(collectedPct * 100)}%</Text>
              </View>
              <ProgressBar progress={collectedPct} />
            </View>
          </Card>

          <View style={styles.row}>
            <Card style={styles.half}>
              <Text style={styles.halfLabel}>Collected</Text>
              <Text style={[styles.halfValue, { color: colors.primary }]}>{kes(collected, false)}</Text>
            </Card>
            <Card style={[styles.half, short > 0 ? { backgroundColor: colors.errorContainer } : { backgroundColor: colors.successContainer }]}>
              <Text style={[styles.halfLabel, { color: short > 0 ? colors.error : colors.onSuccessContainer }]}>Short</Text>
              <Text style={[styles.halfValue, { color: short > 0 ? colors.error : colors.onSuccessContainer }]}>{kes(short, false)}</Text>
            </Card>
          </View>

          <Text style={styles.note}>
            Trips: {report.data?.trip_count ?? 0}. Cash vs M-Pesa breakdown lives in the admin portal; the mobile API reports combined collected.
          </Text>

          <Text style={styles.section}>Dispatches on this route (today)</Text>
          {dispatches.isLoading ? (
            <Loading />
          ) : onRoute.length === 0 ? (
            <EmptyState icon="cube-outline" message="No dispatches on this route today." />
          ) : (
            onRoute.map((d) => (
              <DispatchCard key={d.id} order={d} onPress={() => navigation.navigate('DispatchDetail', { id: d.id, orderNumber: d.order_number })} />
            ))
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  hero: { backgroundColor: colors.secondaryFixed },
  heroLabel: { ...type.labelSm, color: colors.onSecondaryFixedVariant },
  heroValue: { ...type.displayLg, color: colors.onSurface, marginTop: spacing.xs },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm },
  progressLabel: { ...type.bodyLg, color: colors.onSurface },
  progressPct: { ...type.titleMd, color: colors.onSurface },
  row: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
  half: { flex: 1 },
  halfLabel: { ...type.bodyLg, color: colors.onSurfaceVariant },
  halfValue: { ...type.metricXl, fontSize: 26, marginTop: spacing.xs },
  note: { ...type.bodySm, color: colors.onSurfaceVariant, marginTop: spacing.md, fontStyle: 'italic' },
  section: { ...type.headlineLgMobile, color: colors.onSurface, marginTop: spacing.xl, marginBottom: spacing.md },
});
