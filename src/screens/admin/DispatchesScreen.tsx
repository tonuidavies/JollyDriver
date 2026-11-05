import React, { useDeferredValue, useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, RefreshControl, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { ScreenTitleBar, DispatchCard } from '../../components';
import { Loading, ErrorState, EmptyState } from '../../components/StateView';
import { colors, type, fonts, spacing, radius, shadows } from '../../theme';
import { useDispatchRegister } from '../../api/hooks';
import { DispatchStatus } from '../../api/types';
import { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Dispatches'>;

// same buckets, same words as the web register's counters
const TABS: { label: string; value?: DispatchStatus }[] = [
  { label: 'All' },
  { label: 'Drafts', value: 'draft' },
  { label: 'Pending', value: 'pending' },
  { label: 'Active', value: 'active' },
  { label: 'Finished', value: 'completed' },
  { label: 'Cancelled', value: 'cancelled' },
];

export default function DispatchesScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [status, setStatus] = useState<DispatchStatus | undefined>(undefined);
  const [q, setQ] = useState('');
  // typing stays snappy while the list catches up
  const term = useDeferredValue(q.trim().toLowerCase());
  // one list, filtered here, so every tab can show its count like the web
  const { data, isLoading, isError, refetch, isRefetching } = useDispatchRegister(undefined, 200);

  const all = data ?? [];
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const d of all) c[d.status] = (c[d.status] ?? 0) + 1;
    return c;
  }, [all]);
  const shown = useMemo(() => {
    return all
      .filter((d) => !status || d.status === status)
      .filter((d) =>
        !term ||
        [d.order_number, d.route?.name, d.customer?.name, d.vehicle?.registration_number, d.driver?.name, d.agent?.name]
          .some((v) => String(v ?? '').toLowerCase().includes(term))
      );
  }, [all, status, term]);

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.marginMobile, paddingBottom: 140 }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <ScreenTitleBar title="Dispatch Register" onBack={() => navigation.goBack()} showSync={false} />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
          {TABS.map((t) => {
            const active = status === t.value;
            const n = t.value ? counts[t.value] ?? 0 : all.length;
            return (
              <Pressable key={t.label} style={[styles.tab, active && styles.tabActive]} onPress={() => setStatus(t.value)}>
                <Text style={[styles.tabText, active && { color: colors.onSecondaryFixed }]}>{t.label}</Text>
                <View style={[styles.count, active && styles.countActive]}>
                  <Text style={[styles.countText, active && { color: colors.onPrimary }]}>{n}</Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.search}>
          <Ionicons name="search" size={18} color={colors.onSurfaceVariant} />
          <TextInput style={styles.searchInput} value={q} onChangeText={setQ} placeholder="DSP no., route, vehicle, driver…" placeholderTextColor={colors.outline} />
          {!!q && <Pressable hitSlop={8} onPress={() => setQ('')}><Ionicons name="close-circle" size={18} color={colors.outline} /></Pressable>}
        </View>

        {isLoading ? <Loading /> : isError ? <ErrorState onRetry={refetch} /> : shown.length === 0 ? (
          <EmptyState icon="cube-outline" message={q ? 'Nothing matches that search.' : 'No dispatches here.'} />
        ) : (
          shown.map((d) => <DispatchCard key={d.id} order={d} onPress={() => navigation.navigate('DispatchDetail', { id: d.id, orderNumber: d.order_number })} />)
        )}
      </ScrollView>

      <View style={styles.fabStack}>
        <Pressable style={styles.fabSecondary} onPress={() => navigation.navigate('SchoolDispatch')}>
          <Ionicons name="school-outline" size={22} color={colors.onSecondaryFixed} />
          <Text style={styles.fabSecondaryText}>School</Text>
        </Pressable>
        <Pressable style={styles.fab} onPress={() => navigation.navigate('CreateDispatch')}>
          <Ionicons name="add" size={26} color={colors.onPrimary} />
          <Text style={styles.fabText}>New</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: { gap: spacing.sm, paddingBottom: spacing.md },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: spacing.md, paddingRight: 6, paddingVertical: 6, borderRadius: radius.full, backgroundColor: colors.surfaceContainerHigh },
  tabActive: { backgroundColor: colors.primaryContainer },
  tabText: { ...type.bodySm, fontFamily: type.titleMd.fontFamily, color: colors.onSurfaceVariant },
  count: { minWidth: 24, height: 22, borderRadius: 11, paddingHorizontal: 6, backgroundColor: colors.surfaceContainerLowest, alignItems: 'center', justifyContent: 'center' },
  countActive: { backgroundColor: colors.primary },
  countText: { ...type.labelSm, fontFamily: fonts.monoSemibold, color: colors.onSurface },
  search: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surfaceContainerLowest, borderRadius: radius.full, borderWidth: 1, borderColor: colors.outlineVariant, paddingHorizontal: spacing.md, height: 46, marginBottom: spacing.md },
  searchInput: { flex: 1, ...type.bodyLg, color: colors.onSurface, paddingVertical: 0 },
  fabStack: { position: 'absolute', right: spacing.lg, bottom: spacing.lg, alignItems: 'flex-end', gap: spacing.sm },
  fab: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.lg, height: 56, borderRadius: 28, backgroundColor: colors.primary, ...shadows.level2, justifyContent: 'center' },
  fabText: { ...type.titleMd, color: colors.onPrimary },
  fabSecondary: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.md, height: 46, borderRadius: 23, backgroundColor: colors.primaryContainer, ...shadows.level1, justifyContent: 'center' },
  fabSecondaryText: { ...type.bodySm, color: colors.onSecondaryFixed },
});
