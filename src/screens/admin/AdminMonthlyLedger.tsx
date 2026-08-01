import React from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CompositeScreenProps } from '@react-navigation/native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Card, ScreenTitleBar } from '../../components';
import DispatchCard from '../../components/DispatchCard';
import { Loading, ErrorState, EmptyState } from '../../components/StateView';
import { colors, type, fonts, spacing, radius } from '../../theme';
import { kes, kesShort } from '../../utils/format';
import { useDispatchReport } from '../../api/hooks';
import { startOfMonth, ymd, prettyMonth } from '../../api/dates';
import { AdminTabsParamList, RootStackParamList } from '../../navigation/types';

type Props = CompositeScreenProps<
  BottomTabScreenProps<AdminTabsParamList, 'Collections'>,
  NativeStackScreenProps<RootStackParamList>
>;

function Donut({ pct }: { pct: number }) {
  const size = 60, stroke = 10, r = (size - stroke) / 2, c = 2 * Math.PI * r;
  return (
    <Svg width={size} height={size}>
      <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.surfaceContainerHighest} strokeWidth={stroke} fill="none" />
      <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.primary} strokeWidth={stroke} fill="none"
        strokeDasharray={`${(c * pct) / 100} ${c}`} strokeLinecap="round" transform={`rotate(-90 ${size / 2} ${size / 2})`} />
    </Svg>
  );
}

export default function AdminMonthlyLedger({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const report = useDispatchReport(startOfMonth(), ymd());

  const counts = report.data?.status_counts;
  const trips = report.data?.trip_count ?? 0;
  const completed = counts?.completed ?? 0;
  const completionPct = trips > 0 ? Math.round((completed / trips) * 100) : 0;
  const recent = (report.data?.dispatches ?? []).slice(0, 8);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.marginMobile, paddingBottom: spacing.xl }}
      refreshControl={<RefreshControl refreshing={report.isRefetching} onRefresh={report.refetch} tintColor={colors.primary} />}
      showsVerticalScrollIndicator={false}
    >
      <ScreenTitleBar title="Monthly Ledger" right={<Text style={styles.month}>{prettyMonth()}</Text>} />

      {report.isLoading ? (
        <Loading />
      ) : report.isError ? (
        <ErrorState message={(report.error as Error)?.message} onRetry={report.refetch} />
      ) : (
        <>
          <Card style={styles.revenue}>
            <Text style={styles.revLabel}>Dispatched this month</Text>
            <Text style={styles.revValue}>{kes(report.data?.total_value ?? 0)}</Text>
            <Text style={styles.revSub}>{trips} dispatch orders</Text>
          </Card>

          <View style={styles.row}>
            <Card style={styles.half}>
              <Text style={styles.halfLabel}>COMPLETION</Text>
              <View style={styles.mixRow}>
                <Donut pct={completionPct} />
                <View style={{ marginLeft: spacing.sm }}>
                  <Text style={styles.mixPct}>{completionPct}%</Text>
                  <Text style={styles.mixSub}>{completed} done</Text>
                </View>
              </View>
            </Card>
            <Card style={styles.half}>
              <Text style={styles.halfLabel}>OPEN ORDERS</Text>
              <Text style={styles.openValue}>{(counts?.pending ?? 0) + (counts?.active ?? 0)}</Text>
              <Text style={styles.openSub}>{counts?.cancelled ?? 0} cancelled</Text>
            </Card>
          </View>

          <View style={styles.statusRow}>
            <Chip label="Pending" value={counts?.pending ?? 0} />
            <Chip label="Active" value={counts?.active ?? 0} />
            <Chip label="Completed" value={counts?.completed ?? 0} />
          </View>

          <Text style={styles.section}>Recent Dispatches</Text>
          {recent.length === 0 ? (
            <EmptyState icon="cube-outline" message="No dispatches this month." />
          ) : (
            recent.map((d) => (
              <DispatchCard key={d.id} order={d} onPress={() => navigation.navigate('DispatchDetail', { id: d.id, orderNumber: d.order_number })} />
            ))
          )}
        </>
      )}
    </ScrollView>
  );
}

function Chip({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.chip}>
      <Text style={styles.chipValue}>{kesShort(value)}</Text>
      <Text style={styles.chipLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  month: { ...type.bodyLg, fontFamily: fonts.sansSemibold, color: colors.onSurface },
  revenue: { paddingVertical: spacing.lg },
  revLabel: { ...type.titleMd, color: colors.secondary },
  revValue: { ...type.displayLg, color: colors.primary, marginTop: spacing.sm },
  revSub: { ...type.bodyLg, color: colors.onSurfaceVariant, marginTop: spacing.xs },
  row: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
  half: { flex: 1 },
  halfLabel: { ...type.labelSm, color: colors.onSurfaceVariant },
  mixRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm },
  mixPct: { ...type.titleMd, fontFamily: fonts.sansBold, color: colors.onSurface },
  mixSub: { ...type.labelSm, color: colors.onSurfaceVariant, marginTop: 2 },
  openValue: { ...type.displayLg, fontSize: 40, color: colors.primary, marginTop: spacing.sm },
  openSub: { ...type.labelSm, color: colors.onSurfaceVariant, marginTop: spacing.xs },
  statusRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  chip: { flex: 1, backgroundColor: colors.surfaceContainerHigh, borderRadius: radius.md, padding: spacing.md, alignItems: 'center' },
  chipValue: { ...type.titleMd, fontFamily: fonts.monoSemibold, color: colors.onSurface },
  chipLabel: { ...type.labelSm, color: colors.onSurfaceVariant, marginTop: 2 },
  section: { ...type.headlineLgMobile, color: colors.onSurface, marginTop: spacing.xl, marginBottom: spacing.md },
});
