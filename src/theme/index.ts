import { colors, shadows } from './colors';
import { fonts, type } from './typography';

/** 8px spacing scale with a 4px half-step (per design spec). */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  gutter: 16,
  marginMobile: 20,
  touchTarget: 48,
} as const;

/** Corner radii. Cards 18px, buttons/inputs 12px, badges full. */
export const radius = {
  sm: 4,
  DEFAULT: 8,
  md: 12,
  card: 18,
  lg: 16,
  xl: 24,
  full: 9999,
} as const;

export { colors, shadows, fonts, type };

export const theme = { colors, shadows, fonts, type, spacing, radius };
export default theme;
