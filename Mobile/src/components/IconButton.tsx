import { ActivityIndicator, Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme, type ThemeColors } from '@/theme';

import { Icon, type IconName } from './Icon';
import { usePressGuard } from './usePressGuard';

export interface IconButtonProps {
  icon: IconName;
  /** Required: icon-only controls must be named for screen readers. */
  accessibilityLabel: string;
  onPress?: () => unknown;
  accessibilityHint?: string;
  size?: number;
  color?: keyof ThemeColors;
  /** plain (default) or tonal (soft filled circle). */
  variant?: 'plain' | 'tonal';
  disabled?: boolean;
  loading?: boolean;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

/** Icon-only button with a 48×48 touch target. */
export function IconButton({
  icon,
  accessibilityLabel,
  onPress,
  accessibilityHint,
  size = 22,
  color = 'text',
  variant = 'plain',
  disabled,
  loading,
  testID,
  style,
}: IconButtonProps) {
  const theme = useTheme();
  const guard = usePressGuard(onPress);
  const busy = !!loading || guard.busy;
  return (
    <Pressable
      testID={testID}
      onPress={guard.onPress}
      disabled={disabled || busy}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!disabled || busy, busy }}
      hitSlop={4}
      style={({ pressed }) => [
        styles.base,
        {
          width: theme.touchTarget,
          height: theme.touchTarget,
          borderRadius: theme.touchTarget / 2,
          backgroundColor:
            variant === 'tonal' ? (pressed ? theme.colors.border : theme.colors.surfaceAlt) : pressed ? theme.colors.surfaceAlt : 'transparent',
          opacity: disabled ? 0.5 : 1,
        },
        style,
      ]}
    >
      {busy ? <ActivityIndicator color={theme.colors[color]} /> : <Icon name={icon} size={size} color={color} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
});
