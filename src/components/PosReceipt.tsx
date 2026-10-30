import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import config from '../config';
import { code128Bars } from '../utils/barcode';
import { Receipt, receiptTotals, ksh, lineAmount, lineDiscPrice, slipDate, slipTime } from '../utils/receipt';

/**
 * The POS "Invoice and Delivery" slip on screen — continuous-form paper with
 * the tractor-feed holes down both edges, the same layout the printer produces.
 */
export default function PosReceipt({ receipt }: { receipt: Receipt }) {
  const c = config.company;
  const t = receiptTotals(receipt);
  return (
    <View style={styles.paper}>
      <Holes side="left" />
      <Holes side="right" />

      <View style={styles.body}>
        <View style={styles.topRow}>
          <View style={{ flex: 1.15 }}>
            <Text style={styles.company}>{c.name}</Text>
            <Text style={styles.small}>{c.address}</Text>
            <Text style={[styles.small, { marginTop: 8 }]}>PIN: {c.pin}</Text>
            <Text style={[styles.small, { marginTop: 8 }]}>{c.phone}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.docTitle}>Invoice and Delivery</Text>
            <Meta k="Invoice #:" v={receipt.invoiceNumber} />
            <Meta k="Account #:" v={receipt.accountNumber ?? ''} />
            <Meta k="Page:" v="1 of 1" />
            {!!receipt.lpoNumber && <Meta k="LPO #:" v={receipt.lpoNumber} />}
            {!!receipt.deliveryNote && <Meta k="Del. Note:" v={receipt.deliveryNote} />}
            <View style={{ height: 8 }} />
            <Meta k="Date:" v={slipDate(receipt.issuedAt)} />
            <Meta k="Time:" v={slipTime(receipt.issuedAt)} />
            <Meta k="Sales Person:" v={receipt.salesPerson} />
          </View>
        </View>

        <View style={styles.billBox}>
          <Text style={[styles.small, styles.billLabel]}>Bill To:</Text>
          <View style={styles.billText}>
            {receipt.billTo.map((l, i) => (
              <Text key={i} style={styles.small}>{l}</Text>
            ))}
          </View>
        </View>

        <View style={styles.table}>
          <View style={[styles.tr, styles.th]}>
            <Text style={[styles.cell, styles.cItem, styles.thText]}>Item</Text>
            <Text style={[styles.cell, styles.cDesc, styles.thText]}>Description</Text>
            <Text style={[styles.cell, styles.cQty, styles.thText, styles.right]}>Qty</Text>
            <Text style={[styles.cell, styles.cMoney, styles.thText, styles.right]}>Price</Text>
            <Text style={[styles.cell, styles.cDisc, styles.thText]}>Disc%</Text>
            <Text style={[styles.cell, styles.cMoney, styles.thText, styles.right]}>Amt</Text>
          </View>
          {receipt.lines.map((l, i) => (
            <View key={i} style={styles.tr}>
              <Text style={[styles.cell, styles.cItem]} numberOfLines={1}>{l.code}</Text>
              <View style={[styles.cell, styles.cDesc]}>
                <Text style={styles.tdText}>{l.description}</Text>
                {!!l.sub && <Text style={styles.tdText}>{l.sub}</Text>}
              </View>
              <Text style={[styles.cell, styles.cQty, styles.tdText, styles.right]}>{l.qty}</Text>
              <Text style={[styles.cell, styles.cMoney, styles.tdText, styles.right]}>{ksh(lineDiscPrice(l)).replace('Ksh ', '')}</Text>
              <Text style={[styles.cell, styles.cDisc, styles.tdText]}>{l.discPct || 0}</Text>
              <Text style={[styles.cell, styles.cMoney, styles.tdText, styles.right]}>{ksh(lineAmount(l)).replace('Ksh ', '')}</Text>
            </View>
          ))}
        </View>

        <View style={styles.dotRule} />
        <View style={styles.footRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.small}>Received By: ....................</Text>
            <Text style={[styles.small, { marginLeft: 26, marginTop: 4 }]}>Date: ....................</Text>
          </View>
          <View>
            <Total k="Sub Total" v={ksh(t.subTotal)} />
            <Total k="Sales Tax" v={ksh(t.tax)} />
            <Total k="Total" v={ksh(t.total)} bold />
          </View>
        </View>

        <Barcode value={receipt.invoiceNumber} />
      </View>
    </View>
  );
}

