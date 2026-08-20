import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Share, Linking, Alert } from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';

import Card from './Card';
import { colors, type, fonts, spacing, radius } from '../theme';
import { kes } from '../utils/format';
import { DispatchPayment, PaymentsTotal } from '../api/types';

const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const PAGE = 8;

type Filter = 'all' | 'cash' | 'mpesa' | 'voided';

type Props = {
  payments: DispatchPayment[];
  /** server-provided totals; recomputed locally when absent */
  totals?: PaymentsTotal;
  title?: string;
  /** which rows may be voided / corrected (manual cash only) */
  canEdit?: (p: DispatchPayment) => boolean;
  onVoid?: (p: DispatchPayment) => void;
  onCorrect?: (p: DispatchPayment) => void;
  /** label used in the exported file name / share title */
  exportName?: string;
  emptyLabel?: string;
};

const methodOf = (p: DispatchPayment) => String(p.collection_method ?? '').toLowerCase();
const isAuto = (p: DispatchPayment) => String(p.source ?? '').toLowerCase() === 'automatic';

/**
 * The payments ledger, shared by dispatch detail and route reconciliation.
 * Rows page in a handful at a time, expand in place for the full record, and
 * the whole (filtered) set can be shared out as CSV.
 */
export default function PaymentList({
  payments: rawPayments,
  totals,
  title = 'Payments',
  canEdit,
  onVoid,
  onCorrect,
  exportName = 'payments',
  emptyLabel = 'No payments recorded yet.',
}: Props) {
  const [filter, setFilter] = useState<Filter>('all');
  const [shown, setShown] = useState(PAGE);
  const [openId, setOpenId] = useState<string | null>(null);

  const payments = Array.isArray(rawPayments) ? rawPayments : [];

  const filtered = useMemo(() => {
    switch (filter) {
      case 'cash': return payments.filter((p) => !p.voided_on && methodOf(p) === 'cash');
      case 'mpesa': return payments.filter((p) => !p.voided_on && methodOf(p) !== 'cash');
      case 'voided': return payments.filter((p) => !!p.voided_on);
      default: return payments;
    }
  }, [payments, filter]);

  const sums = useMemo(() => {
    const live = payments.filter((p) => !p.voided_on);
    const localCash = live.filter((p) => methodOf(p) === 'cash').reduce((s, p) => s + num(p.amount), 0);
    const localAmount = live.reduce((s, p) => s + num(p.amount), 0);
    // server totals win, but they arrive as strings often enough to coerce
    const amount = totals?.amount != null ? num(totals.amount) : localAmount;
    const cash = totals?.cash != null ? num(totals.cash) : localCash;
    return {
      count: totals?.count != null ? num(totals.count) : live.length,
      amount,
      cash,
      mpesa: totals?.mpesa != null ? num(totals.mpesa) : amount - cash,
      voided: payments.length - live.length,
    };
  }, [payments, totals]);

  const visible = filtered.slice(0, shown);

  const exportCsv = async () => {
    // quote every field so commas / quotes / newlines in a narration can't shift columns
    const q = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const head = ['Date', 'Receipt', 'Transaction', 'Payer', 'Phone', 'Method', 'Recorded', 'Narration', 'Amount', 'Voided']
      .map(q)
      .join(',');
    const rows = filtered.map((p) =>
      [
        p.created_on,
        p.mpesa_receipt_number,
        p.transaction_id,
        p.customer_name,
        p.customer_msisdn,
        methodOf(p) === 'cash' ? 'cash' : 'mpesa',
        isAuto(p) ? 'automatic' : 'manual',
        p.narration,
        num(p.amount),
        p.voided_on ? 'yes' : 'no',
      ]
        .map(q)
        .join(',')
    );
    const csv = [head, ...rows, '', [q('Total'), '', '', '', '', '', '', '', q(sums.amount), ''].join(',')].join('\n');
    try {
      await Share.share({ title: `${exportName}.csv`, message: csv });
    } catch {
      Alert.alert('Export failed', 'Could not open the share sheet.');
    }
  };

  if (payments.length === 0) {
    return (
      <Card style={styles.emptyCard}>
        <Ionicons name="card-outline" size={22} color={colors.outline} />
        <Text style={styles.emptyText}>{emptyLabel}</Text>
      </Card>
    );
  }

  return (
    <View>
      <View style={styles.head}>
        <Text style={styles.title}>{title} ({sums.count})</Text>
        <Pressable style={styles.exportBtn} onPress={exportCsv} hitSlop={8}>
          <Ionicons name="share-outline" size={16} color={colors.secondary} />
          <Text style={styles.exportText}>Export</Text>
        </Pressable>
      </View>

      {/* Totals strip */}
      <Card style={styles.totalsCard}>
        <View>
          <Text style={styles.totalLabel}>RECEIVED</Text>
          <Text style={styles.totalValue}>{kes(sums.amount)}</Text>
        </View>
        <View style={styles.totalSplit}>
          <Split icon="cash" label="Cash" value={sums.cash} tone={colors.primary} />
          <Split icon="cellphone-check" label="M-Pesa" value={sums.mpesa} tone={colors.tertiary} />
          {sums.voided > 0 && <Split icon="close-circle-outline" label="Voided" value={sums.voided} tone={colors.error} count />}
        </View>
      </Card>

      {/* Filters */}
      <View style={styles.filters}>
        {(['all', 'cash', 'mpesa', 'voided'] as Filter[]).map((f) => {
          if (f === 'voided' && sums.voided === 0) return null;
          const active = filter === f;
          return (
            <Pressable
              key={f}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => { setFilter(f); setShown(PAGE); setOpenId(null); }}
            >
              <Text style={[styles.chipText, active && { color: colors.onSecondaryFixed }]}>
                {f === 'all' ? 'All' : f === 'mpesa' ? 'M-Pesa' : f[0].toUpperCase() + f.slice(1)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {filtered.length === 0 && (
        <Card style={styles.emptyCard}>
          <Ionicons name="funnel-outline" size={20} color={colors.outline} />
          <Text style={styles.emptyText}>Nothing in this group.</Text>
        </Card>
      )}

      {visible.map((p, i) => {
        const key = `${p.id}-${i}`;
        const openKey = String(p.id ?? key);
        const open = openId === openKey;
        const voided = !!p.voided_on;
        const method = methodOf(p);
        const auto = isAuto(p);
        const editable = !!canEdit?.(p);
        return (
          <Card key={key} style={[styles.row, open && styles.rowOpen]}>
            <Pressable style={styles.rowTop} onPress={() => setOpenId(open ? null : openKey)}>
              <View style={[styles.icon, voided && { backgroundColor: colors.errorContainer }]}>
                <MaterialCommunityIcons
                  name={voided ? 'close-thick' : method === 'cash' ? 'cash' : 'cellphone-check'}
                  size={18}
                  color={voided ? colors.error : method === 'cash' ? colors.primary : colors.tertiary}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.amount, voided && styles.voided]}>{kes(num(p.amount))}</Text>
                <Text style={styles.payer} numberOfLines={1}>
                  {p.customer_name || p.customer_msisdn || (method === 'cash' ? 'Cash collection' : 'M-Pesa')}
                </Text>
                <Text style={styles.meta} numberOfLines={1}>
                  {[p.mpesa_receipt_number || p.transaction_id, auto ? 'auto' : 'manual', p.created_on]
                    .filter(Boolean)
                    .join('  ·  ')}
                </Text>
              </View>
              <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={colors.outline} />
            </Pressable>

            {open && (
              <View style={styles.detail}>
                <Detail label="Amount" value={kes(num(p.amount))} mono />
                <Detail label="Method" value={method === 'cash' ? 'Cash' : 'M-Pesa'} />
                <Detail
                  label="Recorded"
                  value={auto ? 'Automatically (KCB/M-Pesa confirmation)' : 'By hand, in the field'}
                />
                {!!p.mpesa_receipt_number && <Detail label="M-Pesa receipt" value={p.mpesa_receipt_number} mono />}
                {!!p.transaction_id && <Detail label="Transaction" value={p.transaction_id} mono />}
                {!!p.narration && <Detail label="Narration" value={p.narration} />}
                {!!p.customer_name && <Detail label="Payer" value={p.customer_name} />}
                {!!p.customer_msisdn && <Detail label="Phone" value={p.customer_msisdn} mono />}
                {!!p.created_on && <Detail label="Received" value={p.created_on} />}
                {auto && <Detail label="Matched by" value="Route and date — it carries no dispatch id of its own" />}
                {voided && (
                  <Detail label="Voided" value={`${p.voided_on}${p.void_reason ? ` — ${p.void_reason}` : ''}`} tone={colors.error} />
                )}

                <View style={styles.actions}>
                  {!!p.customer_msisdn && (
                    <RowAction
                      icon="call-outline"
                      label="Call payer"
                      onPress={() => Linking.openURL(`tel:${p.customer_msisdn}`).catch(() => {})}
                    />
                  )}
                  <RowAction
                    icon="share-outline"
                    label="Share"
                    onPress={() =>
                      Share.share({
                        message: [
                          `${kes(num(p.amount))} — ${method === 'cash' ? 'Cash' : 'M-Pesa'}`,
                          p.customer_name || '',
                          p.customer_msisdn || '',
                          p.mpesa_receipt_number ? `Receipt ${p.mpesa_receipt_number}` : '',
                          p.transaction_id ? `Txn ${p.transaction_id}` : '',
                          p.created_on || '',
                        ]
                          .filter(Boolean)
                          .join('\n'),
                      }).catch(() => {})
                    }
                  />
                  {editable && onCorrect && (
                    <RowAction icon="create-outline" label="Correct" tone={colors.secondary} onPress={() => onCorrect(p)} />
                  )}
                  {editable && onVoid && (
                    <RowAction icon="close-circle-outline" label="Void" tone={colors.error} onPress={() => onVoid(p)} />
                  )}
                </View>

                {!editable && !voided && (
                  <Text style={styles.lockNote}>
                    {auto
                      ? "Automatic confirmations can't be edited — they come straight from the bank feed."
                      : 'Only manual cash entries can be voided or corrected.'}
                  </Text>
                )}
              </View>
            )}
          </Card>
        );
      })}

      {filtered.length > visible.length && (
        <Pressable style={styles.more} onPress={() => setShown((s) => s + PAGE)}>
          <Ionicons name="chevron-down" size={18} color={colors.secondary} />
          <Text style={styles.moreText}>
            Load {Math.min(PAGE, filtered.length - visible.length)} more · {filtered.length - visible.length} left
          </Text>
        </Pressable>
      )}
      {shown > PAGE && filtered.length <= visible.length && (
        <Pressable style={styles.more} onPress={() => { setShown(PAGE); setOpenId(null); }}>
          <Ionicons name="chevron-up" size={18} color={colors.secondary} />
          <Text style={styles.moreText}>Show fewer</Text>
        </Pressable>
      )}
    </View>
  );
}

function Split({ icon, label, value, tone, count }: { icon: any; label: string; value: number; tone: string; count?: boolean }) {
  return (
    <View style={styles.split}>
      <MaterialCommunityIcons name={icon} size={14} color={tone} />
      <Text style={styles.splitLabel}>{label}</Text>
      <Text style={[styles.splitValue, { color: tone }]}>{count ? value : kes(value, false)}</Text>
    </View>
  );
}

function Detail({ label, value, mono, tone }: { label: string; value: string; mono?: boolean; tone?: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, mono && { fontFamily: fonts.monoMedium }, tone ? { color: tone } : null]}>
        {value}
      </Text>
    </View>
  );
}

