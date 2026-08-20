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
import { useRouteReport, useDispatches, useRoutePayments } from '../../api/hooks';
import { DispatchPayment } from '../../api/types';
import { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'RouteRecon'>;
const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);

export default function RouteRecon({ route, navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { routeId, routeName } = route.params;
  const report = useRouteReport(routeId);
  const dispatches = useDispatches();
  const payments = useRoutePayments(routeId);

  const onRoute = useMemo(
    () => (dispatches.data ?? []).filter((d) => d.route?.id === routeId),
    [dispatches.data, routeId]
  );

  /** Route ledger: manual field collections + automated KCB/M-Pesa IPNs. */
  const ledger: DispatchPayment[] = useMemo(() => {
    const raw = (payments.data ?? []) as any;
    return Array.isArray(raw) ? raw : raw?.data ?? [];
  }, [payments.data]);

  const live = useMemo(() => ledger.filter((p) => !p.voided_on), [ledger]);
  const ledgerTotal = useMemo(() => live.reduce((s, p) => s + num(p.amount), 0), [live]);
  const cashTotal = useMemo(
    () => live.filter((p) => String(p.collection_method).toLowerCase() === 'cash').reduce((s, p) => s + num(p.amount), 0),
    [live]
  );
  const mpesaTotal = ledgerTotal - cashTotal;

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
            Trips: {report.data?.trip_count ?? 0}. Cash {kes(cashTotal, false)} · M-Pesa {kes(mpesaTotal, false)} from the
            payments below.
          </Text>

          <View style={styles.sectionHead}>
            <Text style={styles.section}>Payments (last 30 days)</Text>
            <Text style={styles.ledgerTotal}>{kes(ledgerTotal)}</Text>
          </View>
          {payments.isLoading ? (
            <Loading />
          ) : payments.isError ? (
            <Text style={styles.note}>Payment ledger unavailable.</Text>
          ) : ledger.length === 0 ? (
            <EmptyState icon="card-outline" message="No payments on this route yet." />
          ) : (
            <>
              {ledger.slice(0, 25).map((p, i) => {
                const voided = !!p.voided_on;
                const method = String(p.collection_method ?? '').toLowerCase();
                const auto = String(p.source ?? '').toLowerCase() === 'automatic';
                return (
                  <Card key={`${p.id}-${i}`} style={styles.payRow}>
                    <View style={[styles.payIcon, voided && { backgroundColor: colors.errorContainer }]}>
                      <Ionicons
                        name={voided ? 'close' : method === 'cash' ? 'cash-outline' : 'phone-portrait-outline'}
                        size={16}
                        color={voided ? colors.error : method === 'cash' ? colors.primary : colors.tertiary}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.payName, voided && styles.voided]} numberOfLines={1}>
                        {p.customer_name || p.customer_msisdn || (method === 'cash' ? 'Cash collection' : 'M-Pesa')}
                      </Text>
                      <Text style={styles.payMeta} numberOfLines={1}>
                        {[p.mpesa_receipt_number || p.transaction_id, auto ? 'auto' : 'manual', p.created_on]
                          .filter(Boolean)
                          .join('  ·  ')}
                      </Text>
                    </View>
                    <Text style={[styles.payAmt, voided && styles.voided]}>{kes(num(p.amount), false)}</Text>
                  </Card>
                );
              })}
              {ledger.length > 25 && (
                <Text style={styles.note}>Showing the 25 most recent of {ledger.length} payments.</Text>
              )}
            </>
          )}

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
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  ledgerTotal: { ...type.titleMd, color: colors.primary },
  payRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  payIcon: { width: 32, height: 32, borderRadius: radius.md, backgroundColor: colors.surfaceContainerHigh, alignItems: 'center', justifyContent: 'center' },
  payName: { ...type.bodyLg, color: colors.onSurface },
  payMeta: { ...type.labelSm, fontSize: 10, color: colors.outline, marginTop: 2 },
  payAmt: { ...type.titleMd, color: colors.onSurface },
  voided: { textDecorationLine: 'line-through', color: colors.onSurfaceVariant },
});
