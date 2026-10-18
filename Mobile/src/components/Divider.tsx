import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme';

/** Hairline separator. `inset` indents it (e.g. to align with list text after an avatar). */
export function Divider({ inset = 0 }: { inset?: number }) {
  const theme = useTheme();
  return (
    <View
      importantForAccessibility="no"
      accessibilityElementsHidden
      style={{ height: StyleSheet.hairlineWidth, backgroundColor: theme.colors.border, marginLeft: inset }}
    />
  );
}
