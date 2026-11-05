import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import Card from './Card';
import StatusBadge, { BadgeTone } from './StatusBadge';
import { colors, type, fonts, spacing, radius } from '../theme';
import { kes } from '../utils/format';
import { sheetDate } from '../utils/dispatchSheet';
import { DispatchOrder, DispatchStatus } from '../api/types';

/** Same colour for a status everywhere it shows */
export const DISPATCH_TONE: Record<DispatchStatus, BadgeTone> = {
  draft: 'neutral',
  pending: 'pending',
  active: 'info',
  completed: 'success',
  cancelled: 'error',
};

export default function DispatchCard({ order, onPress }: { order: DispatchOrder; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress}>
      <Card style={styles.card}>
        <View style={styles.iconWrap}>
          <MaterialCommunityIcons name="truck-outline" size={22} color={colors.primary} />
        </View>
        <View style={{ flex: 1, marginRight: spacing.xs }}>
          <View style={styles.topRow}>
            <Text style={styles.order}>{order.order_number}</Text>
            <StatusBadge label={order.status.toUpperCase()} tone={DISPATCH_TONE[order.status]} />
          </View>
          <View style={styles.metaRow}>
            <MaterialCommunityIcons
              name={!order.route && order.customer ? 'school-outline' : 'map-marker-path'}
              size={14}
              color={colors.onSurfaceVariant}
            />
            <Text style={styles.meta} numberOfLines={1}>
              {order.route?.name ?? order.customer?.name ?? 'No route'}
              {order.vehicle?.registration_number ? `  •  ${order.vehicle.registration_number}` : ''}
            </Text>
          </View>
          <View style={styles.bottomRow}>
            <Text style={styles.amount}>{kes(order.total_amount)}</Text>
            <Text style={styles.when} numberOfLines={1}>
              {sheetDate(order.dispatch_date)}{order.driver?.name ? ` · ${order.driver.name}` : ''}
            </Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.outline} />
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  iconWrap: {
    width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.surfaceContainerHigh,
    alignItems: 'center', justifyContent: 'center', marginRight: spacing.md,
  },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  order: { ...type.titleMd, fontFamily: fonts.sansBold, color: colors.onSurface },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: 2 },
  meta: { ...type.bodySm, color: colors.onSurfaceVariant, flex: 1 },
  bottomRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  when: { ...type.labelSm, color: colors.onSurfaceVariant, flex: 1, textAlign: 'right' },
  amount: { ...type.labelSm, fontSize: 14, fontFamily: fonts.monoSemibold, color: colors.primary, marginTop: spacing.xs },
});
