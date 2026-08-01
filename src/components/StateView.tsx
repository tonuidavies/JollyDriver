import React from 'react';
import { View, Text, ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, type, spacing, radius } from '../theme';

/** Inline loading / error / empty state used by data-driven screens. */
export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.primaryContainer} size="large" />
      <Text style={styles.muted}>{label}</Text>
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <View style={styles.center}>
      <Ionicons name="cloud-offline-outline" size={40} color={colors.error} />
      <Text style={styles.errText}>{message || 'Something went wrong.'}</Text>
      {onRetry && (
        <Pressable style={styles.retry} onPress={onRetry}>
          <Ionicons name="refresh" size={18} color={colors.onPrimary} />
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      )}
    </View>
  );
}

export function EmptyState({ icon = 'file-tray-outline', message }: { icon?: keyof typeof Ionicons.glyphMap; message: string }) {
  return (
    <View style={styles.center}>
      <Ionicons name={icon} size={40} color={colors.outline} />
      <Text style={styles.muted}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xl * 2, gap: spacing.md },
  muted: { ...type.bodyLg, color: colors.onSurfaceVariant, textAlign: 'center' },
  errText: { ...type.bodyLg, color: colors.error, textAlign: 'center', paddingHorizontal: spacing.lg },
  retry: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.full,
  },
  retryText: { ...type.titleMd, color: colors.onPrimary },
});
