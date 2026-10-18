import { View } from 'react-native';

import { AppText, Button, Card } from '@/components';
import { useTheme } from '@/theme';

export interface FormBannerProps {
  /** Form-level error (server message). */
  error?: string | null;
  /** Show the "offline, changes paused" notice. */
  offline?: boolean;
  /** Optional action next to the error (e.g. "Reload"). */
  actionLabel?: string;
  onAction?: () => unknown;
  testID?: string;
}

/** Offline notice + form-level error, announced to screen readers. */
export function FormBanner({ error, offline, actionLabel, onAction, testID }: FormBannerProps) {
  const theme = useTheme();
  if (!error && !offline) return null;
  return (
    <View style={{ gap: theme.spacing.sm }} testID={testID}>
      {offline ? (
        <AppText variant="secondary" color="warning">
          You are offline or your session is not verified. Changes are paused until you reconnect.
        </AppText>
      ) : null}
      {error ? (
        <Card style={{ backgroundColor: theme.colors.dangerBg, borderColor: theme.colors.danger }}>
          <AppText variant="body" color="danger" accessibilityRole="alert" accessibilityLiveRegion="assertive">
            {error}
          </AppText>
          {actionLabel && onAction ? <Button label={actionLabel} variant="secondary" onPress={onAction} fullWidth={false} /> : null}
        </Card>
      ) : null}
    </View>
  );
}
