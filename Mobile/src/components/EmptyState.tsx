import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme';

import { AppText } from './AppText';
import { Button } from './Button';
import { Icon, type IconName } from './Icon';

export interface EmptyStateProps {
  title: string;
  message?: string;
  icon?: IconName;
  actionLabel?: string;
  onAction?: () => unknown;
}

/** Friendly "nothing here yet" block. */
export function EmptyState({ title, message, icon = 'file-tray-outline', actionLabel, onAction }: EmptyStateProps) {
  const theme = useTheme();
  return (
    <View style={[styles.wrap, { padding: theme.spacing.xl, gap: theme.spacing.md }]}>
      <View style={[styles.iconCircle, { backgroundColor: theme.colors.surfaceAlt }]}>
        <Icon name={icon} size={32} color="textSecondary" />
      </View>
      <AppText variant="heading" align="center">
        {title}
      </AppText>
      {message ? (
        <AppText variant="body" color="textSecondary" align="center">
          {message}
        </AppText>
      ) : null}
      {actionLabel && onAction ? <Button label={actionLabel} onPress={onAction} variant="secondary" fullWidth={false} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  iconCircle: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
});
