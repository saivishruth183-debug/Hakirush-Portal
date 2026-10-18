import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  AppText,
  Avatar,
  Button,
  Card,
  DateField,
  DetailRow,
  FormSection,
  ListRow,
  Screen,
  SegmentedControl,
  TextField,
  toast,
} from '@/components';
import { DetailLoader, ScreenTitle } from '@/features/admin/people/common/DetailLoader';
import { FormBanner } from '@/features/admin/people/common/FormBanner';
import { ImagePickField } from '@/features/admin/people/common/ImagePickField';
import { isSilentError, isValidEmail, isoToYmd, numberText, serverFieldOf, validateNumber, writeErrorMessage } from '@/features/admin/people/common/forms';
import { includesAny, SearchList } from '@/features/admin/people/common/SearchList';
import { toUpload } from '@/features/admin/people/api';
import type { PickedFile } from '@/features/shared/media/pickers';
import { api, toFormData } from '@/services/api';
import { useApiMutation, useApiQuery } from '@/services/hooks';
import { useQueryKeys } from '@/services/queryKeys';
import { useSession } from '@/services/session';
import { useTheme } from '@/theme';
import type { Client, PlanType } from '@/types/api';
import { businessDate, formatCurrency, formatDate, formatDateTime } from '@/utils/format';

import { DeleteEntityButton, useEntityForm } from '../shared';

const enc = encodeURIComponent;

export function useClients() {
  const keys = useQueryKeys();
  return useApiQuery<{ clients: Client[] }, Client[]>(keys.clients(), '/api/client', { select: (r) => r.clients ?? [] });
}

export function useClient(id: string) {
  const keys = useQueryKeys();
  return useApiQuery<{ client: Client }, Client>(keys.client(id), `/api/client/${enc(id)}`, { select: (r) => r.client, enabled: !!id });
}

const clientName = (c: Client) => c.userId?.name || 'Unnamed client';

/** /admin/clients */
export function ClientsListScreen() {
  const query = useClients();
  return (
    <>
      <ScreenTitle title="Clients" />
      <SearchList<Client>
        query={query}
        testID="clients-list"
        searchPlaceholder="Search clients or plans"
        matches={(c, q) => includesAny(q, c.userId?.name, c.userId?.email, c.planType)}
        keyExtractor={(c) => c._id}
        summary={(all) => (
          <AppText variant="secondary">
            {all.length} {all.length === 1 ? 'client' : 'clients'} · total budget {formatCurrency(all.reduce((s, c) => s + (Number(c.budget) || 0), 0), { whole: true })}
          </AppText>
        )}
        renderItem={(c) => (
          <ListRow
            left={{ avatar: { uri: c.companyLogo, name: clientName(c), id: c._id } }}
            title={clientName(c)}
            subtitle={`${c.planType} plan · ${formatCurrency(c.budget, { whole: true })}`}
            meta={c.dateOfJoining ? `Joined ${formatDate(isoToYmd(c.dateOfJoining))}` : undefined}
            onPress={() => router.push(`/admin/clients/${c._id}`)}
          />
        )}
        emptyTitle="No clients yet"
        emptyMessage="Add a client to give them access to the client app."
        addLabel="Add client"
        onAdd={() => router.push('/admin/clients/new')}
      />
    </>
  );
}

type ClientField = 'name' | 'email' | 'password' | 'dateOfJoining' | 'planType' | 'budget' | 'logo';

function PlanPicker({ value, onChange }: { value: string; onChange: (p: PlanType) => void }) {
  return (
    <View style={{ gap: 6 }}>
      <AppText variant="label">Plan type (required)</AppText>
      <SegmentedControl<PlanType>
        accessibilityLabel="Plan type"
        value={(value || 'Annual') as PlanType}
        onChange={onChange}
        options={[
          { label: 'Annual', value: 'Annual' },
          { label: 'Quarterly', value: 'Quarterly' },
        ]}
      />
    </View>
  );
}

