import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { Screen, Card, Avatar, StatusBadge, PrimaryButton, ScreenTitleBar } from '../../components';
import { colors, type, spacing, radius } from '../../theme';
import { initialsOf, titleCase } from '../../utils/format';
import { useAuth } from '../../context/AuthContext';

export default function DriverProfile() {
  const { user, isAdmin, setActiveView, signOut } = useAuth();
  const name = `${user?.first_name ?? ''} ${user?.last_name ?? ''}`.trim() || 'Driver';

  const rows = [
    { icon: 'phone-outline', label: 'Phone', value: user?.phone ?? '—' },
    { icon: 'email-outline', label: 'Email', value: user?.email ?? '—' },
    { icon: 'shield-account-outline', label: 'Roles', value: (user?.roles ?? []).map(titleCase).join(', ') || '—' },
  ] as const;

  return (
    <Screen>
      <ScreenTitleBar title="Profile" showSync={false} />

      <Card style={styles.hero}>
        <Avatar initials={initialsOf(name)} size={84} ring />
        <Text style={styles.name}>{name}</Text>
        <StatusBadge label="ACTIVE DRIVER" tone="success" />
      </Card>

      <Card style={{ marginTop: spacing.md, paddingVertical: spacing.xs }}>
        {rows.map((row, i) => (
          <View key={row.label} style={[styles.row, i > 0 && styles.rowBorder]}>
            <View style={styles.rowIcon}>
              <MaterialCommunityIcons name={row.icon as any} size={20} color={colors.primary} />
            </View>
            <Text style={styles.rowLabel}>{row.label}</Text>
            <Text style={styles.rowValue} numberOfLines={1}>{row.value}</Text>
          </View>
        ))}
      </Card>

      {isAdmin && (
        <PrimaryButton
          label="Switch to Admin View"
          variant="secondary"
          icon="swap-horizontal"
          iconRight={false}
          style={{ marginTop: spacing.lg }}
          onPress={() => setActiveView('admin')}
        />
      )}
      <PrimaryButton
        label="Log Out"
        variant="dark"
        icon="log-out-outline"
        iconRight={false}
        style={{ marginTop: spacing.md }}
        onPress={signOut}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.lg },
  name: { ...type.headlineLg, color: colors.onSurface, marginTop: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, paddingHorizontal: spacing.sm },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.outlineVariant },
  rowIcon: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.primaryFixed, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md },
  rowLabel: { ...type.bodyLg, color: colors.onSurfaceVariant, flex: 1 },
  rowValue: { ...type.bodyLg, fontFamily: type.titleMd.fontFamily, color: colors.onSurface, maxWidth: '55%' },
});
