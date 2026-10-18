import { StyleSheet, View } from 'react-native';

import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useSession } from '@/services/session';
import { useTheme } from '@/theme';

import { AppText } from './AppText';
import { Button } from './Button';
import { Icon } from './Icon';

export interface OfflineBannerProps {
  /** Override the message. */
  message?: string;
}

/**
 * Shows when the device is offline or the session could not be verified (offlineUnverified).
 * Renders nothing otherwise. Role layouts already include it above the tabs.
 */
export function OfflineBanner({ message }: OfflineBannerProps) {
  const theme = useTheme();
  const { isOffline } = useNetworkStatus();
  const { status, retryVerification } = useSession();
  const unverified = status === 'offlineUnverified';
  if (!isOffline && !unverified) return null;

  const text =
    message ??
    (isOffline
      ? "You're offline. Showing saved information; changes are paused until you reconnect."
      : "Can't reach the server. Showing saved information; changes are paused.");

  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={[
        styles.banner,
        { backgroundColor: theme.colors.warningBg, borderColor: theme.colors.warning, padding: theme.spacing.md, gap: theme.spacing.sm },
      ]}
    >
      <View style={styles.row}>
        <Icon name="cloud-offline-outline" color="warning" />
        <AppText variant="secondary" style={[styles.text, { color: theme.colors.warning }]}>
          {text}
        </AppText>
      </View>
      {unverified && !isOffline ? (
        <Button label="Retry now" variant="ghost" fullWidth={false} onPress={retryVerification} icon="refresh" />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { borderBottomWidth: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  text: { flex: 1 },
});
