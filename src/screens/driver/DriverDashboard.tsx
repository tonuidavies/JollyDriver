import React, { useMemo } from 'react';
import { View, Text, StyleSheet, RefreshControl, ScrollView } from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { CompositeScreenProps } from '@react-navigation/native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card, ProgressBar, GreetingHeader, PrimaryButton } from '../../components';
import { Loading, ErrorState, EmptyState } from '../../components/StateView';
import { colors, type, fonts, spacing, radius } from '../../theme';
import { kes } from '../../utils/format';
import { useMyDispatches, useRouteReport } from '../../api/hooks';
import { useAuth } from '../../context/AuthContext';
import { DriverTabsParamList, RootStackParamList } from '../../navigation/types';

type Props = CompositeScreenProps<
  BottomTabScreenProps<DriverTabsParamList, 'Home'>,
  NativeStackScreenProps<RootStackParamList>
>;

export default function DriverDashboard({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { data: dispatches, isLoading, isError, error, refetch, isRefetching } = useMyDispatches();

  const primaryRoute = dispatches?.find((d) => d.route)?.route ?? null;
  const report = useRouteReport(primaryRoute?.id);

  const stats = useMemo(() => {
    const list = dispatches ?? [];
    const total = list.length;
    const completed = list.filter((d) => d.status === 'completed').length;
    const dispatched = list.reduce((s, d) => s + (d.total_amount || 0), 0);
    return { total, completed, remaining: total - completed, dispatched };
  }, [dispatches]);

  const collected = report.data?.collected_total ?? 0;
  const dispatchedTotal = report.data?.dispatched_total ?? stats.dispatched;
  const short = dispatchedTotal - collected;
  const progress = stats.total ? stats.completed / stats.total : 0;

  const firstPending = dispatches?.find((d) => d.status === 'pending' || d.status === 'active');

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.marginMobile, paddingBottom: spacing.xl }}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
      showsVerticalScrollIndicator={false}
    >
      <GreetingHeader name={user?.first_name ?? 'Driver'} initials={(user?.first_name?.[0] ?? 'D') + (user?.last_name?.[0] ?? '')} showSynced />

      {isLoading ? (
        <Loading label="Loading your dispatches…" />
      ) : isError ? (
        <ErrorState message={(error as Error)?.message} onRetry={refetch} />
      ) : (
        <>
          <View style={styles.hero}>
            <Text style={styles.heroLabel}>CURRENT ASSIGNMENT</Text>
            <Text style={styles.heroTitle}>Today's Route: {primaryRoute?.name ?? '—'}</Text>
            <MaterialCommunityIcons name="map-marker-path" size={110} color="rgba(133,83,0,0.10)" style={styles.heroGlyph} />
            <View style={{ marginTop: spacing.md }}>
              <View style={styles.progressRow}>
                <Text style={styles.progressLabel}>Delivery Progress</Text>
                <Text style={styles.progressPct}>{Math.round(progress * 100)}%</Text>
              </View>
              <ProgressBar progress={progress} />
            </View>
          </View>

          {stats.total === 0 ? (
            <EmptyState icon="cube-outline" message="No dispatches assigned to you today." />
          ) : (
            <>
              <View style={styles.statRow}>
                <StatTile icon="cube-outline" label="Assigned" value={String(stats.total)} />
                <StatTile icon="checkmark-circle-outline" iconColor={colors.success} label="Completed" value={String(stats.completed)} />
              </View>

              <Card style={styles.remaining}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.tileLabel}>Remaining Drops</Text>
                  <Text style={styles.tileValue}>{stats.remaining}</Text>
                </View>
                <View style={styles.truckCircle}>
                  <MaterialCommunityIcons name="truck-fast-outline" size={30} color={colors.primary} />
                </View>
              </Card>

              <Text style={styles.section}>Route Reconciliation</Text>
              {report.isLoading ? (
                <Card><Text style={styles.tileLabel}>Loading route totals…</Text></Card>
              ) : (
                <>
                  <Card accent={colors.primaryContainer} style={styles.finRow}>
                    <View style={styles.finIcon}>
                      <MaterialCommunityIcons name="cash-multiple" size={24} color={colors.primary} />
                    </View>
                    <Text style={styles.finLabel}>Collected</Text>
                    <Text style={[styles.finAmount, { color: colors.primary }]}>{kes(collected)}</Text>
                  </Card>
                  <View style={styles.diffRow}>
                    <View style={styles.expected}>
                      <Text style={styles.diffLabel}>Dispatched</Text>
                      <Text style={styles.diffMono}>{kes(dispatchedTotal)}</Text>
                    </View>
                    <View style={[styles.difference, short <= 0 && { backgroundColor: colors.successContainer }]}>
                      <Text style={[styles.diffLabel, { color: short > 0 ? colors.error : colors.onSuccessContainer }]}>Short</Text>
                      <Text style={[styles.diffMono, { color: short > 0 ? colors.error : colors.onSuccessContainer }]}>{kes(short)}</Text>
                    </View>
                  </View>
                  <Text style={styles.note}>Cash vs M-Pesa split is available in the admin portal.</Text>
                </>
              )}

              <PrimaryButton
                label={firstPending ? 'Continue Route' : 'View Dispatches'}
                variant="dark"
                icon="arrow-forward"
                style={{ marginTop: spacing.lg, borderRadius: radius.full }}
                onPress={() =>
                  firstPending
                    ? navigation.navigate('DispatchDetail', { id: firstPending.id, orderNumber: firstPending.order_number })
                    : navigation.navigate('Route')
                }
              />
            </>
          )}
        </>
      )}
    </ScrollView>
  );
}

