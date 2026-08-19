import React from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { colors, type, fonts, spacing, radius } from '../theme';
import { RangePreset } from '../api/dates';

const LABELS: Record<RangePreset, string> = {
  today: 'Today',
  '7d': '7 Days',
  '30d': '30 Days',
  '90d': '90 Days',
  month: 'This Month',
};

type Props = {
  value: RangePreset;
  onChange: (p: RangePreset) => void;
  options?: RangePreset[];
};

/** Horizontal pill row for picking a report period — same chips as the web reports header. */
export default function RangeChips({ value, onChange, options = ['today', '7d', '30d', '90d'] }: Props) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {options.map((o) => {
        const active = o === value;
        return (
          <Pressable key={o} style={[styles.chip, active && styles.chipActive]} onPress={() => onChange(o)}>
            <Text style={[styles.text, active && styles.textActive]}>{LABELS[o]}</Text>
          </Pressable>
        );
      })}
      <View style={{ width: spacing.sm }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: spacing.sm, paddingBottom: spacing.md },
  chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.full, backgroundColor: colors.surfaceContainerHigh },
  chipActive: { backgroundColor: colors.primaryContainer },
  text: { ...type.bodySm, fontFamily: fonts.sansSemibold, color: colors.onSurfaceVariant },
  textActive: { color: colors.onSecondaryFixed },
});
