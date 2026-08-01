import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, TextInput, Alert } from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Card, ScreenTitleBar, Select, FormModal, Field } from '../../components';
import { Loading, ErrorState, EmptyState } from '../../components/StateView';
import { colors, type, fonts, spacing, radius, shadows } from '../../theme';
import { initialsOf } from '../../utils/format';
import { useCustomerSearch, useCreateCustomer } from '../../api/hooks';
import { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Customers'>;
const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const CTYPE = [{ label: 'School', value: 'school' }, { label: 'Other', value: 'other' }];
type Draft = { name: string; customer_type: string; contact_person: string; phone: string; email: string; credit_limit: string; payment_terms_days: string };
const EMPTY: Draft = { name: '', customer_type: 'school', contact_person: '', phone: '', email: '', credit_limit: '', payment_terms_days: '30' };

export default function CustomersScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [q, setQ] = useState('');
  const search = useCustomerSearch(q);
  const create = useCreateCustomer();
  const [draft, setDraft] = useState<Draft | null>(null);

  const list: any[] = Array.isArray(search.data) ? search.data : (search.data as any)?.data ?? [];

  const save = () => {
    if (!draft) return;
    if (!draft.name.trim()) return Alert.alert('Name required');
    create.mutate(
      {
        name: draft.name.trim(),
        customer_type: draft.customer_type as any,
        contact_person: draft.contact_person || undefined,
        phone: draft.phone || undefined,
        email: draft.email || undefined,
        credit_limit: draft.credit_limit ? num(draft.credit_limit) : undefined,
        payment_terms_days: draft.payment_terms_days ? num(draft.payment_terms_days) : undefined,
      },
      { onSuccess: () => { setDraft(null); search.refetch(); }, onError: (e) => Alert.alert('Failed', (e as Error).message) }
    );
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.marginMobile, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        <ScreenTitleBar title="Customers" onBack={() => navigation.goBack()} showSync={false}
          right={<Pressable onPress={() => navigation.navigate('Invoices')} hitSlop={8}><MaterialCommunityIcons name="file-document-outline" size={24} color={colors.primary} /></Pressable>} />

        <View style={styles.search}>
          <Ionicons name="search" size={20} color={colors.outline} />
          <TextInput style={styles.searchInput} placeholder="Search customers…" placeholderTextColor={colors.outline} value={q} onChangeText={setQ} />
        </View>

        {search.isLoading ? <Loading /> : search.isError ? <ErrorState onRetry={search.refetch} /> : list.length === 0 ? (
          <EmptyState icon="storefront-outline" message="No customers found." />
        ) : (
          list.map((c: any) => (
            <Pressable key={c.id} onPress={() => navigation.navigate('CustomerDetail', { id: num(c.id), name: c.name })}>
              <Card style={styles.row}>
                <View style={styles.badge}><Text style={styles.badgeText}>{initialsOf(c.name)}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{c.name}</Text>
                  <Text style={styles.sub}>{c.customer_type || c.contact_person || c.phone || '—'}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.outline} />
              </Card>
            </Pressable>
          ))
        )}
      </ScrollView>

      <Pressable style={styles.fab} onPress={() => setDraft({ ...EMPTY })}><Ionicons name="add" size={30} color={colors.onPrimary} /></Pressable>

      <FormModal visible={!!draft} title="New Customer" onClose={() => setDraft(null)} onSubmit={save} submitLabel="Create Customer" busy={create.isPending}>
        {draft && (
          <>
            <Field label="Name" value={draft.name} onChangeText={(t) => setDraft({ ...draft, name: t })} placeholder="St. Mary's School" />
            <Select label="Type" value={draft.customer_type} options={CTYPE} onChange={(v) => setDraft({ ...draft, customer_type: String(v) })} searchable={false} />
            <Field label="Contact Person" value={draft.contact_person} onChangeText={(t) => setDraft({ ...draft, contact_person: t })} placeholder="Optional" />
            <Field label="Phone" value={draft.phone} onChangeText={(t) => setDraft({ ...draft, phone: t })} placeholder="0722000000" keyboardType="phone-pad" />
            <Field label="Email" value={draft.email} onChangeText={(t) => setDraft({ ...draft, email: t })} placeholder="Optional" autoCapitalize="none" />
            <Field label="Credit Limit" value={draft.credit_limit} onChangeText={(t) => setDraft({ ...draft, credit_limit: t })} placeholder="Optional" keyboardType="numeric" />
            <Field label="Payment Terms (days)" value={draft.payment_terms_days} onChangeText={(t) => setDraft({ ...draft, payment_terms_days: t })} placeholder="30" keyboardType="numeric" />
          </>
        )}
      </FormModal>
    </View>
  );
}

const styles = StyleSheet.create({
  search: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surfaceContainerLowest, borderRadius: radius.md, borderWidth: 1, borderColor: colors.outlineVariant, paddingHorizontal: spacing.md, height: 52, marginBottom: spacing.md },
  searchInput: { flex: 1, ...type.bodyLg, color: colors.onSurface },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  badge: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primaryFixed, alignItems: 'center', justifyContent: 'center' },
  badgeText: { ...type.labelSm, fontFamily: fonts.sansBold, color: colors.onSecondaryFixed },
  name: { ...type.titleMd, color: colors.onSurface },
  sub: { ...type.bodySm, color: colors.onSurfaceVariant, marginTop: 2, textTransform: 'capitalize' },
  fab: { position: 'absolute', right: spacing.lg, bottom: spacing.lg, width: 60, height: 60, borderRadius: 30, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', ...shadows.level2 },
});
