import React from 'react';
import { View, Text, TextInput, StyleSheet, KeyboardTypeOptions } from 'react-native';
import { colors, type, spacing, radius } from '../theme';

type Props = {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
};

export default function Field({ label, value, onChangeText, placeholder, keyboardType, autoCapitalize }: Props) {
  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.outline}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  label: { ...type.labelSm, color: colors.onSurfaceVariant, marginBottom: spacing.sm },
  input: { backgroundColor: colors.surfaceContainerLow, borderRadius: radius.md, paddingHorizontal: spacing.md, height: 52, ...type.bodyLg, color: colors.onSurface },
});
