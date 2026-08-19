import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, Alert } from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { ScreenTitleBar, Select, PrimaryButton, Card, FormModal, Field } from '../../components';
import { Loading } from '../../components/StateView';
import { colors, type, fonts, spacing, radius } from '../../theme';
import { kes } from '../../utils/format';
import { ymd } from '../../api/dates';
import {
  useVehicles, useDrivers, useAgents, useProducts, useCustomerSearch, useCreateCustomer,
  useCreateSchoolDispatch,
} from '../../api/hooks';
import { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'SchoolDispatch'>;
const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
type Line = { key: string; product_id?: number; quantity: string; price: string };

/**
 * Direct-to-school delivery — no route at all. One call creates the dispatch,
 * records its lines, posts the LPO sale and generates the invoice, so it lands
 * `completed` immediately. Unlike a route dispatch, price is set per line here.
 */
export default function SchoolDispatchScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const vehicles = useVehicles();
  const drivers = useDrivers();
  const agents = useAgents();
  const products = useProducts();
  const [term, setTerm] = useState('');
  const [debounced, setDebounced] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebounced(term.trim()), 350);
    return () => clearTimeout(t);
  }, [term]);
  const customers = useCustomerSearch(debounced);
  const createCustomer = useCreateCustomer();
  const create = useCreateSchoolDispatch();

  const [vehicleId, setVehicleId] = useState<number | null>(null);
  const [driverId, setDriverId] = useState<number | null>(null);
  const [agentId, setAgentId] = useState<number | null>(null);
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [lpoNumber, setLpoNumber] = useState('');
  const [date, setDate] = useState(ymd());
  const [lines, setLines] = useState<Line[]>([{ key: 'l1', quantity: '', price: '' }]);

  // quick-add school
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newContact, setNewContact] = useState('');
  const [newPhone, setNewPhone] = useState('');

  const vehicleOpts = ((vehicles.data ?? []) as any[]).map((v) => ({ label: v.registration_number, value: num(v.id), sub: [v.make, v.model].filter(Boolean).join(' ') }));
  // driver_id / agent_id are USER ids — same id space for both.
  const driverOpts = ((drivers.data ?? []) as any[]).map((d) => ({ label: `${d.first_name ?? ''} ${d.last_name ?? ''}`.trim() || `Driver ${d.id}`, value: num(d.user_id ?? d.id) }));
  const agentOpts = ((agents.data ?? []) as any[]).map((a) => ({ label: `${a.first_name ?? ''} ${a.last_name ?? ''}`.trim() || `Agent ${a.id}`, value: num(a.user_id ?? a.id) }));
  const productOpts = ((products.data ?? []) as any[]).map((p) => ({ label: p.name, value: num(p.id), sub: kes(num(p.price)) }));
  const customerOpts = ((customers.data ?? []) as any[]).map((c) => ({
    label: String(c.name ?? `Customer ${c.id}`),
    value: num(c.id),
    sub: [c.customer_type, c.phone].filter(Boolean).join(' · '),
  }));

  const productPrice = (pid?: number) => num(((products.data ?? []) as any[]).find((p) => num(p.id) === pid)?.price);
  const total = useMemo(() => lines.reduce((s, l) => s + num(l.quantity) * num(l.price), 0), [lines]);

  const setLine = (key: string, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const addLine = () => setLines((ls) => [...ls, { key: `l${Date.now()}`, quantity: '', price: '' }]);
  const removeLine = (key: string) => setLines((ls) => (ls.length > 1 ? ls.filter((l) => l.key !== key) : ls));

  const submitQuickAdd = () => {
    if (!newName.trim()) return Alert.alert('Name required');
    createCustomer.mutate(
      { name: newName.trim(), customer_type: 'school', contact_person: newContact || undefined, phone: newPhone || undefined },
      {
        onSuccess: (r: any) => {
          const id = num(r?.id ?? r?.customer_id ?? r?.data?.id);
          setAddOpen(false); setNewName(''); setNewContact(''); setNewPhone('');
          if (id) setCustomerId(id);
          customers.refetch();
          Alert.alert('School added');
        },
        onError: (e) => Alert.alert('Failed', (e as Error).message),
      }
    );
  };

  const submit = () => {
    if (!vehicleId || !driverId || !agentId || !customerId) {
      return Alert.alert('Missing fields', 'Select vehicle, driver, agent and the school.');
    }
    if (!lpoNumber.trim()) return Alert.alert('LPO number required');
    const items = lines
      .filter((l) => l.product_id && num(l.quantity) > 0)
      .map((l) => ({ product_id: l.product_id as number, quantity: num(l.quantity), price: num(l.price) }));
    if (items.length === 0) return Alert.alert('Add items', 'Add at least one product line with a quantity and price.');

    create.mutate(
      {
        vehicle_id: vehicleId,
        driver_id: driverId,
        agent_id: agentId,
        customer_id: customerId,
        lpo_number: lpoNumber.trim(),
        dispatch_date: date || undefined,
        items,
      },
      {
        onSuccess: (r: any) => {
          const inv = r?.invoice_number ?? r?.invoice?.invoice_number;
          Alert.alert(
            'School dispatch created',
            `Delivered, invoiced and completed.${inv ? `\nInvoice: ${inv}` : ''}`
          );
          navigation.goBack();
        },
        onError: (e) => Alert.alert('Failed', (e as Error).message),
      }
    );
  };

  const loading = vehicles.isLoading || drivers.isLoading || agents.isLoading || products.isLoading;

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.marginMobile, paddingBottom: spacing.xl }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <ScreenTitleBar title="New School Dispatch" onBack={() => navigation.goBack()} showSync={false} />

        <Card style={styles.explainer}>
          <MaterialCommunityIcons name="school-outline" size={20} color={colors.primary} />
          <Text style={styles.explainerText}>
            A delivery straight to one school. No route stops, no "record sale" step, nothing tracked as returned —
            it's delivered, invoiced and completed in one go.
          </Text>
        </Card>

        {loading ? (
          <Loading label="Loading options…" />
        ) : (
          <>
            <Text style={styles.section}>Vehicle & Crew</Text>
            <View style={{ gap: spacing.md }}>
              <Select label="Vehicle" value={vehicleId} options={vehicleOpts} onChange={(v) => setVehicleId(num(v))} placeholder="Select vehicle" />
              <Select label="Driver" value={driverId} options={driverOpts} onChange={(v) => setDriverId(num(v))} placeholder="Select driver" />
              <Select label="Agent" value={agentId} options={agentOpts} onChange={(v) => setAgentId(num(v))} placeholder="Select agent" />
            </View>

            <Text style={styles.section}>School & LPO</Text>
            <View style={{ gap: spacing.md }}>
              <View style={styles.searchRow}>
                <View style={styles.searchBox}>
                  <Ionicons name="search" size={18} color={colors.outline} />
                  <TextInput
                    style={styles.searchInput}
                    value={term}
                    onChangeText={setTerm}
                    placeholder="Search schools…"
                    placeholderTextColor={colors.outline}
                  />
                </View>
                <Pressable style={styles.newBtn} onPress={() => setAddOpen(true)}>
                  <Ionicons name="add" size={18} color={colors.onSecondaryFixed} />
                  <Text style={styles.newBtnText}>New</Text>
                </Pressable>
              </View>
              <Select
                label="School"
                value={customerId}
                options={customerOpts}
                onChange={(v) => setCustomerId(num(v))}
                placeholder={customers.isLoading ? 'Loading…' : 'Select the school'}
              />
              <View>
                <Text style={styles.miniLabel}>LPO number</Text>
                <TextInput style={styles.input} value={lpoNumber} onChangeText={setLpoNumber} placeholder="e.g. LPO-2026-0142" placeholderTextColor={colors.outline} autoCapitalize="characters" />
              </View>
              <View>
                <Text style={styles.miniLabel}>Dispatch date</Text>
                <TextInput style={styles.input} value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" placeholderTextColor={colors.outline} />
              </View>
            </View>

            <Text style={styles.section}>Products Delivered</Text>
            {lines.map((l) => (
              <Card key={l.key} style={styles.lineCard}>
                <Select placeholder="Select product" value={l.product_id ?? null} options={productOpts}
                  onChange={(v) => setLine(l.key, { product_id: num(v), price: String(productPrice(num(v)) || l.price) })} />
                <View style={styles.lineRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.miniLabel}>Qty</Text>
                    <TextInput style={styles.miniInput} keyboardType="numeric" value={l.quantity} onChangeText={(t) => setLine(l.key, { quantity: t })} placeholder="0" placeholderTextColor={colors.outline} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.miniLabel}>Price</Text>
                    <TextInput style={styles.miniInput} keyboardType="numeric" value={l.price} onChangeText={(t) => setLine(l.key, { price: t })} placeholder="0" placeholderTextColor={colors.outline} />
                  </View>
                  <View>
                    <Text style={styles.miniLabel}>Subtotal</Text>
                    <Text style={styles.subtotal}>{kes(num(l.quantity) * num(l.price), false)}</Text>
                  </View>
                  <Pressable hitSlop={8} onPress={() => removeLine(l.key)} style={{ paddingTop: 22 }}>
                    <MaterialCommunityIcons name="trash-can-outline" size={22} color={colors.error} />
                  </Pressable>
                </View>
              </Card>
            ))}
            <Pressable style={styles.addLine} onPress={addLine}>
              <Ionicons name="add-circle-outline" size={22} color={colors.secondary} />
              <Text style={styles.addLineText}>Add Product</Text>
            </Pressable>

            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>{kes(total)}</Text>
            </View>

            <PrimaryButton label="Create School Dispatch" icon="school-outline" iconRight={false} style={{ marginTop: spacing.lg }} onPress={submit} disabled={create.isPending} />
            <Text style={styles.note}>
              The LPO photo/scan upload is web-only for now — attach it there if the school requires a copy on file.
            </Text>
          </>
        )}
      </ScrollView>

      <FormModal visible={addOpen} title="Quick-add School" onClose={() => setAddOpen(false)} onSubmit={submitQuickAdd} submitLabel="Add School" busy={createCustomer.isPending}>
        <Field label="Name" value={newName} onChangeText={setNewName} placeholder="e.g. Kaplong Girls High School" />
        <Field label="Contact person" value={newContact} onChangeText={setNewContact} placeholder="Optional" />
        <Field label="Phone" value={newPhone} onChangeText={setNewPhone} placeholder="Optional" keyboardType="phone-pad" />
      </FormModal>
    </View>
  );
}

