import { Redirect, type Href } from 'expo-router';
import { useEffect, type ReactNode } from 'react';
import { View } from 'react-native';

import { LoadingState } from '@/components/LoadingState';
import { toast } from '@/components/Toast';
import { useSession } from '@/services/session';
import { useTheme } from '@/theme';
import type { Role } from '@/types/api';
import { homeHrefForRole } from '@/utils/identity';

function DeniedRedirect({ href }: { href: Href }) {
  useEffect(() => {
    toast.info("That page isn't available for your account.");
  }, []);
  return <Redirect href={href} />;
}

/**
 * Guard for a role's route group. Returns an element to render INSTEAD of the role's
 * navigator (loading / redirect), or null when the current user may enter.
 * - booting            → loading (splash is still visible)
 * - signedOut          → /login
 * - no user (offline without a cached snapshot) → / (shows a connection error)
 * - wrong role         → the user's own home + a short notice (another role's screens never render)
 */
export function useRoleGate(role: Role): ReactNode | null {
  const { status, user } = useSession();
  const theme = useTheme();
  if (status === 'booting') {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <LoadingState label="Loading your account…" />
      </View>
    );
  }
  if (status === 'signedOut') return <Redirect href="/login" />;
  if (!user) return <Redirect href="/" />;
  if (user.role !== role) return <DeniedRedirect href={homeHrefForRole(user.role)} />;
  return null;
}
