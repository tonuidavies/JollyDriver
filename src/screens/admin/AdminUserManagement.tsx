import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card, Avatar, StatusBadge, PrimaryButton, ScreenTitleBar } from '../../components';
import { Loading, ErrorState, EmptyState } from '../../components/StateView';
import { colors, type, fonts, spacing, radius } from '../../theme';
import { initialsOf } from '../../utils/format';
import { useDrivers, useAgents } from '../../api/hooks';
import { useAuth } from '../../context/AuthContext';

type Member = { id: string; name: string; phone: string; role: 'DRIVER' | 'AGENT'; initials: string };

export default function AdminUserManagement() {
  const insets = useSafeAreaInsets();
  const { user, isDriver, setActiveView, signOut } = useAuth();
  const drivers = useDrivers();
  const agents = useAgents();
  const [q, setQ] = useState('');

  const members: Member[] = useMemo(() => {
    const d: Member[] = (drivers.data ?? []).map((x) => ({
      id: `d${x.id}`,
      name: `${x.first_name} ${x.last_name}`.trim(),
      phone: x.phone,
      role: 'DRIVER',
      initials: initialsOf(`${x.first_name} ${x.last_name}`),
    }));
    const a: Member[] = (agents.data ?? []).map((x) => ({
      id: `a${x.id}`,
      name: `${x.first_name} ${x.last_name}`.trim(),
      phone: x.phone,
      role: 'AGENT',
      initials: initialsOf(`${x.first_name} ${x.last_name}`),
    }));
    return [...d, ...a].filter((m) => m.name.toLowerCase().includes(q.toLowerCase()));
  }, [drivers.data, agents.data, q]);

  const loading = drivers.isLoading || agents.isLoading;
  const errored = drivers.isError || agents.isError;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.marginMobile, paddingBottom: spacing.xl }}
      refreshControl={<RefreshControl refreshing={drivers.isRefetching || agents.isRefetching} onRefresh={() => { drivers.refetch(); agents.refetch(); }} tintColor={colors.primary} />}
      showsVerticalScrollIndicator={false}
    >
      <ScreenTitleBar title="Team Management" showSync={false} />

      <View style={styles.statRow}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>DRIVERS</Text>
          <Text style={[styles.statValue, { color: colors.primary }]}>{drivers.data?.length ?? '—'}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>AGENTS</Text>
          <Text style={[styles.statValue, { color: colors.secondary }]}>{agents.data?.length ?? '—'}</Text>
        </View>
      </View>

      <View style={styles.search}>
        <Ionicons name="search" size={20} color={colors.outline} />
        <TextInput style={styles.searchInput} placeholder="Search team members…" placeholderTextColor={colors.outline} value={q} onChangeText={setQ} />
      </View>

      {loading ? (
        <Loading />
      ) : errored ? (
        <ErrorState message="Couldn't load the team." onRetry={() => { drivers.refetch(); agents.refetch(); }} />
      ) : members.length === 0 ? (
        <EmptyState icon="people-outline" message="No team members found." />
      ) : (
        members.map((m) => (
          <Card key={m.id} style={styles.memberCard}>
            <Avatar initials={m.initials} size={52} />
            <View style={{ flex: 1, marginLeft: spacing.md }}>
              <Text style={styles.memberName}>{m.name || 'Unnamed'}</Text>
              <Text style={styles.memberPhone}>{m.phone || '—'}</Text>
            </View>
            <StatusBadge label={m.role} tone={m.role === 'AGENT' ? 'info' : 'neutral'} />
          </Card>
        ))
      )}

      <PrimaryButton
        label="Edit My Profile"
        variant="secondary"
        icon="person-outline"
        iconRight={false}
        style={{ marginTop: spacing.lg }}
        onPress={() => {}}
      />
      {isDriver && (
        <PrimaryButton
          label="Switch to Driver View"
          variant="outline"
          icon="swap-horizontal"
          iconRight={false}
          style={{ marginTop: spacing.md }}
          onPress={() => setActiveView('driver')}
        />
      )}
      <PrimaryButton
        label={`Log Out${user ? ` (${user.first_name})` : ''}`}
        variant="dark"
        icon="log-out-outline"
        iconRight={false}
        style={{ marginTop: spacing.md }}
        onPress={signOut}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  statRow: { flexDirection: 'row', gap: spacing.md },
  statCard: { flex: 1, backgroundColor: colors.primaryFixed, borderRadius: radius.md, padding: spacing.lg },
  statLabel: { ...type.labelSm, color: colors.onSurfaceVariant },
  statValue: { ...type.displayLg, fontSize: 40, marginTop: spacing.sm },
  search: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.outlineVariant, paddingHorizontal: spacing.md, height: 56,
    marginTop: spacing.lg, marginBottom: spacing.md,
  },
  searchInput: { flex: 1, ...type.bodyLg, color: colors.onSurface },
  memberCard: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  memberName: { ...type.titleMd, fontSize: 18, color: colors.onSurface },
  memberPhone: { ...type.bodyLg, color: colors.onSurfaceVariant, marginTop: 2 },
});