function RowAction({ icon, label, onPress, tone = colors.onSurfaceVariant }: { icon: any; label: string; onPress: () => void; tone?: string }) {
  return (
    <Pressable style={styles.action} onPress={onPress}>
      <Ionicons name={icon} size={16} color={tone} />
      <Text style={[styles.actionText, { color: tone }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  title: { ...type.headlineLgMobile, color: colors.onSurface },
  exportBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.full, backgroundColor: colors.surfaceContainerHigh },
  exportText: { ...type.labelSm, color: colors.secondary },

  totalsCard: { marginBottom: spacing.md, gap: spacing.sm },
  totalLabel: { ...type.labelSm, color: colors.onSurfaceVariant },
  totalValue: { ...type.metricXl, fontSize: 26, color: colors.onSurface, marginTop: 2 },
  totalSplit: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.outlineVariant, paddingTop: spacing.sm },
  split: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  splitLabel: { ...type.labelSm, color: colors.onSurfaceVariant },
  splitValue: { ...type.labelSm, fontSize: 13, fontFamily: fonts.monoSemibold },

  filters: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.full, backgroundColor: colors.surfaceContainerHigh },
  chipActive: { backgroundColor: colors.primaryContainer },
  chipText: { ...type.labelSm, color: colors.onSurfaceVariant },

  row: { marginBottom: spacing.sm },
  rowOpen: { borderWidth: 1, borderColor: colors.primaryContainer },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  icon: { width: 38, height: 38, borderRadius: radius.md, backgroundColor: colors.surfaceContainerHigh, alignItems: 'center', justifyContent: 'center' },
  amount: { ...type.titleMd, fontFamily: fonts.sansBold, color: colors.onSurface },
  payer: { ...type.bodySm, color: colors.onSurfaceVariant, marginTop: 1 },
  meta: { ...type.labelSm, fontSize: 10, color: colors.outline, marginTop: 2 },
  voided: { textDecorationLine: 'line-through', color: colors.onSurfaceVariant },

  detail: { marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.outlineVariant, gap: spacing.xs },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  detailLabel: { ...type.labelSm, color: colors.onSurfaceVariant, flexShrink: 0 },
  detailValue: { ...type.bodySm, color: colors.onSurface, flex: 1, textAlign: 'right' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  action: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.full, backgroundColor: colors.surfaceContainerHigh },
  actionText: { ...type.labelSm },
  lockNote: { ...type.bodySm, fontSize: 11, color: colors.onSurfaceVariant, fontStyle: 'italic', marginTop: spacing.sm },

  more: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, paddingVertical: spacing.md, borderRadius: radius.md, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.outlineVariant, marginBottom: spacing.sm },
  moreText: { ...type.labelSm, color: colors.secondary },

  emptyCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  emptyText: { ...type.bodySm, color: colors.onSurfaceVariant, flex: 1 },
});
