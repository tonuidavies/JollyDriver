import React from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Card, ScreenTitleBar } from '../../components';
import { colors, type, fonts, spacing, radius } from '../../theme';
import { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Reports'>;

const REPORTS: { kind: string; title: string; desc: string; icon: string }[] = [
  { kind: 'daily_recon', title: 'Daily Reconciliation', desc: 'Dispatched vs collected vs shortage, per vehicle', icon: 'scale-balance' },
  { kind: 'route_performance', title: 'Route Performance', desc: 'Dispatched, collected & rate per route', icon: 'map-marker-path' },
  { kind: 'agent_performance', title: 'Agent Performance', desc: 'Trips, shortages & accuracy per agent', icon: 'account-tie-outline' },
  { kind: 'shortage', title: 'Shortages', desc: 'Every dispatch with an EOD shortage', icon: 'alert-circle-outline' },
  { kind: 'overpayment', title: 'Overpayments', desc: 'Collections swept to company revenue', icon: 'cash-plus' },
  { kind: 'mpesa_recon', title: 'M-Pesa Reconciliation', desc: 'KCB/M-Pesa matched vs unmatched', icon: 'cellphone-check' },
  { kind: 'weekly_sales', title: 'Weekly Sales', desc: 'Units & revenue per product', icon: 'chart-bar' },
  { kind: 'monthly_sales_by_vehicle', title: 'Monthly Sales by Vehicle', desc: 'Net sales per vehicle, per day', icon: 'truck-outline' },
  { kind: 'lpo_sales', title: 'LPO / Credit Sales', desc: 'School/credit sales & invoicing status', icon: 'file-document-outline' },
  { kind: 'summary', title: 'Period Summary', desc: 'Totals + day-by-day chart', icon: 'chart-box-outline' },
  { kind: 'needs_attention', title: 'Needs Attention', desc: 'Vehicles short, open dispatches, overpayment', icon: 'bell-alert-outline' },
];

export default function ReportsScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.marginMobile, paddingBottom: spacing.xl }}
      showsVerticalScrollIndicator={false}
    >
      <ScreenTitleBar title="Reports" onBack={() => navigation.goBack()} showSync={false} />
      {REPORTS.map((r) => (
        <Pressable key={r.kind} onPress={() => navigation.navigate('ReportView', { kind: r.kind, title: r.title })}>
          <Card style={styles.row}>
            <View style={styles.icon}><MaterialCommunityIcons name={r.icon as any} size={24} color={colors.primary} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{r.title}</Text>
              <Text style={styles.desc}>{r.desc}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.outline} />
          </Card>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  icon: { width: 46, height: 46, borderRadius: radius.md, backgroundColor: colors.surfaceContainerHigh, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md },
  title: { ...type.titleMd, fontFamily: fonts.sansBold, color: colors.onSurface },
  desc: { ...type.bodySm, color: colors.onSurfaceVariant, marginTop: 2 },
});
