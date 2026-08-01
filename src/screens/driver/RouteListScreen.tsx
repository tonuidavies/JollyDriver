import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CompositeScreenProps } from '@react-navigation/native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import DispatchCard from '../../components/DispatchCard';
import { ScreenTitleBar } from '../../components';
import { Loading, ErrorState, EmptyState } from '../../components/StateView';
import { colors, type, spacing, radius } from '../../theme';
import { useMyDispatches } from '../../api/hooks';
import { DispatchStatus } from '../../api/types';
import { DriverTabsParamList, RootStackParamList } from '../../navigation/types';

type Props = CompositeScreenProps<
  BottomTabScreenProps<DriverTabsParamList, 'Route'>,
  NativeStackScreenProps<RootStackParamList>
>;

const FILTERS: { label: string; value?: DispatchStatus }[] = [
  { label: 'All' },
  { label: 'Pending', value: 'pending' },
  { label: 'Active', value: 'active' },
  { label: 'Done', value: 'completed' },
];

export default function RouteListScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<DispatchStatus | undefined>(undefined);
  const { data, isLoading, isError, error, refetch, isRefetching } = useMyDispatches(undefined, filter);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.marginMobile, paddingBottom: spacing.xl }}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
      showsVerticalScrollIndicator={false}
    >
      <ScreenTitleBar title="My Dispatches" />

      <View style={styles.filters}>
        {FILTERS.map((f) => {
          const active = filter === f.value;
          return (
            <Pressable key={f.label} style={[styles.chip, active && styles.chipActive]} onPress={() => setFilter(f.value)}>
              <Text style={[styles.chipText, active && { color: colors.onSecondaryFixed }]}>{f.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {isLoading ? (
        <Loading />
      ) : isError ? (
        <ErrorState message={(error as Error)?.message} onRetry={refetch} />
      ) : !data || data.length === 0 ? (
        <EmptyState icon="cube-outline" message="No dispatches here." />
      ) : (
        data.map((d) => (
          <DispatchCard key={d.id} order={d} onPress={() => navigation.navigate('DispatchDetail', { id: d.id, orderNumber: d.order_number })} />
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  filters: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.full, backgroundColor: colors.surfaceContainerHigh },
  chipActive: { backgroundColor: colors.primaryContainer },
  chipText: { ...type.bodySm, fontFamily: type.titleMd.fontFamily, color: colors.onSurfaceVariant },
});
