import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, RefreshControl, Linking } from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Card, ScreenTitleBar, StatusBadge } from '../../components';
import { Loading, ErrorState, EmptyState } from '../../components/StateView';
import { colors, type, fonts, spacing, radius } from '../../theme';
import { useVehiclePositions } from '../../api/hooks';
import { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'LivePositions'>;
const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const str = (r: any, keys: string[], fallback = '') => {
  for (const k of keys) if (r?.[k] != null && r[k] !== '') return String(r[k]);
  return fallback;
};

const FRESHNESS_TONE: Record<string, 'success' | 'partial' | 'pending' | 'error' | 'neutral'> = {
  live: 'success', fresh: 'success', recent: 'partial', stale: 'pending', no_data: 'neutral', offline: 'error',
};

/**
 * Read-only GPS feed (`tracking/vehicles`). Positions are written by a separate
 * cron job — a vehicle that has never reported in comes back with no position
 * and freshness "no_data". `source` is "redis" normally, "db" when it was
 * served from the durable fallback instead.
 */
export default function LivePositionsScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { data, isLoading, isError, error, refetch, isRefetching } = useVehiclePositions();

  const rows = useMemo(() => {
    const root: any = (data as any)?.data ?? data;
    if (Array.isArray(root)) return root;
    for (const k of ['vehicles', 'rows', 'positions']) if (Array.isArray(root?.[k])) return root[k];
    const arrays = Object.values(root ?? {}).filter(Array.isArray) as any[][];
    return arrays.sort((a, b) => b.length - a.length)[0] ?? [];
  }, [data]);

  const openMap = (lat: number, lng: number, label: string) => {
    const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
    Linking.openURL(url).catch(() => {});
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.marginMobile, paddingBottom: spacing.xl }}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
      showsVerticalScrollIndicator={false}
    >
      <ScreenTitleBar title="Live Positions" onBack={() => navigation.goBack()} />
      <Text style={styles.blurb}>Last-known position per tracked vehicle. Refreshes every minute.</Text>

      {isLoading ? (
        <Loading label="Locating vehicles…" />
      ) : isError ? (
        <ErrorState message={(error as Error)?.message} onRetry={refetch} />
      ) : rows.length === 0 ? (
        <EmptyState icon="navigate-outline" message="No vehicles have a linked tracker." />
      ) : (
        rows.map((v: any, i: number) => {
          const pos = v.position ?? v.last_position ?? null;
          const lat = num(pos?.latitude ?? pos?.lat);
          const lng = num(pos?.longitude ?? pos?.lng ?? pos?.lon);
          const freshness = str(v, ['freshness'], 'no_data');
          const reg = str(v, ['registration_number', 'vehicle', 'name'], `Vehicle ${v.id ?? i}`);
          const hasFix = !!pos && (lat !== 0 || lng !== 0);
          return (
            <Card key={`${v.id ?? reg}-${i}`} style={styles.row}>
              <View style={styles.icon}>
                <MaterialCommunityIcons name="truck-outline" size={22} color={hasFix ? colors.primary : colors.outline} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.reg}>{reg}</Text>
                <Text style={styles.meta} numberOfLines={1}>
                  {hasFix
                    ? [
                        `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
                        pos?.speed != null ? `${Math.round(num(pos.speed))} km/h` : '',
                        str(pos, ['recorded_at', 'timestamp', 'time', 'updated_at']),
                      ]
                        .filter(Boolean)
                        .join('  ·  ')
                    : 'Never reported in'}
                </Text>
                {!!v.source && <Text style={styles.source}>source: {String(v.source)}</Text>}
              </View>
              <View style={{ alignItems: 'flex-end', gap: spacing.xs }}>
                <StatusBadge
                  label={freshness.replace('_', ' ').toUpperCase()}
                  tone={FRESHNESS_TONE[freshness] ?? 'neutral'}
                  mono={false}
                />
                {hasFix && (
                  <Pressable hitSlop={8} onPress={() => openMap(lat, lng, reg)} style={styles.mapBtn}>
                    <Ionicons name="map-outline" size={16} color={colors.secondary} />
                    <Text style={styles.mapText}>Map</Text>
                  </Pressable>
                )}
              </View>
            </Card>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  blurb: { ...type.bodySm, color: colors.onSurfaceVariant, marginBottom: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  icon: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.surfaceContainerHigh, alignItems: 'center', justifyContent: 'center' },
  reg: { ...type.titleMd, fontFamily: fonts.sansBold, color: colors.onSurface },
  meta: { ...type.bodySm, color: colors.onSurfaceVariant, marginTop: 2 },
  source: { ...type.labelSm, fontSize: 10, color: colors.outline, marginTop: 2 },
  mapBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  mapText: { ...type.labelSm, color: colors.secondary },
});
