import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons, Ionicons, Feather } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { colors, type, spacing, radius, shadows } from '../theme';
import { PrimaryButton } from '../components';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../api/client';
import { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

export default function LoginScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { signIn } = useAuth();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onLogin = async () => {
    setError(null);
    setBusy(true);
    try {
      // API expects a msisdn-style username, e.g. 254703656970.
      await signIn(phone.trim(), password);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not sign in. Check your connection and details.';
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <LinearGradient
      colors={[colors.primaryFixed, colors.surface, colors.surface]}
      locations={[0, 0.45, 1]}
      style={styles.root}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[styles.container, { paddingTop: insets.top + spacing.xl }]}
      >
        <View style={styles.logoBlock}>
          <View style={styles.logo}>
            <MaterialCommunityIcons name="baguette" size={44} color={colors.onSecondaryFixed} />
          </View>
          <Text style={styles.brand}>Jolly Driver</Text>
          <Text style={styles.tagline}>Premium Logistics Tool</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>PHONE NUMBER</Text>
          <View style={styles.field}>
            <Feather name="smartphone" size={20} color={colors.onSurfaceVariant} />
            <TextInput
              style={styles.input}
              placeholder="0723… or 2547…"
              placeholderTextColor={colors.outline}
              keyboardType="phone-pad"
              autoCapitalize="none"
              value={phone}
              onChangeText={setPhone}
              editable={!busy}
            />
          </View>

          <Text style={[styles.label, { marginTop: spacing.lg }]}>PASSWORD</Text>
          <View style={styles.field}>
            <Feather name="lock" size={20} color={colors.onSurfaceVariant} />
            <TextInput
              style={styles.input}
              placeholder="Your password"
              placeholderTextColor={colors.outline}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="password"
              value={password}
              onChangeText={setPassword}
              editable={!busy}
              onSubmitEditing={onLogin}
            />
          </View>

          {error && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={18} color={colors.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {busy ? (
            <View style={[styles.loadingBtn]}>
              <ActivityIndicator color={colors.onSecondaryFixed} />
            </View>
          ) : (
            <PrimaryButton
              label="Login"
              icon="arrow-forward"
              style={{ marginTop: spacing.xl }}
              onPress={onLogin}
              disabled={!phone || !password}
            />
          )}

          <Text style={styles.help} onPress={() => navigation.navigate('ForgotPassword')}>
            Forgot Password or Need Help?
          </Text>
        </View>

        <View style={styles.secureChip}>
          <Ionicons name="shield-checkmark-outline" size={16} color={colors.secondary} />
          <Text style={styles.secureText}>Secure Enterprise Encryption</Text>
        </View>

        <View style={{ flex: 1 }} />
        <View style={{ paddingBottom: insets.bottom + spacing.md }}>
          <Text style={styles.footer}>
            Powered by <Text style={{ color: colors.primaryContainer }}>Jolly Bakery</Text>
          </Text>
          <Text style={styles.footerSm}>v2.4.0 (Alpha)  |  English</Text>
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  container: { flex: 1, paddingHorizontal: spacing.marginMobile, alignItems: 'center' },
  logoBlock: { alignItems: 'center', marginTop: spacing.xl, marginBottom: spacing.xl },
  logo: {
    width: 92, height: 92, borderRadius: radius.xl, backgroundColor: colors.primaryContainer,
    alignItems: 'center', justifyContent: 'center', ...shadows.level1,
  },
  brand: { ...type.displayLg, color: colors.primary, marginTop: spacing.md },
  tagline: { ...type.titleMd, color: colors.onSurfaceVariant, marginTop: spacing.xs },
  card: {
    width: '100%', backgroundColor: colors.surfaceContainerLowest, borderRadius: radius.xl,
    padding: spacing.lg, ...shadows.level1,
  },
  label: { ...type.labelSm, color: colors.onSurfaceVariant, marginBottom: spacing.sm },
  field: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.secondaryFixed,
    borderRadius: radius.md, paddingHorizontal: spacing.md, height: 56,
  },
  input: { flex: 1, ...type.bodyLg, color: colors.onSurface, height: '100%' },
  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.errorContainer,
    borderRadius: radius.md, padding: spacing.sm, marginTop: spacing.md,
  },
  errorText: { ...type.bodySm, color: colors.onErrorContainer, flex: 1 },
  loadingBtn: {
    minHeight: 52, borderRadius: radius.md, backgroundColor: colors.primaryContainer,
    alignItems: 'center', justifyContent: 'center', marginTop: spacing.xl,
  },
  help: { ...type.labelSm, color: colors.primary, textAlign: 'center', marginTop: spacing.lg, letterSpacing: 1 },
  secureChip: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.errorContainer,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.full, marginTop: spacing.lg,
  },
  secureText: { ...type.bodyLg, fontSize: 15, color: colors.secondary },
  footer: { ...type.labelSm, color: colors.outline, textAlign: 'center' },
  footerSm: { ...type.labelSm, color: colors.outline, textAlign: 'center', marginTop: spacing.xs },
});
