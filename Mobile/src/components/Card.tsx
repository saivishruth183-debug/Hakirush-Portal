import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme';

export interface CardProps {
  children: ReactNode;
  /** Makes the whole card a button. Provide accessibilityLabel describing the card. */
  onPress?: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  /** Inner padding (default true). */
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** Surface container with border + radius. */
export function Card({ children, onPress, accessibilityLabel, accessibilityHint, padded = true, style, testID }: CardProps) {
  const theme = useTheme();
  const base: ViewStyle = {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.lg,
    padding: padded ? theme.spacing.lg : 0,
  };
  if (onPress) {
    return (
      <Pressable
        testID={testID}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        style={({ pressed }) => [styles.card, base, pressed && { backgroundColor: theme.colors.surfaceAlt }, style]}
      >
        {children}
      </Pressable>
    );
  }
  return (
    <View testID={testID} style={[styles.card, base, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth * 2, gap: 8 },
});
