import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme';

import { AppText } from './AppText';

export interface DetailRowProps {
  label: string;
  /** Text/number value, or a custom node (then pass accessibilityValue for screen readers). */
  value: ReactNode;
  /** Shown when value is null/undefined/'' (default "—", read as "Not provided"). */
  placeholder?: string;
  accessibilityValue?: string;
}

/** Label/value pair for detail screens. Stacked so long values wrap with large fonts. */
export function DetailRow({ label, value, placeholder = '—', accessibilityValue }: DetailRowProps) {
  const theme = useTheme();
  const isEmpty = value === null || value === undefined || value === '';
  const isText = typeof value === 'string' || typeof value === 'number';
  const spoken = accessibilityValue ?? (isEmpty ? 'Not provided' : isText ? String(value) : undefined);
  return (
    <View
      accessible={isText || isEmpty || !!accessibilityValue}
      accessibilityLabel={spoken !== undefined ? `${label}: ${spoken}` : undefined}
      style={[styles.row, { paddingVertical: theme.spacing.sm }]}
    >
      <AppText variant="secondary">{label}</AppText>
      {isEmpty ? (
        <AppText variant="body" color="textMuted">
          {placeholder}
        </AppText>
      ) : isText ? (
        <AppText variant="body" selectable>
          {String(value)}
        </AppText>
      ) : (
        value
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { gap: 2 },
});
