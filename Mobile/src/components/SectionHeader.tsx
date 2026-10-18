import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme';

import { AppText } from './AppText';
import { Button } from './Button';

export interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
}

/** Section title (announced as a heading) with an optional text action. */
export function SectionHeader({ title, subtitle, actionLabel, onAction }: SectionHeaderProps) {
  const theme = useTheme();
  return (
    <View style={[styles.row, { marginTop: theme.spacing.lg, marginBottom: theme.spacing.xs }]}>
      <View style={styles.text}>
        <AppText variant="heading">{title}</AppText>
        {subtitle ? <AppText variant="secondary">{subtitle}</AppText> : null}
      </View>
      {actionLabel && onAction ? (
        <Button label={actionLabel} onPress={onAction} variant="ghost" fullWidth={false} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' },
  text: { flexShrink: 1, flexGrow: 1 },
});
