/**
 * Hakirush design tokens.
 *
 * Identity: restrained ivory background, charcoal text, garnet primary, gold accent.
 * Gold is decorative (borders, highlights); never use it for body text on ivory
 * (contrast too low). Use `accentText` when gold-tinted text is needed.
 *
 * Every text/background pair used by components is checked for WCAG AA contrast
 * in src/theme/__tests__/contrast.test.ts — add new pairs there.
 */

export type ColorScheme = 'light' | 'dark';

export type StatusTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'primary';

export interface ThemeColors {
  /** App background (ivory / near-black). */
  background: string;
  /** Cards, sheets, inputs. */
  surface: string;
  /** Subtle alternate surface (skeletons, segmented control track, pressed rows). */
  surfaceAlt: string;
  border: string;
  borderStrong: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  textInverse: string;
  primary: string;
  primaryPressed: string;
  onPrimary: string;
  /** Tinted background for primary-coloured chips / selected rows. */
  primarySoft: string;
  accent: string;
  accentText: string;
  success: string;
  successBg: string;
  warning: string;
  warningBg: string;
  danger: string;
  dangerBg: string;
  dangerPressed: string;
  onDanger: string;
  info: string;
  infoBg: string;
  neutral: string;
  neutralBg: string;
  /** Translucent scrim behind modals. */
  overlay: string;
  focus: string;
  tabBar: string;
  tabInactive: string;
  skeleton: string;
}

export const lightColors: ThemeColors = {
  background: '#FBF8F3',
  surface: '#FFFFFF',
  surfaceAlt: '#F3EDE0',
  border: '#E7E1D3',
  borderStrong: '#B4ADA0',
  text: '#1C1A17',
  textSecondary: '#4F4A42',
  textMuted: '#635D53',
  textInverse: '#FBF8F3',
  primary: '#7A2233',
  primaryPressed: '#5E1A27',
  onPrimary: '#FFFFFF',
  primarySoft: '#F6E6E9',
  accent: '#B8912E',
  accentText: '#6E5513',
  success: '#2B6141',
  successBg: '#E3F1E8',
  warning: '#7A4F00',
  warningBg: '#FBF0D9',
  danger: '#A3261F',
  dangerBg: '#FBE6E3',
  dangerPressed: '#821E18',
  onDanger: '#FFFFFF',
  info: '#1F5A8A',
  infoBg: '#E3EEF8',
  neutral: '#4F4A42',
  neutralBg: '#EFEBE3',
  overlay: 'rgba(28, 26, 23, 0.45)',
  focus: '#B8912E',
  tabBar: '#FFFFFF',
  tabInactive: '#635D53',
  skeleton: '#ECE6DA',
};

export const darkColors: ThemeColors = {
  background: '#151412',
  surface: '#201E1A',
  surfaceAlt: '#2A2722',
  border: '#3A362F',
  borderStrong: '#6B655A',
  text: '#F3EFE6',
  textSecondary: '#D2CBBE',
  textMuted: '#B3AC9F',
  textInverse: '#1C1A17',
  primary: '#E58A9A',
  primaryPressed: '#D16F81',
  onPrimary: '#2A0A11',
  primarySoft: '#3A2026',
  accent: '#D6B25E',
  accentText: '#E3C57E',
  success: '#86CFA2',
  successBg: '#1C3326',
  warning: '#EDC072',
  warningBg: '#3A2E14',
  danger: '#F4978D',
  dangerBg: '#3F1E1B',
  dangerPressed: '#E57D72',
  onDanger: '#2B0906',
  info: '#93C4EE',
  infoBg: '#16293A',
  neutral: '#D2CBBE',
  neutralBg: '#2E2B26',
  overlay: 'rgba(0, 0, 0, 0.6)',
  focus: '#D6B25E',
  tabBar: '#201E1A',
  tabInactive: '#B3AC9F',
  skeleton: '#2E2B26',
};

/** 4-pt based spacing scale. */
export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radii = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  pill: 999,
} as const;

/** Minimum touch target (dp) for anything pressable. */
export const TOUCH_TARGET = 48;

export type TextVariant =
  | 'display'
  | 'title'
  | 'heading'
  | 'subheading'
  | 'body'
  | 'bodyStrong'
  | 'secondary'
  | 'caption'
  | 'label';

export interface TextStyleToken {
  fontSize: number;
  lineHeight: number;
  fontWeight: '400' | '500' | '600' | '700';
  letterSpacing?: number;
}

/**
 * Typography scale. Body text is 16, secondary 14, captions 13 (never all-caps).
 * Font scaling is always left enabled — layouts must wrap rather than truncate.
 */
export const typography: Record<TextVariant, TextStyleToken> = {
  display: { fontSize: 28, lineHeight: 34, fontWeight: '700' },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '700' },
  heading: { fontSize: 18, lineHeight: 24, fontWeight: '600' },
  subheading: { fontSize: 16, lineHeight: 22, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 24, fontWeight: '400' },
  bodyStrong: { fontSize: 16, lineHeight: 24, fontWeight: '600' },
  secondary: { fontSize: 14, lineHeight: 20, fontWeight: '400' },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
  label: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
};

/** Status colours: text colour + background colour for pills/banners. */
export function toneColors(colors: ThemeColors, tone: StatusTone): { fg: string; bg: string } {
  switch (tone) {
    case 'success':
      return { fg: colors.success, bg: colors.successBg };
    case 'warning':
      return { fg: colors.warning, bg: colors.warningBg };
    case 'danger':
      return { fg: colors.danger, bg: colors.dangerBg };
    case 'info':
      return { fg: colors.info, bg: colors.infoBg };
    case 'primary':
      return { fg: colors.primary, bg: colors.primarySoft };
    case 'neutral':
    default:
      return { fg: colors.neutral, bg: colors.neutralBg };
  }
}

/**
 * Deterministic avatar background colours (white initials on top meet AA in both schemes).
 */
export const avatarPalette = [
  '#7A2233',
  '#2B6141',
  '#1F5A8A',
  '#6B4C9A',
  '#8A4B12',
  '#245E63',
  '#5E5A24',
  '#8A2F5E',
] as const;
