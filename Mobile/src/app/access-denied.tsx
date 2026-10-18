import { useRouter } from 'expo-router';

import { Button, EmptyState, Screen } from '@/components';
import { useSession } from '@/services/session';
import { homeHrefForRole } from '@/utils/identity';

/** Shown when a screen is not available for the signed-in account (e.g. after a 403). */
export default function AccessDenied() {
  const router = useRouter();
  const { user } = useSession();
  return (
    <Screen edges={['top', 'bottom']} contentContainerStyle={{ justifyContent: 'center' }}>
      <EmptyState
        icon="lock-closed-outline"
        title="Access denied"
        message="This page isn't available for your account."
      />
      <Button
        label={user ? 'Go to my home' : 'Sign in'}
        onPress={() => router.replace(user ? homeHrefForRole(user.role) : '/login')}
      />
    </Screen>
  );
}
