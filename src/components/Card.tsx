import React from 'react';
import { View, ViewStyle, StyleProp, StyleSheet } from 'react-native';
import { colors, radius, shadows, spacing } from '../theme';

type Props = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  elevated?: boolean;
  /** left accent border colour (e.g. cash/mpesa rows) */
  accent?: string;
  padded?: boolean;
};

/** Level-1 white card, 18px radius, soft ambient shadow. */
export default function Card({ children, style, elevated = true, accent, padded = true }: Props) {
  return (
    <View
      style={[
        styles.card,
        padded && styles.padded,
        elevated && shadows.level1,
        accent ? { borderLeftWidth: 5, borderLeftColor: accent } : null,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radius.card,
  },
  padded: {
    padding: spacing.md,
  },
});
