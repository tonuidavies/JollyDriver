import React from 'react';
import { Pressable, Text, StyleSheet, ViewStyle, StyleProp, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, type, spacing } from '../theme';

type Variant = 'primary' | 'secondary' | 'dark' | 'outline';

type Props = {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  icon?: keyof typeof Ionicons.glyphMap;
  iconRight?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

export default function PrimaryButton({
  label,
  onPress,
  variant = 'primary',
  icon,
  iconRight = true,
  disabled = false,
  style,
}: Props) {
  const conf = getConf(variant, disabled);
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: conf.bg, borderColor: conf.border, borderWidth: conf.border ? 2 : 0 },
        pressed && { transform: [{ scale: 0.98 }], opacity: 0.92 },
        style,
      ]}
    >
      <View style={styles.row}>
        {icon && !iconRight && (
          <Ionicons name={icon} size={20} color={conf.fg} style={{ marginRight: spacing.sm }} />
        )}
        <Text style={[type.titleMd, { color: conf.fg, fontFamily: type.headlineLgMobile.fontFamily }]}>
          {label}
        </Text>
        {icon && iconRight && (
          <Ionicons name={icon} size={20} color={conf.fg} style={{ marginLeft: spacing.sm }} />
        )}
      </View>
    </Pressable>
  );
}

function getConf(variant: Variant, disabled: boolean) {
  if (disabled) {
    return { bg: colors.secondary, fg: colors.secondaryFixedDim, border: undefined as string | undefined };
  }
  switch (variant) {
    case 'secondary':
      return { bg: 'transparent', fg: colors.secondary, border: colors.secondary };
    case 'outline':
      return { bg: colors.surfaceContainerLowest, fg: colors.secondary, border: colors.secondary };
    case 'dark':
      return { bg: colors.primary, fg: colors.onPrimary, border: undefined };
    case 'primary':
    default:
      return { bg: colors.primaryContainer, fg: colors.onSecondaryFixed, border: undefined };
  }
}

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
});
