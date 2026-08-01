import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import Card from './Card';
import StatusBadge, { BadgeTone } from './StatusBadge';
import { colors, type, fonts, spacing, radius } from '../theme';
import { kes } from '../utils/format';
import { DispatchOrder, DispatchStatus } from '../api/types';

const TONE: Record<DispatchStatus, BadgeTone> = {
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
        <View style={{ flex: 1 }}>
          <View style={styles.topRow}>
            <Text style={styles.order}>{order.order_number}</Text>
            <StatusBadge label={order.status.toUpperCase()} tone={TONE[order.status]} />
          </View>
          <View style={styles.metaRow}>
            <MaterialCommunityIcons name="map-marker-path" size={14} color={colors.onSurfaceVariant} />
            <Text style={styles.meta}>{order.route?.name ?? 'No route'}</Text>
            {order.vehicle?.registration_number ? (
              <>
                <Text style={styles.dot}>•</Text>
                <Text style={styles.meta}>{order.vehicle.registration_number}</Text>
              </>
            ) : null}
          </View>
          <Text style={styles.amount}>{kes(order.total_amount)}</Text>
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
  meta: { ...type.bodySm, color: colors.onSurfaceVariant },
  dot: { color: colors.outline },
  amount: { ...type.labelSm, fontSize: 14, fontFamily: fonts.monoSemibold, color: colors.primary, marginTop: spacing.xs },
});
