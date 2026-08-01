import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, RefreshControl, TextInput, Alert } from 'react-native';
import { MaterialCommunityIcons, Ionicons, Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Card, ScreenTitleBar, StatusBadge, Select, FormModal, Field } from '../../components';
import { Loading, ErrorState, EmptyState } from '../../components/StateView';
import { colors, type, fonts, spacing, radius, shadows } from '../../theme';
import { useVehicles, useCreateVehicle, useUpdateVehicle, useDeleteVehicle } from '../../api/hooks';
import { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Vehicles'>;
const STATUS = [
  { label: 'Active', value: 'active' },
  { label: 'Maintenance', value: 'maintenance' },
  { label: 'Retired', value: 'retired' },
];
type Draft = { id?: number; registration_number: string; make: string; model: string; capacity_kg: string; status: string };
const EMPTY: Draft = { registration_number: '', make: '', model: '', capacity_kg: '', status: 'active' };
const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);

export default function VehiclesScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { data, isLoading, isError, refetch, isRefetching } = useVehicles();
  const create = useCreateVehicle();
  const update = useUpdateVehicle();
  const del = useDeleteVehicle();

  const [q, setQ] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);

  const list = (data ?? []).filter((v: any) =>
    `${v.registration_number} ${v.make} ${v.model}`.toLowerCase().includes(q.toLowerCase())
  );

  const save = () => {
    if (!draft) return;
    if (!draft.registration_number.trim()) return Alert.alert('Registration required');
    const body = {
      registration_number: draft.registration_number.trim(),
      make: draft.make.trim(),
      model: draft.model.trim(),
      capacity_kg: num(draft.capacity_kg),
      status: draft.status as any,
    };
    const onDone = () => { setDraft(null); refetch(); };
    if (draft.id) update.mutate({ id: draft.id, ...body }, { onSuccess: onDone, onError: (e) => Alert.alert('Failed', (e as Error).message) });
    else create.mutate(body, { onSuccess: onDone, onError: (e) => Alert.alert('Failed', (e as Error).message) });
  };

  const remove = (v: any) =>
    Alert.alert('Delete vehicle', `Remove ${v.registration_number}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => del.mutate(num(v.id), { onSuccess: () => refetch() }) },
    ]);

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.marginMobile, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        <ScreenTitleBar title="Vehicles" onBack={() => navigation.goBack()} showSync={false} />
        <View style={styles.search}>
          <Ionicons name="search" size={20} color={colors.outline} />
          <TextInput style={styles.searchInput} placeholder="Search registration, make…" placeholderTextColor={colors.outline} value={q} onChangeText={setQ} />
        </View>

        {isLoading ? <Loading /> : isError ? <ErrorState onRetry={refetch} /> : list.length === 0 ? (
          <EmptyState icon="car-outline" message="No vehicles." />
        ) : (
          list.map((v: any) => (
            <Card key={v.id} style={styles.row}>
              <View style={styles.badge}><Text style={styles.badgeText}>{String(v.registration_number).slice(0, 2).toUpperCase()}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{v.registration_number}</Text>
                <Text style={styles.sub}>{[v.make, v.model].filter(Boolean).join(' ') || '—'} · {num(v.capacity_kg)} kg</Text>
              </View>
              <StatusBadge label={String(v.status || '').toUpperCase()} tone={v.status === 'active' ? 'success' : v.status === 'retired' ? 'error' : 'pending'} />
              <Pressable hitSlop={8} onPress={() => setDraft({ id: num(v.id), registration_number: v.registration_number ?? '', make: v.make ?? '', model: v.model ?? '', capacity_kg: String(num(v.capacity_kg)), status: v.status ?? 'active' })} style={styles.iconBtn}>
                <Feather name="edit-2" size={18} color={colors.secondary} />
              </Pressable>
              <Pressable hitSlop={8} onPress={() => remove(v)} style={styles.iconBtn}><Feather name="trash-2" size={18} color={colors.error} /></Pressable>
            </Card>
          ))
        )}
      </ScrollView>

      <Pressable style={styles.fab} onPress={() => setDraft({ ...EMPTY })}>
        <Ionicons name="add" size={30} color={colors.onPrimary} />
      </Pressable>

      <FormModal
        visible={!!draft}
        title={draft?.id ? 'Edit Vehicle' : 'New Vehicle'}
        onClose={() => setDraft(null)}
        onSubmit={save}
        submitLabel={draft?.id ? 'Update Vehicle' : 'Create Vehicle'}
        busy={create.isPending || update.isPending}
      >
        {draft && (
          <>
            <Field label="Registration Number" value={draft.registration_number} onChangeText={(t) => setDraft({ ...draft, registration_number: t })} placeholder="KCA 123A" autoCapitalize="characters" />
            <Field label="Make" value={draft.make} onChangeText={(t) => setDraft({ ...draft, make: t })} placeholder="Isuzu" />
            <Field label="Model" value={draft.model} onChangeText={(t) => setDraft({ ...draft, model: t })} placeholder="Truck" />
            <Field label="Capacity (kg)" value={draft.capacity_kg} onChangeText={(t) => setDraft({ ...draft, capacity_kg: t })} placeholder="750" keyboardType="numeric" />
            <Select label="Status" value={draft.status} options={STATUS} onChange={(v) => setDraft({ ...draft, status: String(v) })} searchable={false} />
          </>
        )}
      </FormModal>
    </View>
  );
}

const styles = StyleSheet.create({
  search: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surfaceContainerLowest, borderRadius: radius.md, borderWidth: 1, borderColor: colors.outlineVariant, paddingHorizontal: spacing.md, height: 52, marginBottom: spacing.md },
  searchInput: { flex: 1, ...type.bodyLg, color: colors.onSurface },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  badge: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.primaryFixed, alignItems: 'center', justifyContent: 'center' },
  badgeText: { ...type.labelSm, fontFamily: fonts.sansBold, color: colors.onSecondaryFixed },
  name: { ...type.titleMd, color: colors.onSurface },
  sub: { ...type.bodySm, color: colors.onSurfaceVariant, marginTop: 2 },
  iconBtn: { padding: spacing.xs },
  fab: { position: 'absolute', right: spacing.lg, bottom: spacing.lg, width: 60, height: 60, borderRadius: 30, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', ...shadows.level2 },
});
