import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { Avatar, Button, Card, DetailRow, FormSection, ListRow, Screen, SelectField, TextField, toast } from '@/components';
import { toUpload } from '@/features/admin/people/api';
import { DetailLoader, ScreenTitle } from '@/features/admin/people/common/DetailLoader';
import { FormBanner } from '@/features/admin/people/common/FormBanner';
import { ImagePickField } from '@/features/admin/people/common/ImagePickField';
import { isSilentError, numberText, serverFieldOf, validateNumber, writeErrorMessage } from '@/features/admin/people/common/forms';
import { COLLABORATIONS, toOptions } from '@/features/admin/people/common/options';
import { includesAny, SearchList } from '@/features/admin/people/common/SearchList';
import type { PickedFile } from '@/features/shared/media/pickers';
import { api, toFormData } from '@/services/api';
import { useApiMutation, useApiQuery } from '@/services/hooks';
import { useQueryKeys } from '@/services/queryKeys';
import { useSession } from '@/services/session';
import type { Sponsor } from '@/types/api';
import { formatDateTime, formatNumber } from '@/utils/format';

import { DeleteEntityButton, useEntityForm } from '../shared';

const enc = encodeURIComponent;

function useSponsorKeys() {
  const keys = useQueryKeys();
  return { list: keys.sponsors(), detail: (id: string) => [...keys.sponsors(), id] as const };
}

function useSponsor(id: string) {
  const k = useSponsorKeys();
  return useApiQuery<{ sponsor: Sponsor }, Sponsor>(k.detail(id), `/api/sponsors/${enc(id)}`, { select: (r) => r.sponsor, enabled: !!id });
}

/** /admin/sponsors */
export function SponsorsListScreen() {
  const k = useSponsorKeys();
  const query = useApiQuery<{ sponsors: Sponsor[] }, Sponsor[]>(k.list, '/api/sponsors', { select: (r) => r.sponsors ?? [] });
  return (
    <>
      <ScreenTitle title="Sponsors" />
      <SearchList<Sponsor>
        query={query}
        searchPlaceholder="Search sponsors or collaboration"
        matches={(s, q) => includesAny(q, s.name, s.collaboration, s.reach)}
        keyExtractor={(s) => s._id}
        renderItem={(s) => (
          <ListRow
            left={{ avatar: { uri: s.logo, name: s.name, id: s._id } }}
            title={s.name}
            subtitle={s.collaboration}
            meta={`${formatNumber(s.eventsSponsored ?? 0)} events · Reach ${s.reach || '—'}`}
            onPress={() => router.push(`/admin/sponsors/${s._id}`)}
          />
        )}
        emptyTitle="No sponsors yet"
        addLabel="Add sponsor"
        onAdd={() => router.push('/admin/sponsors/new')}
      />
    </>
  );
}

type F = 'name' | 'collaboration' | 'eventsSponsored' | 'reach' | 'upcomingEvents';

