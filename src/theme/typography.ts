/**
 * Typography scale — Plus Jakarta Sans (display/body) + JetBrains Mono (metrics/labels).
 * Font family keys map to the names registered in App.tsx via expo-google-fonts.
 */
export const fonts = {
  sans: 'PlusJakartaSans_400Regular',
  sansMedium: 'PlusJakartaSans_500Medium',
  sansSemibold: 'PlusJakartaSans_600SemiBold',
  sansBold: 'PlusJakartaSans_700Bold',
  sansExtrabold: 'PlusJakartaSans_800ExtraBold',
  mono: 'JetBrainsMono_400Regular',
  monoMedium: 'JetBrainsMono_500Medium',
  monoSemibold: 'JetBrainsMono_600SemiBold',
} as const;

export const type = {
  displayLg: {
    fontFamily: fonts.sansExtrabold,
    fontSize: 40,
    lineHeight: 48,
    letterSpacing: -0.8,
  },
  headlineLg: {
    fontFamily: fonts.sansBold,
    fontSize: 28,
    lineHeight: 36,
    letterSpacing: -0.28,
  },
  headlineLgMobile: {
    fontFamily: fonts.sansBold,
    fontSize: 24,
    lineHeight: 32,
  },
  titleMd: {
    fontFamily: fonts.sansSemibold,
    fontSize: 18,
    lineHeight: 24,
  },
  bodyLg: {
    fontFamily: fonts.sans,
    fontSize: 16,
    lineHeight: 24,
  },
  bodySm: {
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 20,
  },
  metricXl: {
    fontFamily: fonts.monoSemibold,
    fontSize: 32,
    lineHeight: 40,
    letterSpacing: -0.64,
  },
  labelSm: {
    fontFamily: fonts.monoMedium,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.6,
  },
} as const;
