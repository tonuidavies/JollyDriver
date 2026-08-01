import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { ScreenTitleBar, DispatchCard } from '../../components';
import { Loading, ErrorState, EmptyState } from '../../components/StateView';
import { colors, type, spacing, radius, shadows } from '../../theme';
import { useDispatchRegister } from '../../api/hooks';
import { DispatchStatus } from '../../api/types';
import { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Dispatches'>;

const TABS: { label: string; value?: DispatchStatus }[] = [
  { label: 'All' },
  { label: 'Draft', value: 'draft' },
  { label: 'Active', value: 'active' },
  { label: 'Completed', value: 'completed' },
  { label: 'Cancelled', value: 'cancelled' },
];

export default function DispatchesScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [status, setStatus] = useState<DispatchStatus | undefined>(undefined);
  const { data, isLoading, isError, refetch, isRefetching } = useDispatchRegister(status);

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.marginMobile, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        <ScreenTitleBar title="Dispatch Register" onBack={() => navigation.goBack()} showSync={false} />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
          {TABS.map((t) => {
            const active = status === t.value;
            return (
              <Pressable key={t.label} style={[styles.tab, active && styles.tabActive]} onPress={() => setStatus(t.value)}>
                <Text style={[styles.tabText, active && { color: colors.onSecondaryFixed }]}>{t.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {isLoading ? <Loading /> : isError ? <ErrorState onRetry={refetch} /> : !data || data.length === 0 ? (
          <EmptyState icon="cube-outline" message="No dispatches." />
        ) : (
          data.map((d) => <DispatchCard key={d.id} order={d} onPress={() => navigation.navigate('DispatchDetail', { id: d.id, orderNumber: d.order_number })} />)
        )}
      </ScrollView>

      <Pressable style={styles.fab} onPress={() => navigation.navigate('CreateDispatch')}>
        <Ionicons name="add" size={26} color={colors.onPrimary} />
        <Text style={styles.fabText}>New</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: { gap: spacing.sm, paddingBottom: spacing.md },
  tab: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.full, backgroundColor: colors.surfaceContainerHigh },
  tabActive: { backgroundColor: colors.primaryContainer },
  tabText: { ...type.bodySm, fontFamily: type.titleMd.fontFamily, color: colors.onSurfaceVariant },
  fab: { position: 'absolute', right: spacing.lg, bottom: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.lg, height: 56, borderRadius: 28, backgroundColor: colors.primary, ...shadows.level2, justifyContent: 'center' },
  fabText: { ...type.titleMd, color: colors.onPrimary },
});
