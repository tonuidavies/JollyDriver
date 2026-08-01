import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { colors, type } from '../theme';

type Props = {
  /** initials fallback, e.g. "SH" */
  initials?: string;
  uri?: string;
  size?: number;
  bg?: string;
  fg?: string;
  ring?: boolean;
  online?: boolean;
};

const RING_TINTS = ['#ffddb8', '#ffcdb5', '#f3d6c4', '#ffe2c2'];

export default function Avatar({
  initials = '',
  uri,
  size = 48,
  bg,
  fg = colors.onSecondaryFixed,
  ring = false,
  online = false,
}: Props) {
  const tint = bg ?? RING_TINTS[(initials.charCodeAt(0) || 0) % RING_TINTS.length];
  return (
    <View>
      <View
        style={[
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: tint,
            alignItems: 'center',
            justifyContent: 'center',
          },
          ring && { borderWidth: 2, borderColor: colors.primaryContainer },
        ]}
      >
        {uri ? (
          <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} />
        ) : (
          <Text style={[type.titleMd, { color: fg, fontSize: size * 0.32 }]}>{initials}</Text>
        )}
      </View>
      {online && (
        <View
          style={[
            styles.dot,
            { backgroundColor: colors.tertiaryContainer, borderColor: colors.surface },
          ]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  dot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 13,
    height: 13,
    borderRadius: 7,
    borderWidth: 2,
  },
});
