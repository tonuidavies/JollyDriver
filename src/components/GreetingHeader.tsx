import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Avatar from './Avatar';
import SyncIcon from './SyncIcon';
import StatusBadge from './StatusBadge';
import { colors, type, spacing } from '../theme';
import { useMenu } from '../context/MenuContext';

type Props = {
  name: string;
  initials?: string;
  avatarUri?: string;
  showSynced?: boolean;
  right?: React.ReactNode;
};

/** "Good Morning Ian 👋" header used across driver/admin home screens. */
export default function GreetingHeader({ name, initials, avatarUri, showSynced, right }: Props) {
  const { open } = useMenu();
  return (
    <View style={styles.row}>
      <View style={styles.left}>
        <Pressable onPress={open} hitSlop={8} style={styles.menuBtn}>
          <Ionicons name="menu" size={26} color={colors.onSurface} />
        </Pressable>
        <Avatar initials={initials} uri={avatarUri} size={44} ring />
        <Text style={styles.greeting} numberOfLines={2}>
          Good Morning {name} <Text style={{ fontSize: 22 }}>👋</Text>
        </Text>
      </View>
      <View style={styles.right}>
        {showSynced && <StatusBadge label="SYNCED" tone="success" />}
        {right}
        <SyncIcon />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  left: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: spacing.sm },
  menuBtn: { padding: 2 },
  greeting: {
    ...type.headlineLgMobile,
    color: colors.primary,
    flexShrink: 1,
  },
  right: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