function clientFieldError(e: unknown): { field: ClientField | null; message: string } {
  const message = writeErrorMessage(e);
  if (/email/i.test(message)) return { field: 'email', message };
  if (/logo/i.test(message)) return { field: 'logo', message };
  return { field: serverFieldOf(e, ['name', 'email', 'password', 'dateOfJoining', 'planType', 'budget'] as const), message };
}

/** /admin/clients/new */
export function ClientNewScreen() {
  const keys = useQueryKeys();
  const { canWrite } = useSession();
  const { values, errors, setErrors, set } = useEntityForm<ClientField>({
    name: '', email: '', password: '', dateOfJoining: businessDate(), planType: 'Annual', budget: '', logo: '',
  });
  const [logo, setLogo] = useState<PickedFile | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const create = useApiMutation(
    () =>
      api.post<{ client: Client }>(
        '/api/client/add',
        toFormData(
          { name: values.name.trim(), email: values.email.trim(), password: values.password, dateOfJoining: values.dateOfJoining, planType: values.planType, budget: values.budget.trim() },
          { companyLogo: toUpload(logo) },
        ),
      ),
    { invalidate: [keys.clients()] },
  );

  const submit = async () => {
    setFormError(null);
    const e: Partial<Record<ClientField, string>> = {};
    if (!values.name.trim()) e.name = 'Enter the client name.';
    if (!isValidEmail(values.email)) e.email = 'Enter a valid email address.';
    if (values.password.length < 8 || values.password.length > 128) e.password = 'Use 8 to 128 characters.';
    if (!values.dateOfJoining) e.dateOfJoining = 'Choose the onboarding date.';
    const b = validateNumber(values.budget, { label: 'Budget', required: true, max: 1e12 });
    if (b) e.budget = b;
    if (!logo) e.logo = 'A company logo is required.';
    setErrors(e);
    if (Object.keys(e).length) return;
    try {
      const res = await create.mutateAsync(undefined);
      toast.success(`${values.name.trim()} was added.`);
      router.replace(`/admin/clients/${res.client._id}`);
    } catch (err) {
      if (isSilentError(err)) return;
      const r = clientFieldError(err);
      if (r.field) setErrors({ [r.field]: r.message });
      else setFormError(r.message);
    }
  };

  return (
    <Screen keyboardAvoiding footer={<Button label="Add client" onPress={submit} disabled={!canWrite} testID="client-add-submit" />}>
      <ScreenTitle title="Add client" />
      <FormBanner error={formError} offline={!canWrite} />
      <ImagePickField label="Company logo" name={values.name} value={logo} onChange={setLogo} required error={errors.logo} />
      <FormSection title="Account">
        <TextField label="Client name" value={values.name} onChangeText={set('name')} required error={errors.name} maxLength={100} />
        <TextField label="Email address" value={values.email} onChangeText={set('email')} required error={errors.email} keyboardType="email-address" autoCapitalize="none" />
        <TextField label="Password" value={values.password} onChangeText={set('password')} secure required error={errors.password} helper="8 to 128 characters. Share it with the client securely." />
      </FormSection>
      <FormSection title="Business">
        <DateField label="Date of onboarding" value={values.dateOfJoining} onChange={(d) => set('dateOfJoining')(d ?? '')} required error={errors.dateOfJoining} />
        <PlanPicker value={values.planType} onChange={set('planType')} />
        <TextField label="Budget (₹)" value={values.budget} onChangeText={set('budget')} required error={errors.budget} keyboardType="decimal-pad" />
      </FormSection>
    </Screen>
  );
}

