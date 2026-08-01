import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, RefreshControl, TextInput, Alert } from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Card, Avatar, ScreenTitleBar, StatusBadge, Select, FormModal, Field } from '../../components';
import { Loading, ErrorState, EmptyState } from '../../components/StateView';
import { colors, type, spacing, radius, shadows } from '../../theme';
import { initialsOf } from '../../utils/format';
import { useAgents, useCreateAgent, useUpdateAgent, useDeleteAgent } from '../../api/hooks';
import { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Agents'>;
const STATUS = [
  { label: 'Active', value: 'active' },
  { label: 'Suspended', value: 'suspended' },
  { label: 'On leave', value: 'on_leave' },
];
type Draft = { agent_id?: number; user_id?: number; first_name: string; last_name: string; phone: string; id_number: string; status: string };
const EMPTY: Draft = { first_name: '', last_name: '', phone: '', id_number: '', status: 'active' };
const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);

export default function AgentsScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { data, isLoading, isError, refetch, isRefetching } = useAgents();
  const create = useCreateAgent();
  const update = useUpdateAgent();
  const del = useDeleteAgent();
  const [q, setQ] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);

  const list = (data ?? []).filter((a: any) =>
    `${a.first_name} ${a.last_name} ${a.phone} ${a.id_number}`.toLowerCase().includes(q.toLowerCase())
  );

  const save = () => {
    if (!draft) return;
    if (!draft.first_name.trim() || !draft.phone.trim()) return Alert.alert('Name and phone required');
    const base = { first_name: draft.first_name.trim(), last_name: draft.last_name.trim(), phone: draft.phone.trim(), id_number: draft.id_number.trim(), status: draft.status as any };
    const onDone = () => { setDraft(null); refetch(); };
    if (draft.agent_id) update.mutate({ agent_id: draft.agent_id, user_id: num(draft.user_id), ...base }, { onSuccess: onDone, onError: (e) => Alert.alert('Failed', (e as Error).message) });
    else create.mutate(base, { onSuccess: onDone, onError: (e) => Alert.alert('Failed', (e as Error).message) });
  };

  const remove = (a: any) =>
    Alert.alert('Delete agent', `Remove ${a.first_name} ${a.last_name}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => del.mutate(num(a.id), { onSuccess: () => refetch() }) },
    ]);

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.marginMobile, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        <ScreenTitleBar title="Agents & Clerks" onBack={() => navigation.goBack()} showSync={false} />
        <View style={styles.search}>
          <Ionicons name="search" size={20} color={colors.outline} />
          <TextInput style={styles.searchInput} placeholder="Search name, ID or phone…" placeholderTextColor={colors.outline} value={q} onChangeText={setQ} />
        </View>

        {isLoading ? <Loading /> : isError ? <ErrorState onRetry={refetch} /> : list.length === 0 ? (
          <EmptyState icon="people-outline" message="No agents yet." />
        ) : (
          list.map((a: any) => (
            <Card key={a.id} style={styles.row}>
              <Avatar initials={initialsOf(`${a.first_name} ${a.last_name}`)} size={44} />
              <View style={{ flex: 1, marginLeft: spacing.sm }}>
                <Text style={styles.name}>{`${a.first_name ?? ''} ${a.last_name ?? ''}`.trim() || 'Unnamed'}</Text>
                <Text style={styles.sub}>{a.phone || '—'}{a.id_number ? ` · ID ${a.id_number}` : ''}</Text>
              </View>
              <StatusBadge label={String(a.status || '').toUpperCase() || 'ACTIVE'} tone={a.status === 'active' ? 'success' : a.status === 'suspended' ? 'error' : 'pending'} />
              <Pressable hitSlop={8} onPress={() => setDraft({ agent_id: num(a.id), user_id: num(a.user_id), first_name: a.first_name ?? '', last_name: a.last_name ?? '', phone: a.phone ?? '', id_number: a.id_number ?? '', status: a.status ?? 'active' })} style={styles.iconBtn}>
                <Feather name="edit-2" size={18} color={colors.secondary} />
              </Pressable>
              <Pressable hitSlop={8} onPress={() => remove(a)} style={styles.iconBtn}><Feather name="trash-2" size={18} color={colors.error} /></Pressable>
            </Card>
          ))
        )}
      </ScrollView>

      <Pressable style={styles.fab} onPress={() => setDraft({ ...EMPTY })}><Ionicons name="person-add" size={26} color={colors.onPrimary} /></Pressable>

      <FormModal visible={!!draft} title={draft?.agent_id ? 'Edit Agent' : 'New Agent'} onClose={() => setDraft(null)} onSubmit={save} submitLabel={draft?.agent_id ? 'Update Agent' : 'Create Agent'} busy={create.isPending || update.isPending}>
        {draft && (
          <>
            <Field label="First Name" value={draft.first_name} onChangeText={(t) => setDraft({ ...draft, first_name: t })} placeholder="Jane" />
            <Field label="Last Name" value={draft.last_name} onChangeText={(t) => setDraft({ ...draft, last_name: t })} placeholder="Achieng" />
            <Field label="Phone" value={draft.phone} onChangeText={(t) => setDraft({ ...draft, phone: t })} placeholder="0722000000" keyboardType="phone-pad" />
            <Field label="ID Number" value={draft.id_number} onChangeText={(t) => setDraft({ ...draft, id_number: t })} placeholder="12345678" keyboardType="numeric" />
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
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.md },
  name: { ...type.titleMd, color: colors.onSurface },
  sub: { ...type.bodySm, color: colors.onSurfaceVariant, marginTop: 2 },
  iconBtn: { padding: spacing.xs },
  fab: { position: 'absolute', right: spacing.lg, bottom: spacing.lg, width: 60, height: 60, borderRadius: 30, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', ...shadows.level2 },
});
