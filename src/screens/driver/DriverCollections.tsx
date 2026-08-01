import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CompositeScreenProps } from '@react-navigation/native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import DispatchCard from '../../components/DispatchCard';
import { Card, ScreenTitleBar } from '../../components';
import { Loading, ErrorState, EmptyState } from '../../components/StateView';
import { colors, type, spacing } from '../../theme';
import { kes } from '../../utils/format';
import { useMyDispatches, useRouteReport } from '../../api/hooks';
import { DriverTabsParamList, RootStackParamList } from '../../navigation/types';

type Props = CompositeScreenProps<
  BottomTabScreenProps<DriverTabsParamList, 'Collections'>,
  NativeStackScreenProps<RootStackParamList>
>;

export default function DriverCollections({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { data, isLoading, isError, error, refetch, isRefetching } = useMyDispatches();

  const primaryRoute = data?.find((d) => d.route)?.route ?? null;
  const report = useRouteReport(primaryRoute?.id);

  const collectible = useMemo(
    () => (data ?? []).filter((d) => d.status === 'active' || d.status === 'pending'),
    [data]
  );

  const collected = report.data?.collected_total ?? 0;
  const dispatched = report.data?.dispatched_total ?? 0;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.marginMobile, paddingBottom: spacing.xl }}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
      showsVerticalScrollIndicator={false}
    >
      <ScreenTitleBar title="Collections" showSync={false} />

      <Card style={styles.total}>
        <Text style={styles.totalLabel}>COLLECTED TODAY {primaryRoute ? `• ${primaryRoute.name}` : ''}</Text>
        <Text style={styles.totalValue}>{kes(collected)}</Text>
        <View style={styles.splitRow}>
          <View style={styles.splitItem}>
            <MaterialCommunityIcons name="cube-outline" size={16} color={colors.onSecondaryFixed} />
            <Text style={styles.splitText}>Dispatched {kes(dispatched, false)}</Text>
          </View>
          <View style={styles.splitItem}>
            <MaterialCommunityIcons name="alert-circle-outline" size={16} color={colors.onSecondaryFixed} />
            <Text style={styles.splitText}>Short {kes(dispatched - collected, false)}</Text>
          </View>
        </View>
      </Card>

      <Text style={styles.section}>Awaiting Collection</Text>
      {isLoading ? (
        <Loading />
      ) : isError ? (
        <ErrorState message={(error as Error)?.message} onRetry={refetch} />
      ) : collectible.length === 0 ? (
        <EmptyState icon="checkmark-done-outline" message="All collections up to date." />
      ) : (
        collectible.map((d) => (
          <DispatchCard key={d.id} order={d} onPress={() => navigation.navigate('DispatchDetail', { id: d.id, orderNumber: d.order_number })} />
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  total: { backgroundColor: colors.primaryContainer },
  totalLabel: { ...type.labelSm, color: colors.onPrimaryContainer },
  totalValue: { ...type.metricXl, color: colors.onSecondaryFixed, marginTop: spacing.xs },
  splitRow: { flexDirection: 'row', gap: spacing.lg, marginTop: spacing.md, flexWrap: 'wrap' },
  splitItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  splitText: { ...type.bodySm, color: colors.onSecondaryFixed },
  section: { ...type.headlineLgMobile, color: colors.onSurface, marginTop: spacing.xl, marginBottom: spacing.md },
});
