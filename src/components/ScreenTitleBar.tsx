import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import SyncIcon from './SyncIcon';
import { colors, type, spacing } from '../theme';
import { useMenu } from '../context/MenuContext';

type Props = {
  title: string;
  onBack?: () => void;
  right?: React.ReactNode;
  showSync?: boolean;
  color?: string;
};

/** Simple top bar: optional back arrow, title, sync icon. */
export default function ScreenTitleBar({ title, onBack, right, showSync = true, color = colors.primary }: Props) {
  const { open } = useMenu();
  return (
    <View style={styles.row}>
      <View style={styles.left}>
        {onBack ? (
          <Pressable onPress={onBack} hitSlop={10} style={{ marginRight: spacing.sm }}>
            <Ionicons name="arrow-back" size={26} color={colors.onSurface} />
          </Pressable>
        ) : (
          <Pressable onPress={open} hitSlop={10} style={{ marginRight: spacing.sm }}>
            <Ionicons name="menu" size={26} color={colors.onSurface} />
          </Pressable>
        )}
        <Text style={[styles.title, { color }]} numberOfLines={2}>
          {title}
        </Text>
      </View>
      <View style={styles.right}>
        {right}
        {showSync && <SyncIcon />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  left: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  title: { ...type.headlineLg, flexShrink: 1 },
  right: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
