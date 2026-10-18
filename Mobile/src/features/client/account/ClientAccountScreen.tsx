import { useRouter } from 'expo-router';

import { AppText, Card, DetailRow, Divider, ListRow, QueryStateView, Screen, SectionHeader } from '@/components';
import { ProfileHeader } from '@/features/account/ProfileHeader';
import { useSignOut } from '@/features/account/useSignOut';
import { useSession } from '@/services/session';
import { formatDate } from '@/utils/format';

import { useMyClient } from '../api';
import { resolveMediaUrl } from '../utils';

/** Client "Account" tab: company profile, plan details, Change password and Sign out. */
export function ClientAccountScreen() {
  const router = useRouter();
  const { user, canWrite } = useSession();
  const signOut = useSignOut();
  const me = useMyClient();
  if (!user) return null;
  const client = me.data?.client;
  const headerUser = {
    ...user,
    name: client?.userId?.name || user.name,
    email: client?.userId?.email || user.email,
    profileImage: resolveMediaUrl(client?.companyLogo) ?? user.profileImage,
  };

  return (
    <Screen refreshing={me.isRefetching} onRefresh={() => void me.refetch()}>
      <ProfileHeader user={headerUser} />
      <SectionHeader title="Account details" />
      <QueryStateView query={me} loadingVariant="skeleton" errorTitle="Couldn't load your plan">
        {(data) => (
          <Card>
            <DetailRow label="Email" value={data.client.userId?.email || user.email} />
            <DetailRow label="Plan" value={data.client.planType ? `${data.client.planType} plan` : ''} />
            <DetailRow label="Member since" value={formatDate(data.client.dateOfJoining, '')} />
          </Card>
        )}
      </QueryStateView>
      <SectionHeader title="Account" />
      <Card padded={false}>
        <ListRow
          title="Change password"
          subtitle={canWrite ? undefined : 'Available when you are back online'}
          left={{ icon: 'key-outline' }}
          onPress={() => router.push('/client/change-password')}
          disabled={!canWrite}
        />
        <Divider inset={68} />
        <ListRow title="Sign out" left={{ icon: 'log-out-outline', tone: 'danger' }} destructive onPress={signOut} chevron={false} />
      </Card>
      <AppText variant="caption" align="center">
        Hakirush Portal
      </AppText>
    </Screen>
  );
}
