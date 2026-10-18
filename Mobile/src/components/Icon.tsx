import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';

import { useTheme, type ThemeColors } from '@/theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

export interface IconProps {
  name: IconName;
  size?: number;
  /** Theme colour name or a raw colour string. */
  color?: keyof ThemeColors | (string & {});
  /** Icons are decorative by default (hidden from screen readers). Pass a label to expose one. */
  accessibilityLabel?: string;
}

/** Ionicons wrapper (the single icon set used by the app). */
export function Icon({ name, size = 22, color = 'text', accessibilityLabel }: IconProps) {
  const theme = useTheme();
  const resolved = (theme.colors as unknown as Record<string, string>)[color] ?? color;
  return (
    <Ionicons
      name={name}
      size={size}
      color={resolved}
      accessible={!!accessibilityLabel}
      accessibilityLabel={accessibilityLabel}
      importantForAccessibility={accessibilityLabel ? 'yes' : 'no-hide-descendants'}
      accessibilityElementsHidden={!accessibilityLabel}
    />
  );
}