/** /admin/clients/[id] */
export function ClientDetailScreen() {
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const keys = useQueryKeys();
  const theme = useTheme();
  const { canWrite } = useSession();
  const query = useClient(id);
  const [error, setError] = useState<string | null>(null);
  return (
    <DetailLoader query={query} title="Client">
      {(c) => (
        <Screen onRefresh={() => query.refetch()} refreshing={query.isRefetching}>
          <ScreenTitle title={clientName(c)} />
          <FormBanner error={error} offline={!canWrite} />
          <Card>
            <View style={[styles.head, { gap: theme.spacing.md }]}>
              <Avatar uri={c.companyLogo} name={clientName(c)} id={c._id} size={72} />
              <View style={styles.flex}>
                <AppText variant="title">{clientName(c)}</AppText>
                <AppText variant="secondary">{c.planType} plan</AppText>
              </View>
            </View>
            <DetailRow label="Contact email" value={c.userId?.email} />
            <DetailRow label="Plan type" value={c.planType} />
            <DetailRow label="Budget" value={formatCurrency(c.budget)} />
            <DetailRow label="Partner since" value={c.dateOfJoining ? formatDate(isoToYmd(c.dateOfJoining)) : null} />
            <DetailRow label="Client ID" value={c._id} />
            <DetailRow label="Created" value={c.createdAt ? formatDateTime(c.createdAt) : null} />
            <DetailRow label="Last updated" value={c.updatedAt ? formatDateTime(c.updatedAt) : null} />
          </Card>
          <Button label="Edit plan, budget or logo" icon="create-outline" onPress={() => router.push(`/admin/clients/${c._id}/edit`)} disabled={!canWrite} />
          <Button label="Gallery and standings" icon="images-outline" variant="secondary" onPress={() => router.push(`/admin/clients/${c._id}/content`)} />
          <DeleteEntityButton
            noun="client"
            name={clientName(c)}
            path={`/api/client/${enc(c._id)}`}
            consequence="Their sign-in account, roster, gallery and standings are deleted too."
            invalidate={[keys.clients()]}
            detailKey={keys.client(c._id)}
            onError={setError}
          />
        </Screen>
      )}
    </DetailLoader>
  );
}

/** /admin/clients/[id]/edit — the backend accepts budget, planType and the logo. */
export function ClientEditScreen() {
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const query = useClient(id);
  return <DetailLoader query={query} title="Edit client">{(c) => <ClientEditor key={c._id} client={c} />}</DetailLoader>;
}

function ClientEditor({ client: c }: { client: Client }) {
  const keys = useQueryKeys();
  const { canWrite } = useSession();
  const { values, errors, setErrors, set } = useEntityForm<'planType' | 'budget'>({ planType: c.planType, budget: numberText(c.budget) });
  const [logo, setLogo] = useState<PickedFile | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const save = useApiMutation(
    () => api.put(`/api/client/${enc(c._id)}`, toFormData({ planType: values.planType, budget: values.budget.trim() }, { companyLogo: toUpload(logo) })),
    { invalidate: [keys.clients(), keys.client(c._id)] },
  );
  const submit = async () => {
    setFormError(null);
    const b = validateNumber(values.budget, { label: 'Budget', required: true, max: 1e12 });
    setErrors(b ? { budget: b } : {});
    if (b) return;
    try {
      await save.mutateAsync(undefined);
      toast.success('Client saved.');
      router.back();
    } catch (e) {
      if (!isSilentError(e)) setFormError(writeErrorMessage(e));
    }
  };
  return (
    <Screen keyboardAvoiding footer={<Button label="Save changes" onPress={submit} disabled={!canWrite} testID="client-edit-submit" />}>
      <ScreenTitle title={`Edit ${clientName(c)}`} />
      <FormBanner error={formError} offline={!canWrite} />
      <DetailRow label="Client name" value={clientName(c)} />
      <AppText variant="caption">The name and email cannot be changed here.</AppText>
      <ImagePickField label="Company logo" name={clientName(c)} currentUri={c.companyLogo} value={logo} onChange={setLogo} />
      <PlanPicker value={values.planType} onChange={set('planType')} />
      <TextField label="Budget (₹)" value={values.budget} onChangeText={set('budget')} required error={errors.budget} keyboardType="decimal-pad" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1, gap: 4 },
});
