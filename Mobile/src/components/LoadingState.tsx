import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme';

import { AppText } from './AppText';

export interface LoadingStateProps {
  /** Spoken and (for spinner) visible label. */
  label?: string;
  /** spinner (default) or skeleton rows for lists. */
  variant?: 'spinner' | 'skeleton';
  /** Number of skeleton rows. */
  rows?: number;
}

/** Loading indicator. Skeletons are static blocks (no animation → no motion issues). */
export function LoadingState({ label = 'Loading…', variant = 'spinner', rows = 4 }: LoadingStateProps) {
  const theme = useTheme();
  if (variant === 'skeleton') {
    return (
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={label}
        accessibilityState={{ busy: true }}
        style={{ gap: theme.spacing.md, padding: theme.spacing.lg }}
      >
        {Array.from({ length: rows }, (_, i) => (
          <View key={i} style={styles.skeletonRow}>
            <View style={[styles.skeletonAvatar, { backgroundColor: theme.colors.skeleton }]} />
            <View style={styles.skeletonText}>
              <View style={[styles.skeletonLine, { width: '70%', backgroundColor: theme.colors.skeleton }]} />
              <View style={[styles.skeletonLine, { width: '45%', backgroundColor: theme.colors.skeleton }]} />
            </View>
          </View>
        ))}
      </View>
    );
  }
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityState={{ busy: true }}
      style={[styles.center, { padding: theme.spacing.xl, gap: theme.spacing.md }]}
    >
      <ActivityIndicator size="large" color={theme.colors.primary} />
      <AppText variant="secondary" align="center">
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center', flexGrow: 1 },
  skeletonRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  skeletonAvatar: { width: 44, height: 44, borderRadius: 22 },
  skeletonText: { flex: 1, gap: 8 },
  skeletonLine: { height: 12, borderRadius: 6 },
});
