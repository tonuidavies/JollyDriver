import React from 'react';
import { Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';

/** The little "sync/offline" glyph that sits top-right on most screens. */
export default function SyncIcon({ color = colors.primary, size = 24 }: { color?: string; size?: number }) {
  return (
    <Pressable hitSlop={10}>
      <Ionicons name="sync-outline" size={size} color={color} />
    </Pressable>
  );
}
