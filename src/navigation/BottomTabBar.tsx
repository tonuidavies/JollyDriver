import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, type, spacing, radius } from '../theme';

const ICONS: Record<string, { lib: 'ion' | 'mci'; active: string; inactive: string }> = {
  Home: { lib: 'ion', active: 'home', inactive: 'home-outline' },
  Route: { lib: 'mci', active: 'map-marker-path', inactive: 'map-marker-path' },
  Collections: { lib: 'mci', active: 'truck', inactive: 'truck-outline' },
  Profile: { lib: 'ion', active: 'person', inactive: 'person-outline' },
};

/**
 * Clean MD3 bottom nav: icon sits in an orange pill when active, with a
 * small label beneath. Vertical layout keeps each item narrow and uncluttered.
 */
export default function BottomTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const conf = ICONS[route.name] ?? ICONS.Home;
        const iconColor = focused ? colors.onSecondaryFixed : colors.onSurfaceVariant;

        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
        };

        return (
          <Pressable key={route.key} onPress={onPress} style={styles.item} hitSlop={6}>
            <View style={[styles.iconPill, focused && styles.iconPillActive]}>
              {conf.lib === 'ion' ? (
                <Ionicons name={(focused ? conf.active : conf.inactive) as any} size={22} color={iconColor} />
              ) : (
                <MaterialCommunityIcons name={(focused ? conf.active : conf.inactive) as any} size={22} color={iconColor} />
              )}
            </View>
            <Text
              style={[
                styles.label,
                { color: focused ? colors.onSurface : colors.onSurfaceVariant },
                focused && styles.labelActive,
              ]}
              numberOfLines={1}
            >
              {route.name}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.outlineVariant,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  iconPill: {
    height: 32,
    minWidth: 56,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconPillActive: {
    backgroundColor: colors.primaryContainer,
  },
  label: {
    ...type.labelSm,
    fontSize: 11,
    letterSpacing: 0.2,
    marginTop: spacing.xs,
  },
  labelActive: {
    fontFamily: type.titleMd.fontFamily,
  },
});
