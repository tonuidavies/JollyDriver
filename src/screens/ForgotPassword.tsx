import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, KeyboardAvoidingView, Platform, Pressable, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons, Ionicons, Feather } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { colors, type, spacing, radius, shadows } from '../theme';
import { PrimaryButton } from '../components';
import { forgotPassword, confirmCode, resetPassword } from '../api/endpoints';
import { ApiError } from '../api/client';
import { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'ForgotPassword'>;
type Step = 'request' | 'verify' | 'reset' | 'done';

const STEP_INDEX: Record<Step, number> = { request: 0, verify: 1, reset: 2, done: 3 };

export default function ForgotPassword({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<Step>('request');
  const [identity, setIdentity] = useState('');
  const [otp, setOtp] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const fail = (e: unknown) =>
    setError(e instanceof ApiError ? e.message : 'Something went wrong. Please try again.');

  const requestOtp = async () => {
    if (!identity.trim()) return setError('Enter your phone number.');
    setError(null);
    setBusy(true);
    try {
      const res = await forgotPassword(identity.trim());
      setInfo(res?.description ?? 'Recovery code sent.');
      setStep('verify');
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const verifyOtp = async () => {
    if (!otp.trim()) return setError('Enter the code sent to your phone.');
    setError(null);
    setBusy(true);
    try {
      const res = await confirmCode(identity.trim(), otp.trim());
      setResetCode(res.reset_code);
      setInfo(null);
      setStep('reset');
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const submitNewPassword = async () => {
    if (password.length < 4) return setError('Password must be at least 4 characters.');
    if (password !== confirm) return setError('Passwords do not match.');
    setError(null);
    setBusy(true);
    try {
      await resetPassword(resetCode, password);
      setStep('done');
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setError(null);
    setBusy(true);
    try {
      const res = await forgotPassword(identity.trim());
      setInfo(res?.description ?? 'A new code has been sent.');
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <LinearGradient colors={[colors.primaryFixed, colors.surface, colors.surface]} locations={[0, 0.45, 1]} style={styles.root}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[styles.container, { paddingTop: insets.top + spacing.md }]}
      >
        {/* Back to login */}
        <Pressable style={styles.back} onPress={() => navigation.goBack()} hitSlop={10}>
          <Ionicons name="arrow-back" size={24} color={colors.onSurface} />
          <Text style={styles.backText}>Back to login</Text>
        </Pressable>

        <View style={styles.logoBlock}>
          <View style={styles.logo}>
            <MaterialCommunityIcons name="lock-reset" size={40} color={colors.onSecondaryFixed} />
          </View>
          <Text style={styles.brand}>Reset Password</Text>
          <Text style={styles.tagline}>
            {step === 'request' && 'We’ll text you a recovery code'}
            {step === 'verify' && 'Enter the code we sent you'}
            {step === 'reset' && 'Choose a new password'}
            {step === 'done' && 'You’re all set'}
          </Text>
        </View>

        {/* Progress dots */}
        {step !== 'done' && (
          <View style={styles.dots}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={[styles.dot, i <= STEP_INDEX[step] && styles.dotActive]} />
            ))}
          </View>
        )}

        <View style={styles.card}>
          {step === 'request' && (
            <>
              <Text style={styles.label}>PHONE NUMBER</Text>
              <View style={styles.field}>
                <Feather name="smartphone" size={20} color={colors.onSurfaceVariant} />
                <TextInput
                  style={styles.input}
                  placeholder="0703656970"
                  placeholderTextColor={colors.outline}
                  keyboardType="phone-pad"
                  autoCapitalize="none"
                  value={identity}
                  onChangeText={setIdentity}
                  editable={!busy}
                />
              </View>
              <StepButton label="Send Code" icon="paper-plane-outline" busy={busy} onPress={requestOtp} disabled={!identity} />
            </>
          )}

          {step === 'verify' && (
            <>
              <Text style={styles.label}>VERIFICATION CODE</Text>
              <View style={styles.field}>
                <Feather name="hash" size={20} color={colors.onSurfaceVariant} />
                <TextInput
                  style={[styles.input, styles.otpInput]}
                  placeholder="0000"
                  placeholderTextColor={colors.outline}
                  keyboardType="number-pad"
                  value={otp}
                  onChangeText={setOtp}
                  editable={!busy}
                  maxLength={8}
                />
              </View>
              <StepButton label="Verify Code" icon="checkmark-circle-outline" busy={busy} onPress={verifyOtp} disabled={!otp} />
              <Pressable onPress={resend} disabled={busy} style={{ marginTop: spacing.md }}>
                <Text style={styles.resend}>Didn't get it? Resend code</Text>
              </Pressable>
            </>
          )}

          {step === 'reset' && (
            <>
              <Text style={styles.label}>NEW PASSWORD</Text>
              <View style={styles.field}>
                <Feather name="lock" size={20} color={colors.onSurfaceVariant} />
                <TextInput
                  style={styles.input}
                  placeholder="New password"
                  placeholderTextColor={colors.outline}
                  secureTextEntry
                  value={password}
                  onChangeText={setPassword}
                  editable={!busy}
                />
              </View>
              <Text style={[styles.label, { marginTop: spacing.lg }]}>CONFIRM PASSWORD</Text>
              <View style={styles.field}>
                <Feather name="lock" size={20} color={colors.onSurfaceVariant} />
                <TextInput
                  style={styles.input}
                  placeholder="Re-enter password"
                  placeholderTextColor={colors.outline}
                  secureTextEntry
                  value={confirm}
                  onChangeText={setConfirm}
                  editable={!busy}
                  onSubmitEditing={submitNewPassword}
                />
              </View>
              <StepButton label="Set Password" icon="save-outline" busy={busy} onPress={submitNewPassword} disabled={!password || !confirm} />
            </>
          )}

          {step === 'done' && (
            <View style={styles.doneBox}>
              <View style={styles.doneCircle}>
                <Ionicons name="checkmark" size={40} color={colors.onPrimary} />
              </View>
              <Text style={styles.doneText}>Your password has been reset. You can now sign in with your new password.</Text>
              <PrimaryButton label="Back to Login" icon="arrow-forward" style={{ marginTop: spacing.lg, alignSelf: 'stretch' }} onPress={() => navigation.goBack()} />
            </View>
          )}

          {info && step !== 'done' && (
            <View style={styles.infoBox}>
              <Ionicons name="information-circle-outline" size={18} color={colors.tertiary} />
              <Text style={styles.infoText}>{info}</Text>
            </View>
          )}
          {error && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={18} color={colors.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
        </View>

        <View style={{ flex: 1 }} />
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

function StepButton({ label, icon, busy, onPress, disabled }: { label: string; icon: any; busy: boolean; onPress: () => void; disabled?: boolean }) {
  if (busy) {
    return (
      <View style={styles.loadingBtn}>
        <ActivityIndicator color={colors.onSecondaryFixed} />
      </View>
    );
  }
  return <PrimaryButton label={label} icon={icon} iconRight={false} style={{ marginTop: spacing.xl }} onPress={onPress} disabled={disabled} />;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  container: { flex: 1, paddingHorizontal: spacing.marginMobile },
  back: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  backText: { ...type.bodyLg, color: colors.onSurface },
  logoBlock: { alignItems: 'center', marginTop: spacing.md, marginBottom: spacing.lg },
  logo: { width: 84, height: 84, borderRadius: radius.xl, backgroundColor: colors.primaryContainer, alignItems: 'center', justifyContent: 'center', ...shadows.level1 },
  brand: { ...type.headlineLg, color: colors.primary, marginTop: spacing.md },
  tagline: { ...type.bodyLg, color: colors.onSurfaceVariant, marginTop: spacing.xs, textAlign: 'center' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm, marginBottom: spacing.lg },
  dot: { width: 28, height: 6, borderRadius: 3, backgroundColor: colors.outlineVariant },
  dotActive: { backgroundColor: colors.primaryContainer },
  card: { width: '100%', backgroundColor: colors.surfaceContainerLowest, borderRadius: radius.xl, padding: spacing.lg, ...shadows.level1 },
  label: { ...type.labelSm, color: colors.onSurfaceVariant, marginBottom: spacing.sm },
  field: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.secondaryFixed, borderRadius: radius.md, paddingHorizontal: spacing.md, height: 56 },
  input: { flex: 1, ...type.bodyLg, color: colors.onSurface, height: '100%' },
  otpInput: { ...type.metricXl, fontSize: 24, letterSpacing: 6 },
  loadingBtn: { minHeight: 52, borderRadius: radius.md, backgroundColor: colors.primaryContainer, alignItems: 'center', justifyContent: 'center', marginTop: spacing.xl },
  resend: { ...type.bodyLg, color: colors.primary, textAlign: 'center' },
  infoBox: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.tertiaryFixed, borderRadius: radius.md, padding: spacing.sm, marginTop: spacing.md },
  infoText: { ...type.bodySm, color: colors.onTertiaryContainer, flex: 1 },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.errorContainer, borderRadius: radius.md, padding: spacing.sm, marginTop: spacing.md },
  errorText: { ...type.bodySm, color: colors.onErrorContainer, flex: 1 },
  doneBox: { alignItems: 'center', gap: spacing.md },
  doneCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.success, alignItems: 'center', justifyContent: 'center' },
  doneText: { ...type.bodyLg, color: colors.onSurface, textAlign: 'center' },
});
