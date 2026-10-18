import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme';

import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';
import { usePressGuard } from './usePressGuard';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';

export interface ButtonProps {
  label: string;
  /** May return a promise: the button shows a spinner and ignores presses until it settles. */
  onPress?: () => unknown;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  icon?: IconName;
  /** Stretch to the container width (default true). */
  fullWidth?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

/** Primary / secondary / ghost / destructive button. ≥48dp tall, prevents double presses. */
export function Button({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  icon,
  fullWidth = true,
  accessibilityLabel,
  accessibilityHint,
  testID,
  style,
}: ButtonProps) {
  const theme = useTheme();
  const { colors } = theme;
  const guard = usePressGuard(onPress);
  const isBusy = loading || guard.busy;
  const isDisabled = disabled || isBusy;

  const palette = {
    primary: { bg: colors.primary, bgPressed: colors.primaryPressed, fg: colors.onPrimary, border: colors.primary },
    secondary: { bg: colors.surface, bgPressed: colors.surfaceAlt, fg: colors.primary, border: colors.borderStrong },
    ghost: { bg: 'transparent', bgPressed: colors.surfaceAlt, fg: colors.primary, border: 'transparent' },
    destructive: { bg: colors.danger, bgPressed: colors.dangerPressed, fg: colors.onDanger, border: colors.danger },
  }[variant];

  return (
    <Pressable
      testID={testID}
      onPress={guard.onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: isDisabled, busy: isBusy }}
      style={({ pressed }) => [
        styles.base,
        {
          minHeight: theme.touchTarget,
          borderRadius: theme.radii.md,
          backgroundColor: pressed ? palette.bgPressed : palette.bg,
          borderColor: palette.border,
          paddingHorizontal: theme.spacing.lg,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
          opacity: disabled && !isBusy ? 0.5 : 1,
        },
        style,
      ]}
    >
      <View style={styles.content}>
        {isBusy ? (
          <ActivityIndicator color={palette.fg} accessibilityElementsHidden importantForAccessibility="no" />
        ) : icon ? (
          <Icon name={icon} size={20} color={palette.fg} />
        ) : null}
        <AppText variant="bodyStrong" style={{ color: palette.fg }} align="center">
          {label}
        </AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: 1,
    justifyContent: 'center',
    paddingVertical: 10,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
});
