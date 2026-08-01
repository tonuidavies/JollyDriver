import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, RefreshControl, TextInput } from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CompositeScreenProps } from '@react-navigation/native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Card, ScreenTitleBar, StatusBadge } from '../../components';
import { Loading, ErrorState, EmptyState } from '../../components/StateView';
import { colors, type, fonts, spacing, radius } from '../../theme';
import { useRoutes } from '../../api/hooks';
import { AdminTabsParamList, RootStackParamList } from '../../navigation/types';

type Props = CompositeScreenProps<
  BottomTabScreenProps<AdminTabsParamList, 'Route'>,
  NativeStackScreenProps<RootStackParamList>
>;

export default function AdminDriverLedger({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { data, isLoading, isError, error, refetch, isRefetching } = useRoutes();
  const [q, setQ] = useState('');

  const routes = (data ?? []).filter((r) => r.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.marginMobile, paddingBottom: spacing.xl }}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
      showsVerticalScrollIndicator={false}
    >
      <ScreenTitleBar title="Reconciliation" />

      <Text style={styles.subtitle}>Pick a route to reconcile dispatched vs collected and confirm returns.</Text>

      <View style={styles.search}>
        <Ionicons name="search" size={20} color={colors.outline} />
        <TextInput style={styles.searchInput} placeholder="Search routes…" placeholderTextColor={colors.outline} value={q} onChangeText={setQ} />
      </View>

      {isLoading ? (
        <Loading />
      ) : isError ? (
        <ErrorState message={(error as Error)?.message} onRetry={refetch} />
      ) : routes.length === 0 ? (
        <EmptyState icon="map-outline" message="No routes found." />
      ) : (
        routes.map((r) => (
          <Pressable key={r.id} onPress={() => navigation.navigate('RouteRecon', { routeId: r.id, routeName: r.name })}>
            <Card style={styles.routeCard}>
              <View style={styles.routeIcon}>
                <MaterialCommunityIcons name="map-marker-path" size={22} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.routeName}>{r.name}</Text>
                {r.description ? <Text style={styles.routeDesc} numberOfLines={1}>{r.description}</Text> : null}
              </View>
              {!r.has_account && <StatusBadge label="NO ACCOUNT" tone="error" />}
              <Ionicons name="chevron-forward" size={20} color={colors.outline} style={{ marginLeft: spacing.sm }} />
            </Card>
          </Pressable>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  subtitle: { ...type.bodyLg, color: colors.onSurfaceVariant, marginBottom: spacing.md },
  search: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.outlineVariant, paddingHorizontal: spacing.md, height: 56, marginBottom: spacing.md,
  },
  searchInput: { flex: 1, ...type.bodyLg, color: colors.onSurface },
  routeCard: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  routeIcon: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.surfaceContainerHigh, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md },
  routeName: { ...type.titleMd, fontFamily: fonts.sansBold, color: colors.onSurface },
  routeDesc: { ...type.bodySm, color: colors.onSurfaceVariant, marginTop: 2 },
});
