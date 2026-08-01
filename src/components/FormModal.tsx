import React from 'react';
import { View, Text, Modal, Pressable, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, type, fonts, spacing, radius } from '../theme';

type Props = {
  visible: boolean;
  title: string;
  onClose: () => void;
  onSubmit: () => void;
  submitLabel?: string;
  busy?: boolean;
  children: React.ReactNode;
};

/** Bottom-sheet style modal form with a sticky submit bar. */
export default function FormModal({ visible, title, onClose, onSubmit, submitLabel = 'Save', busy, children }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.md }]}>
          <View style={styles.head}>
            <Text style={styles.title}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={10}><Ionicons name="close" size={24} color={colors.onSurfaceVariant} /></Pressable>
          </View>
          <ScrollView style={{ maxHeight: 460 }} contentContainerStyle={{ gap: spacing.md }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {children}
          </ScrollView>
          <Pressable style={[styles.submit, busy && { opacity: 0.7 }]} onPress={onSubmit} disabled={busy}>
            {busy ? <ActivityIndicator color={colors.onSecondaryFixed} /> : <Text style={styles.submitText}>{submitLabel}</Text>}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(33,26,20,0.45)' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, gap: spacing.md },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { ...type.titleMd, fontFamily: fonts.sansBold, fontSize: 20, color: colors.onSurface },
  submit: { height: 52, borderRadius: radius.md, backgroundColor: colors.primaryContainer, alignItems: 'center', justifyContent: 'center', marginTop: spacing.sm },
  submitText: { ...type.titleMd, color: colors.onSecondaryFixed, fontFamily: fonts.sansBold },
});