function SponsorForm({ sponsor }: { sponsor?: Sponsor }) {
  const k = useSponsorKeys();
  const { canWrite } = useSession();
  const { values, errors, setErrors, set } = useEntityForm<F>({
    name: sponsor?.name ?? '',
    collaboration: sponsor?.collaboration ?? '',
    eventsSponsored: numberText(sponsor?.eventsSponsored),
    reach: sponsor?.reach ?? '',
    upcomingEvents: sponsor?.upcomingEvents ?? '',
  });
  const [logo, setLogo] = useState<PickedFile | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const save = useApiMutation(
    () => {
      const body = toFormData(
        { name: values.name.trim(), collaboration: values.collaboration, eventsSponsored: values.eventsSponsored.trim(), reach: values.reach.trim(), upcomingEvents: values.upcomingEvents.trim() },
        { logo: toUpload(logo) },
      );
      return sponsor ? api.put<{ sponsor: Sponsor }>(`/api/sponsors/${enc(sponsor._id)}`, body) : api.post<{ sponsor: Sponsor }>('/api/sponsors/add', body);
    },
    { invalidate: sponsor ? [k.list, k.detail(sponsor._id)] : [k.list] },
  );

  const submit = async () => {
    setFormError(null);
    const e: Partial<Record<F, string>> = {};
    if (!values.name.trim()) e.name = 'Enter the sponsor name.';
    if (!values.collaboration) e.collaboration = 'Choose the collaboration type.';
    if (!values.reach.trim()) e.reach = 'Enter the reach, e.g. 2.5M impressions.';
    const n = validateNumber(values.eventsSponsored, { label: 'Events sponsored', integer: true, max: 1e6 });
    if (n) e.eventsSponsored = n;
    setErrors(e);
    if (Object.keys(e).length) return;
    try {
      const res = await save.mutateAsync(undefined);
      toast.success(sponsor ? 'Sponsor saved.' : 'Sponsor added.');
      if (sponsor) router.back();
      else router.replace(`/admin/sponsors/${res.sponsor._id}`);
    } catch (err) {
      if (isSilentError(err)) return;
      const field = serverFieldOf(err, ['name', 'collaboration', 'eventsSponsored', 'reach', 'upcomingEvents'] as const);
      if (field) setErrors({ [field]: writeErrorMessage(err) });
      else setFormError(writeErrorMessage(err));
    }
  };

  return (
    <Screen keyboardAvoiding footer={<Button label={sponsor ? 'Save changes' : 'Add sponsor'} onPress={submit} disabled={!canWrite} testID="sponsor-submit" />}>
      <ScreenTitle title={sponsor ? `Edit ${sponsor.name}` : 'Add sponsor'} />
      <FormBanner error={formError} offline={!canWrite} />
      <ImagePickField label="Logo" name={values.name} currentUri={sponsor?.logo} value={logo} onChange={setLogo} helper="Optional. JPEG, up to 5 MB." />
      <FormSection title="Sponsor">
        <TextField label="Sponsor name" value={values.name} onChangeText={set('name')} required error={errors.name} maxLength={200} />
        <SelectField label="Collaboration type" value={values.collaboration} options={toOptions(COLLABORATIONS)} onChange={set('collaboration')} required error={errors.collaboration} />
        <TextField label="Events sponsored" value={values.eventsSponsored} onChangeText={set('eventsSponsored')} keyboardType="number-pad" error={errors.eventsSponsored} />
        <TextField label="Market reach" value={values.reach} onChangeText={set('reach')} required error={errors.reach} maxLength={200} />
        <TextField label="Upcoming events" value={values.upcomingEvents} onChangeText={set('upcomingEvents')} multiline error={errors.upcomingEvents} maxLength={2000} />
      </FormSection>
    </Screen>
  );
}

export function SponsorNewScreen() {
  return <SponsorForm />;
}

export function SponsorEditScreen() {
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const query = useSponsor(id);
  return <DetailLoader query={query} title="Edit sponsor">{(s) => <SponsorForm key={s._id} sponsor={s} />}</DetailLoader>;
}

export function SponsorDetailScreen() {
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const k = useSponsorKeys();
  const { canWrite } = useSession();
  const query = useSponsor(id);
  const [error, setError] = useState<string | null>(null);
  return (
    <DetailLoader query={query} title="Sponsor">
      {(s) => (
        <Screen onRefresh={() => query.refetch()} refreshing={query.isRefetching}>
          <ScreenTitle title={s.name} />
          <FormBanner error={error} offline={!canWrite} />
          <Card>
            <Avatar uri={s.logo} name={s.name} id={s._id} size={72} />
            <DetailRow label="Name" value={s.name} />
            <DetailRow label="Collaboration" value={s.collaboration} />
            <DetailRow label="Events sponsored" value={formatNumber(s.eventsSponsored ?? 0)} />
            <DetailRow label="Market reach" value={s.reach} />
            <DetailRow label="Upcoming events" value={s.upcomingEvents} />
            <DetailRow label="Added" value={s.createdAt ? formatDateTime(s.createdAt) : null} />
            <DetailRow label="Last updated" value={s.updatedAt ? formatDateTime(s.updatedAt) : null} />
          </Card>
          <Button label="Edit sponsor" icon="create-outline" onPress={() => router.push(`/admin/sponsors/${s._id}/edit`)} disabled={!canWrite} />
          <DeleteEntityButton noun="sponsor" name={s.name} path={`/api/sponsors/${enc(s._id)}`} invalidate={[k.list]} detailKey={k.detail(s._id)} onError={setError} />
        </Screen>
      )}
    </DetailLoader>
  );
}
