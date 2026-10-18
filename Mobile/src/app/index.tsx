import { Redirect } from 'expo-router';
import { View } from 'react-native';

import { Button, ErrorState, LoadingState, Screen } from '@/components';
import { useSession } from '@/services/session';
import { useTheme } from '@/theme';
import { homeHrefForRole } from '@/utils/identity';

/** Entry: routes by session status / role. Nothing here is user content. */
export default function Index() {
  const theme = useTheme();
  const { status, user, bootError, retryBoot, retryVerification, logout } = useSession();

  if (bootError) {
    return (
      <Screen edges={['top', 'bottom']} showOfflineBanner={false} contentContainerStyle={{ justifyContent: 'center' }}>
        <ErrorState title="Couldn't start" message={bootError} onRetry={retryBoot} />
      </Screen>
    );
  }
  if (status === 'booting') {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <LoadingState label="Starting Hakirush Portal…" />
      </View>
    );
  }
  if (status === 'signedOut') return <Redirect href="/login" />;
  if (!user) {
    // offlineUnverified without a cached profile: we cannot show any role shell yet.
    return (
      <Screen edges={['top', 'bottom']} contentContainerStyle={{ justifyContent: 'center' }}>
        <ErrorState
          title="Can't connect"
          message="We couldn't reach the server to verify your sign-in. Check your connection and try again."
          onRetry={retryVerification}
        />
        <Button label="Sign out" variant="ghost" onPress={logout} />
      </Screen>
    );
  }
  return <Redirect href={homeHrefForRole(user.role)} />;
}
