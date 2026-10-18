import { useCallback } from 'react';

import { confirm } from '@/components/confirm';
import { useSession } from '@/services/session';

/** Returns a handler that asks for confirmation, then signs out (clears all local data). */
export function useSignOut(): () => Promise<void> {
  const { logout } = useSession();
  return useCallback(async () => {
    const ok = await confirm({
      title: 'Sign out?',
      message: 'You will need your email and password to sign in again. Saved data on this device will be removed.',
      confirmLabel: 'Sign out',
      destructive: true,
    });
    if (ok) await logout();
  }, [logout]);
}
