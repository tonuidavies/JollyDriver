/**
 * Jolly Driver — "Artisanal Transit" color system.
 * Ported verbatim from the design system (Material Design 3 tonal palette).
 * A cream-based, golden-honey / dark-cocoa bakery palette.
 */
export const colors = {
  // Surfaces
  surface: '#fff8f4',
  surfaceDim: '#e5d8cd',
  surfaceBright: '#fff8f4',
  surfaceContainerLowest: '#ffffff',
  surfaceContainerLow: '#fff1e6',
  surfaceContainer: '#f9ebe0',
  surfaceContainerHigh: '#f3e6db',
  surfaceContainerHighest: '#eee0d5',
  surfaceVariant: '#eee0d5',

  // On-surface text
  onSurface: '#211a14',
  onSurfaceVariant: '#534434',
  inverseSurface: '#372f28',
  inverseOnSurface: '#fceee3',

  // Outlines
  outline: '#867461',
  outlineVariant: '#d8c3ad',

  // Primary — warm orange / honey
  primary: '#855300',
  onPrimary: '#ffffff',
  primaryContainer: '#f59e0b',
  onPrimaryContainer: '#613b00',
  inversePrimary: '#ffb95f',
  surfaceTint: '#855300',

  // Secondary — dark brown
  secondary: '#7b5643',
  onSecondary: '#ffffff',
  secondaryContainer: '#ffcdb5',
  onSecondaryContainer: '#7a5542',

  // Tertiary — blue (MPESA accents)
  tertiary: '#00658b',
  onTertiary: '#ffffff',
  tertiaryContainer: '#1abdff',
  onTertiaryContainer: '#004966',
  tertiaryFixed: '#c5e7ff',
  tertiaryFixedDim: '#7fd0ff',

  // Error / semantic
  error: '#ba1a1a',
  onError: '#ffffff',
  errorContainer: '#ffdad6',
  onErrorContainer: '#93000a',

  // Fixed accents
  primaryFixed: '#ffddb8',
  primaryFixedDim: '#ffb95f',
  onPrimaryFixed: '#2a1700',
  onPrimaryFixedVariant: '#653e00',
  secondaryFixed: '#ffdbcb',
  secondaryFixedDim: '#edbca5',
  onSecondaryFixed: '#2e1507',
  onSecondaryFixedVariant: '#613f2d',

  // Background
  background: '#fff8f4',
  onBackground: '#211a14',

  // Semantic tints used by status badges (derived from spec)
  successContainer: '#cdeede',
  onSuccessContainer: '#0f6b45',
  success: '#1f8a5b',
  warningContainer: '#ffe2c2',
  onWarningContainer: '#8a5a00',
  neutralContainer: '#e7ded4',
  onNeutralContainer: '#6b5d4d',
} as const;

export type AppColors = typeof colors;

// Soft ambient shadows from the elevation spec (rgba(91, 58, 41, x))
export const shadows = {
  level1: {
    shadowColor: 'rgb(91, 58, 41)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 20,
    elevation: 2,
  },
  level2: {
    shadowColor: 'rgb(91, 58, 41)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 30,
    elevation: 6,
  },
} as const;