function StatTile({ icon, label, value, iconColor = colors.onSurface }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string; iconColor?: string }) {
  return (
    <Card style={styles.tile}>
      <Ionicons name={icon} size={26} color={iconColor} />
      <Text style={styles.tileLabel}>{label}</Text>
      <Text style={styles.tileValue}>{value}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  hero: { backgroundColor: colors.secondaryFixed, borderRadius: radius.card, padding: spacing.lg, overflow: 'hidden', marginTop: spacing.xs },
  heroLabel: { ...type.labelSm, color: colors.onSecondaryFixedVariant },
  heroTitle: { ...type.displayLg, fontSize: 34, lineHeight: 40, color: colors.onSurface, marginTop: spacing.sm },
  heroGlyph: { position: 'absolute', right: spacing.md, top: spacing.lg },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm },
  progressLabel: { ...type.bodyLg, color: colors.onSurface },
  progressPct: { ...type.titleMd, color: colors.onSurface },

  statRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
  tile: { flex: 1, minHeight: 120, justifyContent: 'space-between' },
  tileLabel: { ...type.bodyLg, color: colors.onSurfaceVariant, marginTop: spacing.md },
  tileValue: { ...type.displayLg, color: colors.onSurface, marginTop: spacing.xs },

  remaining: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.md },
  truckCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.primaryFixed, alignItems: 'center', justifyContent: 'center' },

  section: { ...type.headlineLgMobile, color: colors.onSurface, marginTop: spacing.xl, marginBottom: spacing.md },
  finRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md, paddingVertical: spacing.md },
  finIcon: { width: 48, height: 48, borderRadius: radius.md, backgroundColor: colors.primaryFixed, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md },
  finLabel: { ...type.titleMd, fontSize: 17, color: colors.onSurface, flex: 1 },
  finAmount: { ...type.labelSm, fontSize: 15, fontFamily: fonts.monoSemibold },
  diffRow: { flexDirection: 'row', gap: spacing.md },
  expected: { flex: 1, backgroundColor: colors.surfaceContainerHigh, borderRadius: radius.md, padding: spacing.md },
  difference: { flex: 1, backgroundColor: colors.errorContainer, borderRadius: radius.md, padding: spacing.md },
  diffLabel: { ...type.bodyLg, color: colors.onSurfaceVariant, marginBottom: spacing.xs },
  diffMono: { ...type.labelSm, fontSize: 15, fontFamily: fonts.monoMedium, color: colors.onSurface },
  note: { ...type.bodySm, color: colors.onSurfaceVariant, marginTop: spacing.sm, fontStyle: 'italic' },
});
