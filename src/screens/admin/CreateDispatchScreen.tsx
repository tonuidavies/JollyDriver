import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, Alert, Switch } from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { ScreenTitleBar, Select, PrimaryButton, Card } from '../../components';
import { Loading } from '../../components/StateView';
import { colors, type, fonts, spacing, radius } from '../../theme';
import { kes } from '../../utils/format';
import {
  useRoutes, useVehicles, useDrivers, useAgents, useProducts, useCreateDispatch, useDispatchRegister,
} from '../../api/hooks';
import { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'CreateDispatch'>;
const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
type Line = { key: string; product_id?: number; quantity: string; price: string };

export default function CreateDispatchScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const routes = useRoutes();
  const vehicles = useVehicles();
  const drivers = useDrivers();
  const agents = useAgents();
  const products = useProducts();
  const create = useCreateDispatch();

  const [routeId, setRouteId] = useState<number | null>(null);
  const [vehicleId, setVehicleId] = useState<number | null>(null);
  const [driverId, setDriverId] = useState<number | null>(null);
  const [agentId, setAgentId] = useState<number | null>(null);
  // the API creates dispatches active by default now; off = keep it a draft
  const [activate, setActivate] = useState(true);
  const [lines, setLines] = useState<Line[]>([{ key: 'l1', quantity: '', price: '' }]);
  const [prefilledFrom, setPrefilledFrom] = useState<string | null>(null);

  // The crew that ran this route last time — the app's stand-in for the web's
  // route assignments, which the mobile API doesn't expose.
  const register = useDispatchRegister();

  const routeOpts = (routes.data ?? []).map((r: any) => ({ label: r.name, value: num(r.id) }));
  const vehicleOpts = (vehicles.data ?? []).map((v: any) => ({ label: v.registration_number, value: num(v.id), sub: [v.make, v.model].filter(Boolean).join(' ') }));
  // driver_id / agent_id are USER ids per the spec
  const driverOpts = (drivers.data ?? []).map((d: any) => ({ label: `${d.first_name ?? ''} ${d.last_name ?? ''}`.trim() || `Driver ${d.id}`, value: num(d.user_id ?? d.id) }));
  const agentOpts = (agents.data ?? []).map((a: any) => ({ label: `${a.first_name ?? ''} ${a.last_name ?? ''}`.trim() || `Agent ${a.id}`, value: num(a.user_id ?? a.id) }));
  const productOpts = (products.data ?? []).map((p: any) => ({ label: p.name, value: num(p.id), sub: kes(num(p.price)) }));

  const productPrice = (pid?: number) => num((products.data ?? []).find((p: any) => num(p.id) === pid)?.price);

  /** Resolve a dispatch's driver/agent (name + id) to the USER id create expects. */
  const toUserId = (ref: { id?: number; name?: string } | null | undefined, people: any[]) => {
    if (!ref) return null;
    const name = String(ref.name ?? '').trim().toLowerCase();
    if (name) {
      const hit = people.find(
        (p) => `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim().toLowerCase() === name
      );
      if (hit) return num(hit.user_id ?? hit.id);
    }
    // fall back to whatever id the dispatch carried (0 = unassigned)
    return num(ref.id) || null;
  };

  // Prefill vehicle / driver / agent from the most recent dispatch on this route.
  useEffect(() => {
    if (!routeId) return;
    const recent = (register.data ?? [])
      .filter((d) => num(d.route?.id) === routeId)
      .sort((a, b) => String(b.dispatch_date ?? '').localeCompare(String(a.dispatch_date ?? '')))[0];
    if (!recent) {
      setPrefilledFrom(null);
      return;
    }
    const v = num(recent.vehicle?.id) || null;
    const d = toUserId(recent.driver, (drivers.data ?? []) as any[]);
    const a = toUserId(recent.agent, (agents.data ?? []) as any[]);
    if (v) setVehicleId(v);
    if (d) setDriverId(d);
    if (a) setAgentId(a);
    setPrefilledFrom(v || d || a ? recent.order_number ?? recent.dispatch_date ?? null : null);
  }, [routeId, register.data, drivers.data, agents.data]); // eslint-disable-line react-hooks/exhaustive-deps

  const total = useMemo(() => lines.reduce((s, l) => s + num(l.quantity) * num(l.price), 0), [lines]);

  const setLine = (key: string, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const addLine = () => setLines((ls) => [...ls, { key: `l${Date.now()}`, quantity: '', price: '' }]);
  const removeLine = (key: string) => setLines((ls) => (ls.length > 1 ? ls.filter((l) => l.key !== key) : ls));

  const submit = () => {
    if (!routeId || !vehicleId) return Alert.alert('Missing fields', 'Select a route and a vehicle.');
    const items = lines
      .filter((l) => l.product_id && num(l.quantity) > 0)
      .map((l) => ({ product_id: l.product_id as number, quantity: num(l.quantity), price: num(l.price) }));
    if (items.length === 0) return Alert.alert('Add items', 'Add at least one product line with a quantity.');
    create.mutate(
      {
        vehicle_id: vehicleId,
        route_id: routeId,
        // optional — the server falls back to the vehicle's driver / route's agent
        driver_id: driverId ?? undefined,
        agent_id: agentId ?? undefined,
        items,
        activate,
      },
      {
        onSuccess: () => { Alert.alert('Dispatch created', activate ? 'Marked active.' : 'Saved as draft.'); navigation.goBack(); },
        onError: (e) => Alert.alert('Failed', (e as Error).message),
      }
    );
  };

  const loading = routes.isLoading || vehicles.isLoading || drivers.isLoading || agents.isLoading || products.isLoading;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.marginMobile, paddingBottom: spacing.xl }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <ScreenTitleBar title="New Dispatch" onBack={() => navigation.goBack()} showSync={false} />

      {loading ? (
        <Loading label="Loading options…" />
      ) : (
        <>
          <View style={{ gap: spacing.md }}>
            <Select label="Route" value={routeId} options={routeOpts} onChange={(v) => setRouteId(num(v))} placeholder="Select route" />
            <Select label="Vehicle" value={vehicleId} options={vehicleOpts} onChange={(v) => setVehicleId(num(v))} placeholder="Select vehicle" />
            <Select label="Driver (optional)" value={driverId} options={driverOpts} onChange={(v) => setDriverId(num(v))} placeholder="Auto — vehicle's current driver" />
            <Select label="Agent (optional)" value={agentId} options={agentOpts} onChange={(v) => setAgentId(num(v))} placeholder="Auto — route's current agent" />
          </View>

          {prefilledFrom && (
            <View style={styles.prefillNote}>
              <Ionicons name="sparkles-outline" size={16} color={colors.secondary} />
              <Text style={styles.prefillText}>
                Vehicle, driver and agent filled in from this route's last dispatch ({prefilledFrom}). Change or clear them —
                left empty, the server uses the vehicle's current driver and the route's current agent.
              </Text>
            </View>
          )}

          <Text style={styles.section}>Load Items</Text>
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

          <View style={styles.activateRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.activateLabel}>Activate immediately</Text>
              <Text style={styles.activateSub}>On by default. Off = saved as a draft.</Text>
            </View>
            <Switch value={activate} onValueChange={setActivate} trackColor={{ true: colors.primaryContainer, false: colors.outlineVariant }} thumbColor={colors.surfaceContainerLowest} />
          </View>

          <PrimaryButton label="Create Dispatch" icon="cube-outline" iconRight={false} style={{ marginTop: spacing.lg }} onPress={submit} disabled={create.isPending} />
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  section: { ...type.headlineLgMobile, color: colors.onSurface, marginTop: spacing.xl, marginBottom: spacing.md },
  prefillNote: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, backgroundColor: colors.surfaceContainerHigh, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.md },
  prefillText: { ...type.bodySm, color: colors.onSurfaceVariant, flex: 1 },
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
  activateRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceContainerHigh, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.lg },
  activateLabel: { ...type.titleMd, color: colors.onSurface },
  activateSub: { ...type.bodySm, color: colors.onSurfaceVariant, marginTop: 2 },
});
