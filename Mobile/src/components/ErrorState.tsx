import { StyleSheet, View } from 'react-native';

import { getErrorMessage, isApiError } from '@/services/api/errors';
import { useTheme } from '@/theme';

import { AppText } from './AppText';
import { Button } from './Button';
import { Icon } from './Icon';

export interface ErrorStateProps {
  /** Thrown error (ApiError aware) — used for the message when `message` is not given. */
  error?: unknown;
  title?: string;
  message?: string;
  onRetry?: () => unknown;
  retryLabel?: string;
}

/** Error block with an optional Retry button. Announced to screen readers. */
export function ErrorState({ error, title, message, onRetry, retryLabel = 'Try again' }: ErrorStateProps) {
  const theme = useTheme();
  const offline = isApiError(error) && (error.kind === 'network' || error.kind === 'timeout');
  const forbidden = isApiError(error) && error.status === 403;
  const heading = title ?? (offline ? "Can't connect" : forbidden ? 'No access' : 'Something went wrong');
  const body = message ?? getErrorMessage(error);
  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={[styles.wrap, { padding: theme.spacing.xl, gap: theme.spacing.md }]}
    >
      <View style={[styles.iconCircle, { backgroundColor: theme.colors.dangerBg }]}>
        <Icon name={offline ? 'cloud-offline-outline' : 'alert-circle-outline'} size={32} color="danger" />
      </View>
      <AppText variant="heading" align="center">
        {heading}
      </AppText>
      <AppText variant="body" color="textSecondary" align="center">
        {body}
      </AppText>
      {onRetry && !forbidden ? <Button label={retryLabel} onPress={onRetry} variant="secondary" fullWidth={false} icon="refresh" /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  iconCircle: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
});
