import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import { Screen, ScreenTitleBar, PrimaryButton } from '../../components';
import PosReceipt from '../../components/PosReceipt';
import { colors, type, fonts, spacing, radius } from '../../theme';
import { receiptHtml, receiptTotals, ksh } from '../../utils/receipt';
import { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Receipt'>;

export default function ReceiptScreen({ route, navigation }: Props) {
  const { receipt, fresh } = route.params;
  const [busy, setBusy] = useState(false);
  const total = receiptTotals(receipt).total;

  const print = async () => {
    try {
      setBusy(true);
      await Print.printAsync({ html: receiptHtml(receipt) });
    } catch (e) {
      Alert.alert('Could not print', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const share = async () => {
    try {
      setBusy(true);
      const { uri } = await Print.printToFileAsync({ html: receiptHtml(receipt) });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: `Invoice ${receipt.invoiceNumber}`, UTI: 'com.adobe.pdf' });
      } else {
        Alert.alert('Saved', uri);
      }
    } catch (e) {
      Alert.alert('Could not share', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen bottomPad={spacing.xl}>
      <ScreenTitleBar title="Invoice & Delivery" onBack={() => navigation.goBack()} showSync={false} />

      {fresh && (
        <View style={[styles.banner, receipt.saleType === 'lpo' ? styles.bannerLpo : null]}>
          <Ionicons name="checkmark-circle" size={30} color={receipt.saleType === 'lpo' ? colors.tertiary : colors.success} />
          <View style={{ flex: 1 }}>
            <Text style={styles.bannerTitle}>Sale saved · {ksh(total)}</Text>
            <Text style={styles.bannerSub}>
              {receipt.saleType === 'lpo'
                ? 'On the school account — they pay later. Print 2 copies: one stays with them, one comes back signed.'
                : 'Print it, get it signed, hand the customer their copy.'}
            </Text>
          </View>
        </View>
      )}

      <PosReceipt receipt={receipt} />

      <View style={styles.actions}>
        <PrimaryButton label="Print" icon="print-outline" iconRight={false} variant="dark" style={{ flex: 1 }} onPress={print} disabled={busy} />
        <PrimaryButton label="Share PDF" icon="share-social-outline" iconRight={false} variant="outline" style={{ flex: 1 }} onPress={share} disabled={busy} />
      </View>
      <PrimaryButton label="Done" icon="checkmark" iconRight={false} style={{ marginTop: spacing.md }} onPress={() => navigation.goBack()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.successContainer, borderRadius: radius.card, padding: spacing.md, marginBottom: spacing.lg,
  },
  bannerLpo: { backgroundColor: colors.tertiaryFixed },
  bannerTitle: { ...type.titleMd, fontFamily: fonts.sansBold, color: colors.onSurface },
  bannerSub: { ...type.bodySm, color: colors.onSurfaceVariant, marginTop: 2 },
  actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
});