const styles = StyleSheet.create({
  explainer: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start', backgroundColor: colors.surfaceContainerHigh },
  explainerText: { ...type.bodySm, color: colors.onSurfaceVariant, flex: 1 },
  section: { ...type.headlineLgMobile, color: colors.onSurface, marginTop: spacing.xl, marginBottom: spacing.md },
  searchRow: { flexDirection: 'row', gap: spacing.sm },
  searchBox: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surfaceContainerLow, borderRadius: radius.md, paddingHorizontal: spacing.md, height: 48 },
  searchInput: { flex: 1, ...type.bodyLg, color: colors.onSurface },
  newBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.md, height: 48, borderRadius: radius.md, backgroundColor: colors.primaryContainer },
  newBtnText: { ...type.bodySm, fontFamily: fonts.sansSemibold, color: colors.onSecondaryFixed },
  input: { backgroundColor: colors.surfaceContainerLow, borderRadius: radius.md, paddingHorizontal: spacing.md, height: 52, ...type.bodyLg, color: colors.onSurface },
  lineCard: { marginBottom: spacing.md, gap: spacing.sm },
  lineRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  miniLabel: { ...type.labelSm, color: colors.onSurfaceVariant, marginBottom: spacing.xs },
  miniInput: { backgroundColor: colors.surfaceContainerLow, borderRadius: radius.md, height: 44, textAlign: 'center', ...type.titleMd, color: colors.onSurface },
  subtotal: { ...type.titleMd, fontFamily: fonts.monoSemibold, color: colors.primary, paddingTop: spacing.sm, minWidth: 60, textAlign: 'right' },
  addLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.outline, borderRadius: radius.md, paddingVertical: spacing.md },
  addLineText: { ...type.titleMd, color: colors.secondary },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.md },
  totalLabel: { ...type.titleMd, color: colors.onSurfaceVariant },
  totalValue: { ...type.metricXl, color: colors.primary },
  note: { ...type.bodySm, color: colors.onSurfaceVariant, fontStyle: 'italic', marginTop: spacing.md },
});
