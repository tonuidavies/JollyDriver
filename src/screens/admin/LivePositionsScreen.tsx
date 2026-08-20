import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, RefreshControl, Linking, Share } from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Card, ScreenTitleBar, FleetMap } from '../../components';
import { MapVehicle } from '../../components/FleetMap';
import { Loading, ErrorState, EmptyState } from '../../components/StateView';
import { colors, type, fonts, spacing, radius } from '../../theme';
import { useVehiclePositions } from '../../api/hooks';
import { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'LivePositions'>;

const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const str = (r: any, keys: string[], fallback = '') => {
  for (const k of keys) {
    const v = r?.[k];
    if (v == null || v === '') continue;
    // some payloads nest {name: …}; never stringify a raw object
    if (typeof v === 'object') {
      const nested = (v as any).name ?? (v as any).registration_number;
      if (nested) return String(nested);
      continue;
    }
    return String(v);
  }
  return fallback;
};

/** Plain-English state, never the storage layer the API happens to use. */
type State = 'moving' | 'parked' | 'stale' | 'nosignal';

const STATE_META: Record<State, { label: string; tone: string; icon: any; blurb: string }> = {
  moving: { label: 'On the move', tone: colors.success, icon: 'truck-fast-outline', blurb: 'Reporting now' },
  parked: { label: 'Parked', tone: colors.primary, icon: 'truck-outline', blurb: 'Reporting, not moving' },
  stale: { label: 'Out of touch', tone: colors.onWarningContainer, icon: 'timer-sand', blurb: "Hasn't reported recently" },
  nosignal: { label: 'No signal', tone: colors.outline, icon: 'signal-off', blurb: 'No position on record' },
};

function ago(ms: number): string {
  const mins = Math.round((Date.now() - ms) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs === 1 ? '' : 's'} ago`;
  const days = Math.round(hrs / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

/** "2026-08-20 16:48:03" (server local time) → "12 min ago" */
function since(ts?: string): string {
  if (!ts) return '';
  const t = new Date(String(ts).replace(' ', 'T')).getTime();
  return Number.isNaN(t) ? String(ts) : ago(t);
}

const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const bearingLabel = (deg?: number) => {
  if (typeof deg !== 'number' || !Number.isFinite(deg)) return '';
  const d = ((deg % 360) + 360) % 360; // tolerate negatives
  return COMPASS[Math.round(d / 45) % 8];
};

type Row = {
  key: string;
  reg: string;
  route: string;
  driver: string;
  lat: number;
  lng: number;
  speed: number;
  heading?: number;
  recordedAt: string;
  state: State;
  /** true when the API served it from its durable fallback rather than the live cache */
  fromBackup: boolean;
  hasFix: boolean;
};

export default function LivePositionsScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { data, isLoading, isError, error, refetch, isRefetching, dataUpdatedAt } = useVehiclePositions();
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState<State | 'all'>('all');

  const rows: Row[] = useMemo(() => {
    const root: any = (data as any)?.data ?? data;
    let raw: any[] = [];
    if (Array.isArray(root)) raw = root;
    else {
      for (const k of ['vehicles', 'rows', 'positions']) if (Array.isArray(root?.[k])) { raw = root[k]; break; }
      if (raw.length === 0) {
        const arrays = Object.values(root ?? {}).filter(Array.isArray) as any[][];
        raw = arrays.sort((a, b) => b.length - a.length)[0] ?? [];
      }
    }

    return raw.map((v, i) => {
      const pos = v.position ?? v.last_position ?? null;
      const lat = num(pos?.latitude ?? pos?.lat);
      const lng = num(pos?.longitude ?? pos?.lng ?? pos?.lon);
      const hasFix = !!pos && (lat !== 0 || lng !== 0);
      const speed = num(pos?.speed);
      const freshness = str(v, ['freshness'], 'no_data').toLowerCase();
      const recordedAt = str(pos, ['recorded_at', 'timestamp', 'time', 'updated_at', 'created_on']);

      let state: State;
      if (!hasFix || freshness === 'no_data') state = 'nosignal';
      else if (freshness === 'stale' || freshness === 'offline') state = 'stale';
      else state = speed > 3 ? 'moving' : 'parked';

      return {
        key: `${v.vehicle_id ?? v.id ?? 'v'}-${i}`,
        reg: str(v, ['registration_number', 'vehicle', 'name'], `Vehicle ${v.id ?? i + 1}`),
        route: str(v, ['route_name', 'route']),
        driver: str(v, ['driver_name', 'driver']),
        lat,
        lng,
        speed,
        heading: pos?.heading != null || pos?.bearing != null ? num(pos?.heading ?? pos?.bearing) : undefined,
        recordedAt,
        state,
        fromBackup: String(v.source ?? '').toLowerCase() === 'db',
        hasFix,
      };
    });
  }, [data]);

  const counts = useMemo(() => {
    const c: Record<State, number> = { moving: 0, parked: 0, stale: 0, nosignal: 0 };
    rows.forEach((r) => { c[r.state] += 1; });
    return c;
  }, [rows]);

  const shown = useMemo(
    () => (filter === 'all' ? rows : rows.filter((r) => r.state === filter)),
    [rows, filter]
  );
  const plotted = useMemo<MapVehicle[]>(
    () =>
      shown
        .filter((r) => r.hasFix)
        .map((r) => ({
          key: r.key,
          label: r.reg,
          lat: r.lat,
          lng: r.lng,
          heading: r.heading,
          moving: r.state === 'moving',
          tone: STATE_META[r.state].tone,
        })),
    [shown]
  );

  const focused = rows.find((r) => r.key === selected) ?? null;

  const openMap = (r: Row) =>
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${r.lat},${r.lng}`).catch(() => {});

  const shareLocation = (r: Row) =>
    Share.share({
      message: [
        `${r.reg}${r.route ? ` · ${r.route}` : ''}`,
        r.recordedAt ? `Last seen ${since(r.recordedAt)} (${r.recordedAt})` : '',
        `https://www.google.com/maps/search/?api=1&query=${r.lat},${r.lng}`,
      ]
        .filter(Boolean)
        .join('\n'),
    }).catch(() => {});

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.marginMobile, paddingBottom: spacing.xl }}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
      showsVerticalScrollIndicator={false}
    >
      <ScreenTitleBar title="Where's the fleet?" onBack={() => navigation.goBack()} />

      {isLoading ? (
        <Loading label="Locating vehicles…" />
      ) : isError ? (
        <ErrorState message={(error as Error)?.message} onRetry={refetch} />
      ) : rows.length === 0 ? (
        <EmptyState icon="navigate-outline" message="No vehicles have a tracker fitted." />
      ) : (
        <>
          {/* Fleet overview */}
          <View style={styles.statRow}>
            {(['moving', 'parked', 'stale', 'nosignal'] as State[]).map((s) => {
              const m = STATE_META[s];
              const active = filter === s;
              return (
                <Pressable
                  key={s}
                  style={[styles.stat, active && { backgroundColor: colors.primaryContainer }]}
                  onPress={() => { setFilter(active ? 'all' : s); setSelected(null); }}
                >
                  <MaterialCommunityIcons name={m.icon} size={18} color={active ? colors.onSecondaryFixed : m.tone} />
                  <Text style={[styles.statCount, active && { color: colors.onSecondaryFixed }]}>{counts[s]}</Text>
                  <Text style={[styles.statLabel, active && { color: colors.onSecondaryFixed }]} numberOfLines={1}>
                    {m.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.updated}>
            {rows.length} tracked · updated {dataUpdatedAt ? ago(dataUpdatedAt) : 'just now'} · refreshes itself every minute
            {filter !== 'all' ? ` · showing ${STATE_META[filter as State].label.toLowerCase()} only` : ''}
          </Text>

          <FleetMap vehicles={plotted} selectedKey={selected} onSelect={setSelected} />

          {/* Focused vehicle */}
          {focused && (
            <Card style={styles.focusCard}>
              <View style={styles.focusHead}>
                <View style={[styles.focusIcon, { backgroundColor: colors.surfaceContainerHigh }]}>
                  <MaterialCommunityIcons name={STATE_META[focused.state].icon} size={22} color={STATE_META[focused.state].tone} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.focusReg}>{focused.reg}</Text>
                  <Text style={styles.focusSub}>
                    {[focused.route, focused.driver].filter(Boolean).join(' · ') || STATE_META[focused.state].blurb}
                  </Text>
                </View>
                <Pressable hitSlop={8} onPress={() => setSelected(null)}>
                  <Ionicons name="close" size={20} color={colors.onSurfaceVariant} />
                </Pressable>
              </View>

              <View style={styles.focusFacts}>
                <Fact label="Status" value={STATE_META[focused.state].label} tone={STATE_META[focused.state].tone} />
                {focused.hasFix && <Fact label="Speed" value={`${Math.round(focused.speed)} km/h`} />}
                {focused.hasFix && !!bearingLabel(focused.heading) && <Fact label="Heading" value={bearingLabel(focused.heading)} />}
                <Fact label="Last seen" value={focused.recordedAt ? since(focused.recordedAt) : 'never'} />
              </View>

              {focused.hasFix ? (
                <>
                  <Text style={styles.coords}>{focused.lat.toFixed(5)}, {focused.lng.toFixed(5)}</Text>
                  <View style={styles.focusActions}>
                    <Pressable style={styles.focusBtn} onPress={() => openMap(focused)}>
                      <Ionicons name="map-outline" size={16} color={colors.onSecondaryFixed} />
                      <Text style={styles.focusBtnText}>Open in Maps</Text>
                    </Pressable>
                    <Pressable style={[styles.focusBtn, styles.focusBtnGhost]} onPress={() => shareLocation(focused)}>
                      <Ionicons name="share-outline" size={16} color={colors.secondary} />
                      <Text style={[styles.focusBtnText, { color: colors.secondary }]}>Share location</Text>
                    </Pressable>
                  </View>
                  {focused.fromBackup && (
                    <Text style={styles.backupNote}>
                      This is the last position we have on file — the live feed didn't have a newer one.
                    </Text>
                  )}
                </>
              ) : (
                <Text style={styles.backupNote}>
                  This vehicle has never reported a position. Check the tracker is fitted and powered.
                </Text>
              )}
            </Card>
          )}

          {/* Roll call */}
          <Text style={styles.section}>{filter === 'all' ? 'All vehicles' : STATE_META[filter as State].label}</Text>
          {shown.length === 0 ? (
            <EmptyState icon="funnel-outline" message="Nothing in this group right now." />
          ) : (
            shown.map((r) => {
              const m = STATE_META[r.state];
              const active = selected === r.key;
              return (
                <Pressable key={r.key} onPress={() => setSelected(active ? null : r.key)}>
                  <Card style={[styles.row, active && styles.rowActive]}>
                    <View style={[styles.dot, { backgroundColor: m.tone }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.reg}>{r.reg}</Text>
                      <Text style={styles.meta} numberOfLines={1}>
                        {[
                          m.label,
                          r.state === 'moving' ? `${Math.round(r.speed)} km/h ${bearingLabel(r.heading)}`.trim() : '',
                          r.recordedAt ? since(r.recordedAt) : '',
                          r.route,
                        ]
                          .filter(Boolean)
                          .join('  ·  ')}
                      </Text>
                    </View>
                    <Ionicons name={active ? 'chevron-up' : 'chevron-forward'} size={18} color={colors.outline} />
                  </Card>
                </Pressable>
              );
            })
          )}
        </>
      )}
    </ScrollView>
  );
}

function Fact({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <View style={styles.fact}>
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={[styles.factValue, tone ? { color: tone } : null]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  statRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  stat: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: spacing.sm, borderRadius: radius.md, backgroundColor: colors.surfaceContainerHigh },
  statCount: { ...type.titleMd, fontFamily: fonts.sansBold, color: colors.onSurface },
  statLabel: { ...type.labelSm, fontSize: 9, color: colors.onSurfaceVariant },
  updated: { ...type.labelSm, fontSize: 10, color: colors.outline, marginBottom: spacing.md },

  focusCard: { marginBottom: spacing.lg, gap: spacing.md, borderWidth: 1, borderColor: colors.primaryContainer },
  focusHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  focusIcon: { width: 42, height: 42, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  focusReg: { ...type.titleMd, fontFamily: fonts.sansBold, fontSize: 17, color: colors.onSurface },
  focusSub: { ...type.bodySm, color: colors.onSurfaceVariant, marginTop: 2 },
  focusFacts: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  fact: { minWidth: 72 },
  factLabel: { ...type.labelSm, fontSize: 10, color: colors.onSurfaceVariant },
  factValue: { ...type.titleMd, fontSize: 15, color: colors.onSurface, marginTop: 2 },
  coords: { ...type.bodySm, fontFamily: fonts.monoMedium, color: colors.onSurfaceVariant },
  focusActions: { flexDirection: 'row', gap: spacing.sm },
  focusBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, height: 44, borderRadius: radius.md, backgroundColor: colors.primaryContainer },
  focusBtnGhost: { backgroundColor: colors.surfaceContainerHigh },
  focusBtnText: { ...type.labelSm, color: colors.onSecondaryFixed },
  backupNote: { ...type.bodySm, fontSize: 11, color: colors.onSurfaceVariant, fontStyle: 'italic' },

  section: { ...type.headlineLgMobile, color: colors.onSurface, marginBottom: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  rowActive: { borderWidth: 1, borderColor: colors.primaryContainer },
  dot: { width: 10, height: 10, borderRadius: 5 },
  reg: { ...type.titleMd, fontFamily: fonts.sansBold, color: colors.onSurface },
  meta: { ...type.bodySm, color: colors.onSurfaceVariant, marginTop: 2 },
});
