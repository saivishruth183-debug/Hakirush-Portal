import { StyleSheet, Text, type TextProps, type TextStyle } from 'react-native';

import { useTheme, type TextVariant, type ThemeColors } from '@/theme';

export type TextColor = keyof Pick<
  ThemeColors,
  | 'text'
  | 'textSecondary'
  | 'textMuted'
  | 'textInverse'
  | 'primary'
  | 'onPrimary'
  | 'accentText'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
>;

export interface AppTextProps extends TextProps {
  /** display | title | heading | subheading | body (default) | bodyStrong | secondary | caption | label */
  variant?: TextVariant;
  /** Theme colour name (default: text for body/titles, textSecondary for secondary/caption). */
  color?: TextColor;
  align?: TextStyle['textAlign'];
  /** Marks the text as a heading for screen readers (default true for display/title/heading). */
  header?: boolean;
}

const HEADER_VARIANTS: TextVariant[] = ['display', 'title', 'heading'];

/**
 * Themed text. Font scaling is always enabled; text wraps by default (do not set
 * numberOfLines on anything a user must read in full).
 */
export function AppText({ variant = 'body', color, align, header, style, accessibilityRole, ...rest }: AppTextProps) {
  const theme = useTheme();
  const token = theme.typography[variant];
  const defaultColor: TextColor = variant === 'secondary' || variant === 'caption' ? 'textSecondary' : 'text';
  const isHeader = header ?? HEADER_VARIANTS.includes(variant);
  return (
    <Text
      accessibilityRole={accessibilityRole ?? (isHeader ? 'header' : undefined)}
      style={[
        styles.base,
        {
          fontSize: token.fontSize,
          lineHeight: token.lineHeight,
          fontWeight: token.fontWeight,
          color: theme.colors[color ?? defaultColor],
          textAlign: align,
        },
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  base: { flexShrink: 1 },
});
