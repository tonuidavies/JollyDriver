import React, { useMemo } from 'react';
import { View, Text, StyleSheet, RefreshControl, ScrollView, Pressable } from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { CompositeScreenProps } from '@react-navigation/native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card, GreetingHeader, PrimaryButton } from '../../components';
import { Loading, ErrorState, EmptyState } from '../../components/StateView';
import { colors, type, fonts, spacing, radius } from '../../theme';
import { kes } from '../../utils/format';
import { useMyDispatches, useRouteReport } from '../../api/hooks';
import { useAuth } from '../../context/AuthContext';
import { DispatchOrder, DispatchStatus } from '../../api/types';
import { DriverTabsParamList, RootStackParamList } from '../../navigation/types';

type Props = CompositeScreenProps<
  BottomTabScreenProps<DriverTabsParamList, 'Home'>,
  NativeStackScreenProps<RootStackParamList>
>;

/** Every status said the way a driver would say it, with its colour and icon. */
const STATUS: Record<DispatchStatus, { say: string; color: string; bg: string; icon: any }> = {
  draft: { say: 'Being prepared', color: colors.onNeutralContainer, bg: colors.neutralContainer, icon: 'clipboard-text-clock-outline' },
  pending: { say: 'Ready — tap to start', color: colors.onWarningContainer, bg: colors.warningContainer, icon: 'truck-check-outline' },
  active: { say: 'On the road', color: colors.onPrimaryFixedVariant, bg: colors.primaryFixed, icon: 'truck-fast-outline' },
  completed: { say: 'Done', color: colors.onSuccessContainer, bg: colors.successContainer, icon: 'check-decagram' },
  cancelled: { say: 'Cancelled', color: colors.onErrorContainer, bg: colors.errorContainer, icon: 'close-octagon-outline' },
};

