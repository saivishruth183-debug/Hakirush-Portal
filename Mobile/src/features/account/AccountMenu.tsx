import { useRouter, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import { AppText, Card, Divider, ListRow, Screen, SectionHeader } from '@/components';
import { useSession } from '@/services/session';

import { ProfileHeader } from './ProfileHeader';
import { useSignOut } from './useSignOut';

export interface AccountMenuProps {
  /** Route of this role's change-password screen, e.g. '/employee/change-password'. */
  changePasswordHref: Href;
  /** Role-specific rows rendered above the account section (feature agents add theirs here). */
  children?: ReactNode;
}

/** Shared More/Account screen body: profile header, role links, Change password, Sign out. */
export function AccountMenu({ changePasswordHref, children }: AccountMenuProps) {
  const router = useRouter();
  const { user, canWrite } = useSession();
  const signOut = useSignOut();
  if (!user) return null;
  return (
    <Screen>
      <ProfileHeader user={user} />
      {children}
      <SectionHeader title="Account" />
      <Card padded={false}>
        <ListRow
          title="Change password"
          subtitle={canWrite ? undefined : 'Available when you are back online'}
          left={{ icon: 'key-outline' }}
          onPress={() => router.push(changePasswordHref)}
          disabled={!canWrite}
        />
        <Divider inset={68} />
        <ListRow title="Sign out" left={{ icon: 'log-out-outline', tone: 'danger' }} destructive onPress={signOut} chevron={false} />
      </Card>
      <View>
        <AppText variant="caption" align="center">
          Hakirush Portal
        </AppText>
      </View>
    </Screen>
  );
}
