import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, Avatar, Button, Card, DetailRow, FormSection, IconButton, ListRow, Screen, TextField, toast } from '@/components';
import { toUpload } from '@/features/admin/people/api';
import { DetailLoader, ScreenTitle } from '@/features/admin/people/common/DetailLoader';
import { FormBanner } from '@/features/admin/people/common/FormBanner';
import { ImagePickField } from '@/features/admin/people/common/ImagePickField';
import { isSilentError, numberText, serverFieldOf, validateNumber, writeErrorMessage } from '@/features/admin/people/common/forms';
import { includesAny, SearchList } from '@/features/admin/people/common/SearchList';
import type { PickedFile } from '@/features/shared/media/pickers';
import { api, toFormData } from '@/services/api';
import { useApiMutation, useApiQuery } from '@/services/hooks';
import { useQueryKeys } from '@/services/queryKeys';
import { useSession } from '@/services/session';
import type { Stall } from '@/types/api';
import { formatDateTime, formatNumber } from '@/utils/format';

import { DeleteEntityButton, useEntityForm } from '../shared';

const enc = encodeURIComponent;

function useStallKeys() {
  const keys = useQueryKeys();
  return { list: keys.stalls(), detail: (id: string) => [...keys.stalls(), id] as const };
}

function useStall(id: string) {
  const k = useStallKeys();
  return useApiQuery<{ stall: Stall }, Stall>(k.detail(id), `/api/stalls/${enc(id)}`, { select: (r) => r.stall, enabled: !!id });
}

/** /admin/stalls */
export function StallsListScreen() {
  const k = useStallKeys();
  const query = useApiQuery<{ stalls: Stall[] }, Stall[]>(k.list, '/api/stalls', { select: (r) => r.stalls ?? [] });
  return (
    <>
      <ScreenTitle title="Stalls" />
      <SearchList<Stall>
        query={query}
        searchPlaceholder="Search name, number or type"
        matches={(s, q) => includesAny(q, s.name, s.number, s.type)}
        keyExtractor={(s) => s._id}
        renderItem={(s) => (
          <ListRow
            left={{ avatar: { uri: s.logo, name: s.name, id: s._id } }}
            title={s.name}
            subtitle={`No. ${s.number} · ${s.type}`}
            meta={`${formatNumber(s.eventCount ?? 0)} events · ${s.plans?.length ? s.plans[0] : 'No plans'}`}
            onPress={() => router.push(`/admin/stalls/${s._id}`)}
          />
        )}
        emptyTitle="No stalls yet"
        addLabel="Add stall"
        onAdd={() => router.push('/admin/stalls/new')}
      />
    </>
  );
}

type F = 'name' | 'number' | 'type' | 'eventCount';

/** Multipart body: repeated `plans` fields; an empty list is sent as one empty field so the server clears it. */
export function stallFormData(v: Record<F, string>, plans: string[], logo: PickedFile | null): FormData {
  const form = toFormData({ name: v.name.trim(), number: v.number.trim(), type: v.type.trim(), eventCount: v.eventCount.trim() }, { logo: toUpload(logo) });
  const clean = plans.map((p) => p.trim()).filter(Boolean);
  if (clean.length) clean.forEach((p) => form.append('plans', p));
  else form.append('plans', '');
  return form;
}