export default function DriverDashboard({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { data: dispatches, isLoading, isError, error, refetch, isRefetching } = useMyDispatches();

  const primaryRoute = dispatches?.find((d) => d.route)?.route ?? null;
  const report = useRouteReport(primaryRoute?.id);

  const stats = useMemo(() => {
    const list = dispatches ?? [];
    const done = list.filter((d) => d.status === 'completed').length;
    const expected = list.reduce((s, d) => s + Number(d.net_expected ?? d.total_amount ?? 0), 0);
    return { total: list.length, done, expected };
  }, [dispatches]);

  const collected = report.data?.collected_total ?? 0;
  const expected = report.data?.net_expected_total ?? stats.expected;
  const toCollect = Math.max(0, expected - collected);
  const pct = expected > 0 ? Math.min(1, collected / expected) : 0;

  // the one thing to do next: an open trip first, then one waiting to start
  const next =
    dispatches?.find((d) => d.status === 'active') ?? dispatches?.find((d) => d.status === 'pending') ?? null;

  const open = (d: DispatchOrder) => navigation.navigate('DispatchDetail', { id: d.id, orderNumber: d.order_number });

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.marginMobile, paddingBottom: spacing.xl }}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
      showsVerticalScrollIndicator={false}
    >
      <GreetingHeader name={user?.first_name ?? 'Driver'} initials={(user?.first_name?.[0] ?? 'D') + (user?.last_name?.[0] ?? '')} showSynced />

      {isLoading ? (
        <Loading label="Loading your trips…" />
      ) : isError ? (
        <ErrorState message={(error as Error)?.message} onRetry={refetch} />
      ) : stats.total === 0 ? (
        <EmptyState icon="cube-outline" message="No trips for you today. Pull down to check again." />
      ) : (
        <>
          {/* NEXT STEP — the biggest thing on the screen */}
          {next ? (
            <Pressable onPress={() => open(next)} style={({ pressed }) => [styles.next, pressed && { transform: [{ scale: 0.98 }] }]}>
              <Text style={styles.nextKicker}>{next.status === 'active' ? 'CARRY ON' : 'START HERE'}</Text>
              <Text style={styles.nextTitle} numberOfLines={2}>{next.route?.name ?? next.order_number}</Text>
              <View style={styles.nextMeta}>
                <MaterialCommunityIcons name="truck-outline" size={16} color={colors.inverseOnSurface} />
                <Text style={styles.nextMetaText}>{next.vehicle?.registration_number ?? '—'} · {next.order_number}</Text>
              </View>
              <View style={styles.nextCta}>
                <Text style={styles.nextCtaText}>{next.status === 'active' ? 'Sell · Get paid · Returns' : 'Open & start route'}</Text>
                <Ionicons name="arrow-forward-circle" size={30} color={colors.onSecondaryFixed} />
              </View>
              <MaterialCommunityIcons name="bread-slice" size={120} color="rgba(255,185,95,0.10)" style={styles.nextGlyph} />
            </Pressable>
          ) : (
            <View style={[styles.next, { backgroundColor: colors.success }]}>
              <Text style={styles.nextKicker}>ALL DONE</Text>
              <Text style={styles.nextTitle}>Every trip is closed. Well done!</Text>
            </View>
          )}

          {/* MONEY — what's in, what's left, as a filling jar */}
          <Card style={styles.money}>
            <View style={{ flex: 1 }}>
              <Text style={styles.moneyKicker}>MONEY IN TODAY</Text>
              <Text style={styles.moneyIn}>{kes(collected)}</Text>
              <Text style={[styles.moneyLeft, toCollect <= 0 && { color: colors.success }]}>
                {report.isLoading ? 'Checking…' : toCollect > 0 ? `${kes(toCollect)} still to collect` : 'Nothing left to collect ✓'}
              </Text>
            </View>
            <View style={styles.jar}>
              <View style={[styles.jarFill, { height: `${Math.round(pct * 100)}%`, backgroundColor: toCollect <= 0 ? colors.success : colors.primaryContainer }]} />
              <Text style={styles.jarPct}>{Math.round(pct * 100)}%</Text>
            </View>
          </Card>

          {/* TRIPS */}
          <View style={styles.tripsHead}>
            <Text style={styles.section}>Your trips</Text>
            <Text style={styles.count}>{stats.done} of {stats.total} done</Text>
          </View>
          {(dispatches ?? []).map((d) => {
            const s = STATUS[d.status] ?? STATUS.draft;
            return (
              <Pressable key={d.id} onPress={() => open(d)}>
                <Card style={[styles.trip, { borderLeftColor: s.color }]}>
                  <View style={[styles.tripIcon, { backgroundColor: s.bg }]}>
                    <MaterialCommunityIcons name={s.icon} size={24} color={s.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.tripRoute} numberOfLines={1}>{d.route?.name ?? 'School delivery'}</Text>
                    <Text style={[styles.tripSay, { color: s.color }]}>{s.say}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.tripAmt}>{kes(d.total_amount)}</Text>
                    <Text style={styles.tripNo}>{d.order_number}</Text>
                  </View>
                </Card>
              </Pressable>
            );
          })}

          <PrimaryButton
            label="My Commission"
            variant="secondary"
            icon="pricetags-outline"
            iconRight={false}
            style={{ marginTop: spacing.lg, borderRadius: radius.full }}
            onPress={() => navigation.navigate('Commissions')}
          />
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  next: { backgroundColor: colors.inverseSurface, borderRadius: radius.xl, padding: spacing.lg, marginTop: spacing.sm, overflow: 'hidden' },
  nextKicker: { ...type.labelSm, letterSpacing: 2, color: colors.inversePrimary, fontFamily: fonts.sansExtrabold },
  nextTitle: { ...type.headlineLg, color: colors.inverseOnSurface, marginTop: spacing.xs },
  nextMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.xs },
  nextMetaText: { ...type.bodySm, fontFamily: fonts.monoMedium, color: colors.inverseOnSurface, opacity: 0.8 },
  nextCta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.primaryContainer, borderRadius: radius.full, paddingLeft: spacing.lg, paddingRight: 8, height: 56, marginTop: spacing.lg },
  nextCtaText: { ...type.titleMd, fontFamily: fonts.sansBold, color: colors.onSecondaryFixed },
  nextGlyph: { position: 'absolute', right: -10, top: -10 },

  money: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.md, gap: spacing.md },
  moneyKicker: { ...type.labelSm, letterSpacing: 1.5, color: colors.onSurfaceVariant, fontFamily: fonts.sansBold },
  moneyIn: { ...type.metricXl, fontSize: 32, lineHeight: 40, color: colors.onSurface, marginTop: 4 },
  moneyLeft: { ...type.bodySm, fontFamily: fonts.sansSemibold, color: colors.onWarningContainer, marginTop: 2 },
  jar: { width: 64, height: 84, borderRadius: 14, borderWidth: 3, borderColor: colors.outlineVariant, overflow: 'hidden', justifyContent: 'flex-end', alignItems: 'center' },
  jarFill: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  jarPct: { ...type.labelSm, fontFamily: fonts.monoSemibold, color: colors.onSurface, marginBottom: 6 },

  tripsHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: spacing.xl, marginBottom: spacing.md },
  section: { ...type.headlineLgMobile, color: colors.onSurface },
  count: { ...type.bodySm, fontFamily: fonts.sansSemibold, color: colors.onSurfaceVariant },
  trip: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm, borderLeftWidth: 6 },
  tripIcon: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  tripRoute: { ...type.titleMd, fontFamily: fonts.sansBold, color: colors.onSurface },
  tripSay: { ...type.bodySm, fontFamily: fonts.sansSemibold, marginTop: 2 },
  tripAmt: { ...type.labelSm, fontSize: 14, fontFamily: fonts.monoSemibold, color: colors.onSurface },
  tripNo: { ...type.labelSm, fontSize: 11, color: colors.outline, marginTop: 2 },
});