function Meta({ k, v }: { k: string; v: string }) {
  return (
    <View style={styles.metaRow}>
      <Text style={[styles.small, { width: 74 }]}>{k}</Text>
      <Text style={[styles.small, { flex: 1 }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{v}</Text>
    </View>
  );
}

function Total({ k, v, bold }: { k: string; v: string; bold?: boolean }) {
  return (
    <View style={styles.totalRow}>
      <Text style={[styles.small, { textAlign: 'right', width: 62 }]}>{k}</Text>
      <Text style={[styles.small, { textAlign: 'right', minWidth: 88 }, bold && { fontWeight: '700' }]}>{v}</Text>
    </View>
  );
}

function Barcode({ value }: { value: string }) {
  const { bars, total } = code128Bars(value);
  const h = 30;
  return (
    <View style={{ marginTop: 22, alignSelf: 'flex-start' }}>
      <Svg width={total * 1.2} height={h}>
        {bars.map((b, i) => (
          <Rect key={i} x={b.x * 1.2} y={0} width={b.w * 1.2} height={h} fill="#111" />
        ))}
      </Svg>
      <Text style={[styles.small, { textAlign: 'center', marginTop: 4 }]}>{value}</Text>
    </View>
  );
}

function Holes({ side }: { side: 'left' | 'right' }) {
  return (
    <View style={[styles.holes, side === 'left' ? { left: 0 } : { right: 0 }]} pointerEvents="none">
      {Array.from({ length: 28 }).map((_, i) => (
        <View key={i} style={styles.hole} />
      ))}
    </View>
  );
}

const INK = '#1b1b1b';
const styles = StyleSheet.create({
  paper: {
    backgroundColor: '#fbfbf8',
    borderRadius: 4,
    paddingHorizontal: 22,
    paddingVertical: 18,
    overflow: 'hidden',
    shadowColor: '#5b3a29',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 4,
  },
  holes: { position: 'absolute', top: 6, bottom: 6, width: 16, justifyContent: 'space-between', alignItems: 'center', borderColor: '#d9d6cf', borderStyle: 'dashed' },
  hole: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#c9a57a' },
  body: { paddingHorizontal: 2 },

  topRow: { flexDirection: 'row', gap: 10 },
  company: { fontSize: 13, fontWeight: '700', color: INK, letterSpacing: 0.1 },
  docTitle: { fontSize: 13, fontWeight: '700', color: INK, marginBottom: 6 },
  small: { fontSize: 9.5, color: INK, lineHeight: 13 },
  metaRow: { flexDirection: 'row' },

  billBox: { flexDirection: 'row', borderWidth: 1, borderColor: INK, marginTop: 16, width: '70%' },
  billLabel: { width: 46, padding: 3, borderRightWidth: 1, borderColor: INK },
  billText: { flex: 1, padding: 3 },

  table: { borderWidth: 1, borderColor: INK, marginTop: 22 },
  tr: { flexDirection: 'row' },
  th: { backgroundColor: '#e6e6e2', borderBottomWidth: 1, borderColor: INK },
  cell: { paddingHorizontal: 3, paddingVertical: 2, borderRightWidth: 1, borderColor: INK },
  thText: { fontSize: 8.5, color: INK },
  tdText: { fontSize: 9, color: INK },
  right: { textAlign: 'right' },
  cItem: { width: 40, fontSize: 9, color: INK },
  cDesc: { flex: 1 },
  cQty: { width: 28 },
  cMoney: { width: 54 },
  cDisc: { width: 28 },

  dotRule: { height: 6, marginTop: 70, borderTopWidth: 1, borderBottomWidth: 1, borderStyle: 'dotted', borderColor: '#888' },
  footRow: { flexDirection: 'row', marginTop: 6, gap: 6 },
  totalRow: { flexDirection: 'row', gap: 8 },
});
