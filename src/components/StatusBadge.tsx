import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, radius, type, spacing } from '../theme';

export type BadgeTone =
  | 'success'
  | 'partial'
  | 'pending'
  | 'error'
  | 'info'
  | 'neutral';

const TONES: Record<BadgeTone, { bg: string; fg: string }> = {
  success: { bg: colors.successContainer, fg: colors.onSuccessContainer },
  partial: { bg: colors.secondaryContainer, fg: colors.onSecondaryContainer },
  pending: { bg: colors.warningContainer, fg: colors.onWarningContainer },
  error: { bg: colors.errorContainer, fg: colors.onErrorContainer },
  info: { bg: colors.tertiaryFixed, fg: colors.onTertiaryContainer },
  neutral: { bg: colors.neutralContainer, fg: colors.onNeutralContainer },
};

type Props = {
  label: string;
  tone?: BadgeTone;
  mono?: boolean;
};

/** Pill-shaped tonal status badge. */
export default function StatusBadge({ label, tone = 'neutral', mono = true }: Props) {
  const t = TONES[tone];
  return (
    <View style={[styles.badge, { backgroundColor: t.bg }]}>
      <Text
        style={[
          mono ? type.labelSm : { ...type.bodySm, fontFamily: type.titleMd.fontFamily },
          { color: t.fg },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.full,
    alignSelf: 'flex-start',
  },
});
