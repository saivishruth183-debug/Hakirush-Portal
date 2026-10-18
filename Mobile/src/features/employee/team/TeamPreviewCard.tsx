import { useRouter } from 'expo-router';

import { AppText, Button, Card, Divider, QueryStateView } from '@/components';
import { useApiQuery } from '@/services/hooks';
import { useQueryKeys } from '@/services/queryKeys';
import { useSession } from '@/services/session';
import type { TeamResponse } from '@/types/api';

import { PersonRow } from './PersonRow';
import { buildTeamView } from './teamSections';

/** Home preview: manager first + up to 4 colleagues, "View all" → Team tab. */
export function TeamPreviewCard() {
  const { directoryVerified } = useSession();
  if (!directoryVerified) {
    return (
      <Card>
        <AppText variant="heading">My team</AppText>
        <AppText variant="secondary">Connect to load your team.</AppText>
      </Card>
    );
  }
  return <TeamPreview />;
}

function TeamPreview() {
  const router = useRouter();
  const keys = useQueryKeys();
  const { user } = useSession();
  const q = useApiQuery<TeamResponse>(keys.team({ limit: 5 }), '/api/employee/team/me', { query: { page: 1, limit: 5 } });
  return (
    <Card padded={false}>
      <QueryStateView query={q} loadingVariant="skeleton">
        {(data) => {
          if (data.managerStatus === 'no_department') {
            return (
              <AppText variant="secondary" style={{ padding: 16 }}>
                Department not assigned. Contact HR to be added to a team.
              </AppText>
            );
          }
          const view = buildTeamView([data], user?._id, '');
          const rows = [
            ...view.sections[0].data,
            ...view.sections[1].data.filter((r) => r.kind === 'person' && !r.isSelf).slice(0, 4),
          ];
          return (
            <>
              <AppText variant="heading" style={{ paddingHorizontal: 16, paddingTop: 16 }}>
                {data.department ? `${data.department.name} team` : 'My team'}
              </AppText>
              {rows.map((r, i) => (
                <PreviewRow key={r.key} row={r} first={i === 0} />
              ))}
              <Button label="View all" variant="ghost" onPress={() => router.navigate('/employee/team')} />
            </>
          );
        }}
      </QueryStateView>
    </Card>
  );
}

function PreviewRow({ row, first }: { row: ReturnType<typeof buildTeamView>['sections'][number]['data'][number]; first: boolean }) {
  return (
    <>
      {first ? null : <Divider inset={72} />}
      {row.kind === 'person' ? (
        <PersonRow person={row.person} isManager={row.isManager} isSelf={row.isSelf} />
      ) : row.kind === 'unassigned' ? (
        <AppText variant="secondary" style={{ padding: 16 }}>
          Manager not assigned
        </AppText>
      ) : null}
    </>
  );
}
