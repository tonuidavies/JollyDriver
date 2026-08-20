import React, { useEffect, useRef } from 'react';
import { View, Text, Pressable, Animated, StyleSheet, Dimensions, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';

import { colors, type, fonts, spacing, radius } from '../theme';
import { useMenu } from '../context/MenuContext';
import { useAuth } from '../context/AuthContext';
import { navigate } from '../navigation/ref';

const WIDTH = Math.min(320, Dimensions.get('window').width * 0.84);

type Item = { label: string; icon: string; route: string };

const ADMIN_ITEMS: Item[] = [
  { label: 'Dashboard', icon: 'view-dashboard-outline', route: 'Home' },
  { label: 'Reconciliation', icon: 'scale-balance', route: 'Route' },
  { label: 'Monthly Ledger', icon: 'calendar-month-outline', route: 'Collections' },
  { label: 'Team', icon: 'account-group-outline', route: 'Profile' },
];
const DRIVER_ITEMS: Item[] = [
  { label: 'Dashboard', icon: 'view-dashboard-outline', route: 'Home' },
  { label: 'My Dispatches', icon: 'truck-outline', route: 'Route' },
  { label: 'Collections', icon: 'cash-multiple', route: 'Collections' },
  { label: 'My Commission', icon: 'percent-outline', route: 'Commissions' },
  { label: 'Profile', icon: 'account-outline', route: 'Profile' },
];
/** Admin modules, grouped the same way the web sidebar groups them. */
const FLEET_MODULES: Item[] = [
  { label: 'Dispatches', icon: 'clipboard-list-outline', route: 'Dispatches' },
  { label: 'New Dispatch', icon: 'plus-box-outline', route: 'CreateDispatch' },
  { label: 'School Dispatch', icon: 'school-outline', route: 'SchoolDispatch' },
  { label: 'Vehicles', icon: 'truck', route: 'Vehicles' },
  { label: 'Live Positions', icon: 'map-marker-radius-outline', route: 'LivePositions' },
  { label: 'Agents', icon: 'account-tie-outline', route: 'Agents' },
  { label: 'Schools & Customers', icon: 'store-outline', route: 'Customers' },
];
const FINANCE_MODULES: Item[] = [
  { label: 'Invoices', icon: 'file-document-outline', route: 'Invoices' },
  { label: 'Shortages', icon: 'alert-circle-outline', route: 'Shortages' },
  { label: 'Commissions', icon: 'percent-outline', route: 'Commissions' },
  { label: 'Reports', icon: 'chart-box-outline', route: 'Reports' },
];

export default function SideMenu() {
  const { visible, close } = useMenu();
  const insets = useSafeAreaInsets();
  const { user, activeView, isAdmin, isDriver, setActiveView, signOut } = useAuth();
  const [mounted, setMounted] = React.useState(visible);
  const slide = useRef(new Animated.Value(-WIDTH)).current;
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.parallel([
        Animated.timing(slide, { toValue: 0, duration: 220, useNativeDriver: true }),
        Animated.timing(fade, { toValue: 1, duration: 220, useNativeDriver: true }),
      ]).start();
    } else if (mounted) {
      Animated.parallel([
        Animated.timing(slide, { toValue: -WIDTH, duration: 200, useNativeDriver: true }),
        Animated.timing(fade, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start(({ finished }) => finished && setMounted(false));
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!mounted) return null;

  const items = activeView === 'admin' ? ADMIN_ITEMS : DRIVER_ITEMS;
  const go = (routeName?: string) => {
    close();
    if (routeName) setTimeout(() => navigate(routeName), 80);
  };

  const name = `${user?.first_name ?? ''} ${user?.last_name ?? ''}`.trim() || 'Jolly';

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View style={[StyleSheet.absoluteFill, styles.scrim, { opacity: fade }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} />
      </Animated.View>

      <Animated.View style={[styles.panel, { width: WIDTH, paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.md, transform: [{ translateX: slide }] }]}>
        {/* Brand */}
        <View style={styles.brand}>
          <View style={styles.logo}><MaterialCommunityIcons name="baguette" size={26} color={colors.onSecondaryFixed} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.brandName}>Jolly Bakery</Text>
            <Text style={styles.brandSub}>Operations</Text>
          </View>
          <Pressable onPress={close} hitSlop={10}><Ionicons name="close" size={24} color={colors.onSurfaceVariant} /></Pressable>
        </View>

        <View style={styles.userRow}>
          <View style={styles.userAvatar}><Text style={styles.userInitials}>{(user?.first_name?.[0] ?? 'U') + (user?.last_name?.[0] ?? '')}</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.userName} numberOfLines={1}>{name}</Text>
            <Text style={styles.userRole}>{activeView === 'admin' ? 'Admin' : 'Driver / Agent'}</Text>
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
          {items.map((it) => (
            <Pressable key={it.label} style={styles.item} onPress={() => go(it.route)}>
              <MaterialCommunityIcons name={it.icon as any} size={22} color={colors.primary} />
              <Text style={styles.itemLabel}>{it.label}</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.outlineVariant} />
            </Pressable>
          ))}

          {activeView === 'admin' && (
            <>
              <Text style={styles.groupLabel}>FLEET</Text>
              {FLEET_MODULES.map((it) => (
                <Pressable key={it.label} style={styles.item} onPress={() => go(it.route)}>
                  <MaterialCommunityIcons name={it.icon as any} size={22} color={colors.secondary} />
                  <Text style={styles.itemLabel}>{it.label}</Text>
                  <Ionicons name="chevron-forward" size={18} color={colors.outlineVariant} />
                </Pressable>
              ))}

              <Text style={styles.groupLabel}>FINANCE</Text>
              {FINANCE_MODULES.map((it) => (
                <Pressable key={it.label} style={styles.item} onPress={() => go(it.route)}>
                  <MaterialCommunityIcons name={it.icon as any} size={22} color={colors.secondary} />
                  <Text style={styles.itemLabel}>{it.label}</Text>
                  <Ionicons name="chevron-forward" size={18} color={colors.outlineVariant} />
                </Pressable>
              ))}
            </>
          )}
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          {isAdmin && activeView !== 'admin' && (
            <Pressable style={styles.footBtn} onPress={() => { close(); setActiveView('admin'); }}>
              <Ionicons name="swap-horizontal" size={20} color={colors.secondary} />
              <Text style={styles.footText}>Switch to Admin</Text>
            </Pressable>
          )}
          {isDriver && activeView !== 'driver' && (
            <Pressable style={styles.footBtn} onPress={() => { close(); setActiveView('driver'); }}>
              <Ionicons name="swap-horizontal" size={20} color={colors.secondary} />
              <Text style={styles.footText}>Switch to Driver</Text>
            </Pressable>
          )}
          <Pressable style={[styles.footBtn, styles.logout]} onPress={() => { close(); signOut(); }}>
            <Ionicons name="log-out-outline" size={20} color={colors.onPrimary} />
            <Text style={[styles.footText, { color: colors.onPrimary }]}>Log Out</Text>
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: { backgroundColor: 'rgba(33,26,20,0.45)' },
  panel: { position: 'absolute', top: 0, bottom: 0, left: 0, backgroundColor: colors.surface, paddingHorizontal: spacing.md, borderTopRightRadius: radius.xl, borderBottomRightRadius: radius.xl },
  brand: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg },
  logo: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.primaryContainer, alignItems: 'center', justifyContent: 'center' },
  brandName: { ...type.titleMd, fontFamily: fonts.sansBold, fontSize: 18, color: colors.primary },
  brandSub: { ...type.labelSm, color: colors.onSurfaceVariant },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surfaceContainerHigh, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md },
  userAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primaryFixed, alignItems: 'center', justifyContent: 'center' },
  userInitials: { ...type.titleMd, color: colors.onSecondaryFixed, fontSize: 15 },
  userName: { ...type.titleMd, color: colors.onSurface },
  userRole: { ...type.labelSm, color: colors.onSurfaceVariant },
  item: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, paddingHorizontal: spacing.sm, borderRadius: radius.md },
  itemLabel: { ...type.titleMd, color: colors.onSurface, flex: 1 },
  groupLabel: { ...type.labelSm, color: colors.onSurfaceVariant, marginTop: spacing.lg, marginBottom: spacing.xs, paddingHorizontal: spacing.sm },
  soonBadge: { ...type.labelSm, fontSize: 10, color: colors.onSurfaceVariant, backgroundColor: colors.surfaceContainerHigh, paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.full },
  footer: { gap: spacing.sm, marginTop: spacing.sm },
  footBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, height: 48, borderRadius: radius.md, backgroundColor: colors.surfaceContainerHigh },
  footText: { ...type.titleMd, color: colors.secondary },
  logout: { backgroundColor: colors.primary },
});
