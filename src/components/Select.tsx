import React, { useState, useMemo } from 'react';
import { View, Text, Pressable, Modal, TextInput, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, type, spacing, radius } from '../theme';

export type Option = { label: string; value: string | number; sub?: string };

type Props = {
  label?: string;
  placeholder?: string;
  value?: string | number | null;
  options: Option[];
  onChange: (v: string | number) => void;
  searchable?: boolean;
};

/** Tap-to-open dropdown backed by a modal list (no native picker dependency). */
export default function Select({ label, placeholder = 'Select…', value, options, onChange, searchable = true }: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const selected = options.find((o) => o.value === value);
  const filtered = useMemo(
    () => (q ? options.filter((o) => o.label.toLowerCase().includes(q.toLowerCase())) : options),
    [q, options]
  );

  return (
    <View>
      {label && <Text style={styles.label}>{label}</Text>}
      <Pressable style={styles.field} onPress={() => setOpen(true)}>
        <Text style={[styles.value, !selected && { color: colors.outline }]} numberOfLines={1}>
          {selected ? selected.label : placeholder}
        </Text>
        <Ionicons name="chevron-down" size={20} color={colors.secondary} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle}>{label ?? 'Select'}</Text>
              <Pressable onPress={() => setOpen(false)} hitSlop={10}><Ionicons name="close" size={22} color={colors.onSurfaceVariant} /></Pressable>
            </View>
            {searchable && (
              <View style={styles.search}>
                <Ionicons name="search" size={18} color={colors.outline} />
                <TextInput style={styles.searchInput} placeholder="Search…" placeholderTextColor={colors.outline} value={q} onChangeText={setQ} autoFocus />
              </View>
            )}
            <ScrollView style={{ maxHeight: 360 }} keyboardShouldPersistTaps="handled">
              {filtered.map((o) => (
                <Pressable key={String(o.value)} style={styles.opt} onPress={() => { onChange(o.value); setOpen(false); setQ(''); }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.optLabel}>{o.label}</Text>
                    {o.sub ? <Text style={styles.optSub}>{o.sub}</Text> : null}
                  </View>
                  {o.value === value && <Ionicons name="checkmark" size={20} color={colors.primary} />}
                </Pressable>
              ))}
              {filtered.length === 0 && <Text style={styles.empty}>No matches</Text>}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { ...type.labelSm, color: colors.onSurfaceVariant, marginBottom: spacing.sm },
  field: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surfaceContainerLow, borderRadius: radius.md, paddingHorizontal: spacing.md, height: 56 },
  value: { ...type.bodyLg, color: colors.onSurface, flex: 1 },
  backdrop: { flex: 1, backgroundColor: 'rgba(33,26,20,0.45)', justifyContent: 'center', padding: spacing.lg },
  sheet: { backgroundColor: colors.surfaceContainerLowest, borderRadius: radius.xl, padding: spacing.lg, maxHeight: '80%' },
  sheetHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  sheetTitle: { ...type.titleMd, color: colors.onSurface },
  search: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surfaceContainerLow, borderRadius: radius.md, paddingHorizontal: spacing.md, height: 48, marginBottom: spacing.sm },
  searchInput: { flex: 1, ...type.bodyLg, color: colors.onSurface },
  opt: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.outlineVariant },
  optLabel: { ...type.bodyLg, color: colors.onSurface },
  optSub: { ...type.bodySm, color: colors.onSurfaceVariant, marginTop: 2 },
  empty: { ...type.bodyLg, color: colors.onSurfaceVariant, textAlign: 'center', paddingVertical: spacing.lg },
});