function StallForm({ stall }: { stall?: Stall }) {
  const k = useStallKeys();
  const { canWrite } = useSession();
  const { values, errors, setErrors, set } = useEntityForm<F>({
    name: stall?.name ?? '',
    number: stall?.number ?? '',
    type: stall?.type ?? '',
    eventCount: numberText(stall?.eventCount),
  });
  const [plans, setPlans] = useState<string[]>(stall?.plans?.length ? stall.plans : ['']);
  const [planError, setPlanError] = useState<string | null>(null);
  const [logo, setLogo] = useState<PickedFile | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const save = useApiMutation(
    () => {
      const body = stallFormData(values, plans, logo);
      return stall ? api.put<{ stall: Stall }>(`/api/stalls/${enc(stall._id)}`, body) : api.post<{ stall: Stall }>('/api/stalls', body);
    },
    { invalidate: stall ? [k.list, k.detail(stall._id)] : [k.list] },
  );

  const submit = async () => {
    setFormError(null);
    const e: Partial<Record<F, string>> = {};
    if (!values.name.trim()) e.name = 'Enter the stall name.';
    if (!values.number.trim()) e.number = 'Enter the stall number.';
    if (!values.type.trim()) e.type = 'Enter the stall type.';
    const n = validateNumber(values.eventCount, { label: 'Event count', integer: true, max: 1e6 });
    if (n) e.eventCount = n;
    setErrors(e);
    const pe = plans.some((p) => p.trim().length > 200) ? 'Each plan can be at most 200 characters.' : plans.length > 50 ? 'At most 50 plans.' : null;
    setPlanError(pe);
    if (Object.keys(e).length || pe) return;
    try {
      const res = await save.mutateAsync(undefined);
      toast.success(stall ? 'Stall saved.' : 'Stall added.');
      if (stall) router.back();
      else router.replace(`/admin/stalls/${res.stall._id}`);
    } catch (err) {
      if (isSilentError(err)) return;
      const field = serverFieldOf(err, ['name', 'number', 'type', 'eventCount'] as const);
      if (field) setErrors({ [field]: writeErrorMessage(err) });
      else setFormError(writeErrorMessage(err));
    }
  };

  return (
    <Screen keyboardAvoiding footer={<Button label={stall ? 'Save changes' : 'Add stall'} onPress={submit} disabled={!canWrite} testID="stall-submit" />}>
      <ScreenTitle title={stall ? `Edit ${stall.name}` : 'Add stall'} />
      <FormBanner error={formError} offline={!canWrite} />
      <ImagePickField label="Logo" name={values.name} currentUri={stall?.logo} value={logo} onChange={setLogo} helper="Optional. JPEG, up to 5 MB." />
      <FormSection title="Stall">
        <TextField label="Stall name" value={values.name} onChangeText={set('name')} required error={errors.name} maxLength={200} />
        <TextField label="Stall number" value={values.number} onChangeText={set('number')} required error={errors.number} maxLength={50} helper="e.g. ST-001" />
        <TextField label="Stall type" value={values.type} onChangeText={set('type')} required error={errors.type} maxLength={100} helper="e.g. Premium / Standard" />
        <TextField label="Event count" value={values.eventCount} onChangeText={set('eventCount')} keyboardType="number-pad" error={errors.eventCount} />
      </FormSection>
      <FormSection title="Plans" description="Empty rows are ignored.">
        {plans.map((p, i) => (
          <View key={i} style={styles.row}>
            <View style={styles.flex}>
              <TextField label={`Plan ${i + 1}`} value={p} onChangeText={(t) => setPlans((ps) => ps.map((x, j) => (j === i ? t : x)))} maxLength={200} />
            </View>
            <IconButton icon="trash-outline" color="danger" accessibilityLabel={`Remove plan ${i + 1}`} onPress={() => setPlans((ps) => ps.filter((_, j) => j !== i))} />
          </View>
        ))}
        {planError ? <AppText variant="secondary" color="danger" accessibilityRole="alert">{planError}</AppText> : null}
        <Button label="Add plan" icon="add" variant="secondary" onPress={() => setPlans((ps) => [...ps, ''])} disabled={plans.length >= 50} />
      </FormSection>
    </Screen>
  );
}

export function StallNewScreen() {
  return <StallForm />;
}

export function StallEditScreen() {
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const query = useStall(id);
  return <DetailLoader query={query} title="Edit stall">{(s) => <StallForm key={s._id} stall={s} />}</DetailLoader>;
}

export function StallDetailScreen() {
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const k = useStallKeys();
  const { canWrite } = useSession();
  const query = useStall(id);
  const [error, setError] = useState<string | null>(null);
  return (
    <DetailLoader query={query} title="Stall">
      {(s) => (
        <Screen onRefresh={() => query.refetch()} refreshing={query.isRefetching}>
          <ScreenTitle title={s.name} />
          <FormBanner error={error} offline={!canWrite} />
          <Card>
            <Avatar uri={s.logo} name={s.name} id={s._id} size={72} />
            <DetailRow label="Name" value={s.name} />
            <DetailRow label="Number" value={s.number} />
            <DetailRow label="Type" value={s.type} />
            <DetailRow label="Events" value={formatNumber(s.eventCount ?? 0)} />
            <DetailRow label="Plans" value={s.plans?.length ? s.plans.map((p) => `• ${p}`).join('\n') : null} placeholder="No plans" />
            <DetailRow label="Added" value={s.createdAt ? formatDateTime(s.createdAt) : null} />
            <DetailRow label="Last updated" value={s.updatedAt ? formatDateTime(s.updatedAt) : null} />
          </Card>
          <Button label="Edit stall" icon="create-outline" onPress={() => router.push(`/admin/stalls/${s._id}/edit`)} disabled={!canWrite} />
          <DeleteEntityButton noun="stall" name={s.name} path={`/api/stalls/${enc(s._id)}`} invalidate={[k.list]} detailKey={k.detail(s._id)} onError={setError} />
        </Screen>
      )}
    </DetailLoader>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  flex: { flex: 1 },
});
