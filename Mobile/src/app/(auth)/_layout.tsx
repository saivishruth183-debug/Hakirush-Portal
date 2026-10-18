import { Redirect, Stack } from 'expo-router';

import { useSession } from '@/services/session';
import { homeHrefForRole } from '@/utils/identity';

/** Auth group: only for signed-out users. A signed-in user is sent to their home. */
export default function AuthLayout() {
  const { status, user } = useSession();
  if ((status === 'authenticated' || status === 'offlineUnverified') && user) {
    return <Redirect href={homeHrefForRole(user.role)} />;
  }
  return <Stack screenOptions={{ headerShown: false }} />;
}
