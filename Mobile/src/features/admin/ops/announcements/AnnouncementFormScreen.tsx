import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { AppText, Button, confirm, DateField, FormSection, QueryStateView, Screen, SelectField, TextField, toast } from '@/components';
import { createAnnouncement, deleteAnnouncement, updateAnnouncement, type AnnouncementInput } from '@/features/admin/ops/api';
import { useAdminOpsKeys } from '@/features/admin/ops/keys';
import type { AdminAnnouncement, AnnouncementResponse } from '@/features/admin/ops/types';
import { openAppSettings, pickImage, type PickedFile } from '@/features/shared/media/pickers';
import { api, getErrorMessage, isApiError } from '@/services/api';
import { useApiMutation } from '@/services/hooks';
import { useSession } from '@/services/session';
import { useTheme } from '@/theme';

const TYPES = [
  { label: 'Annual', value: 'Annual' },
  { label: 'Quarterly', value: 'Quarterly' },
  { label: 'Celebration', value: 'Celebration' },
] as const;
const STATUSES = [
  { label: 'Upcoming', value: 'Upcoming' },
  { label: 'Ongoing', value: 'Ongoing' },
  { label: 'Completed', value: 'Completed', description: 'Hidden from employees and clients' },
] as const;

type Errors = Partial<Record<'title' | 'description' | 'date' | 'venue', string>>;

export function validateAnnouncement(v: { title: string; description: string; date: string | null; venue: string }): Errors {
  const e: Errors = {};
  if (!v.title.trim()) e.title = 'Enter a title.';
  else if (v.title.trim().length > 200) e.title = 'Use at most 200 characters.';
  if (!v.description.trim()) e.description = 'Enter a description.';
  else if (v.description.trim().length > 5000) e.description = 'Use at most 5000 characters.';
  if (!v.date) e.date = 'Choose the date.';
  if (!v.venue.trim()) e.venue = 'Enter the venue.';
  else if (v.venue.trim().length > 300) e.venue = 'Use at most 300 characters.';
  return e;
}

/** /admin/announcements/new and /admin/announcements/[id]/edit */
export function AnnouncementFormScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const id = params.id ? String(params.id) : null;
  const keys = useAdminOpsKeys();
  const query = useQuery({
    queryKey: keys.announcement(id ?? 'new'),
    queryFn: ({ signal }) => api.get<AnnouncementResponse>(`/api/announcements/${encodeURIComponent(id ?? '')}`, { signal }),
    enabled: !!id,
  });
  if (!id) return <AnnouncementForm initial={null} />;
  return (
    <Screen keyboardAvoiding>
      <Stack.Screen options={{ title: 'Edit announcement' }} />
      <QueryStateView query={query} errorTitle="Couldn't load this announcement">
        {(d) => <AnnouncementForm initial={d.announcement} />}
      </QueryStateView>
    </Screen>
  );
}

function AnnouncementForm({ initial }: { initial: AdminAnnouncement | null }) {
  const theme = useTheme();
  const router = useRouter();
  const { canWrite } = useSession();
  const keys = useAdminOpsKeys();
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [type, setType] = useState<AnnouncementInput['type']>(initial?.type ?? 'Annual');
  const [status, setStatus] = useState<AnnouncementInput['status']>(initial?.status ?? 'Upcoming');
  const [date, setDate] = useState<string | null>(/^\d{4}-\d{2}-\d{2}/.exec(initial?.date ?? '')?.[0] ?? null);
  const [venue, setVenue] = useState(initial?.venue ?? '');
  const [image, setImage] = useState<PickedFile | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);

  const save = useApiMutation(
    (vars: { input: AnnouncementInput; image: PickedFile | null }) =>
      initial ? updateAnnouncement(initial._id, vars.input, vars.image) : createAnnouncement(vars.input, vars.image),
    { invalidate: [keys.announcementsAll()] },
  );
  const remove = useApiMutation((annId: string) => deleteAnnouncement(annId), { invalidate: [keys.announcementsAll()] });

  const choose = async () => {
    const r = await pickImage({ allowsEditing: false });
    if (r.status === 'picked') setImage(r.file);
    else if (r.status === 'denied') toast.show({ message: r.message, tone: 'error', actionLabel: 'Settings', onAction: () => void openAppSettings() });
    else if (r.status === 'error') toast.error(r.message);
  };

  const submit = async () => {
    setFormError(null);
    const v = validateAnnouncement({ title, description, date, venue });
    setErrors(v);
    if (Object.keys(v).length || !date) return;
    try {
      await save.mutateAsync({ input: { title: title.trim(), description: description.trim(), type, status, date, venue: venue.trim() }, image });
      toast.success(initial ? 'Announcement updated.' : 'Announcement published.');
      router.back();
    } catch (e) {
      if (isApiError(e) && e.kind === 'cancelled') return;
      setFormError(getErrorMessage(e));
    }
  };

  const onDelete = async () => {
    if (!initial) return;
    const ok = await confirm({ title: 'Delete announcement?', message: `“${initial.title}” will be removed for everyone.`, confirmLabel: 'Delete', destructive: true });
    if (!ok) return;
    try {
      await remove.mutateAsync(initial._id);
      toast.success('Announcement deleted.');
      router.back();
    } catch (e) {
      if (!(isApiError(e) && e.kind === 'cancelled')) toast.error(getErrorMessage(e));
    }
  };

  const previewUri = image?.uri ?? initial?.image ?? null;

  const fields = (
    <FormSection>
      {!canWrite ? (
        <AppText variant="secondary" color="warning">
          You are offline. Connect to the internet to save.
        </AppText>
      ) : null}
      {formError ? (
        <AppText variant="body" color="danger" accessibilityRole="alert">
          {formError}
        </AppText>
      ) : null}
      <TextField label="Title" value={title} onChangeText={setTitle} maxLength={200} error={errors.title} required />
      <TextField label="Description" value={description} onChangeText={setDescription} multiline maxLength={5000} error={errors.description} required />
      <SelectField label="Type" value={type} options={TYPES} onChange={setType} required />
      <DateField label="Date" value={date} onChange={setDate} error={errors.date} required />
      <TextField label="Venue" value={venue} onChangeText={setVenue} maxLength={300} error={errors.venue} required />
      <SelectField label="Status" value={status} options={STATUSES} onChange={setStatus} required helper="Completed announcements are hidden from employees and clients." />
      <View style={{ gap: theme.spacing.sm }}>
        <AppText variant="label">Image (optional)</AppText>
        {previewUri ? (
          <Image
            source={{ uri: previewUri }}
            style={{ width: '100%', aspectRatio: 16 / 9, borderRadius: theme.radii.md, backgroundColor: theme.colors.surfaceAlt }}
            contentFit="cover"
            accessibilityLabel={image ? 'Selected image' : 'Current image'}
          />
        ) : null}
        <Button label={previewUri ? 'Choose a different image' : 'Choose image'} icon="image-outline" variant="secondary" onPress={choose} disabled={!canWrite} />
        {image ? <Button label="Keep the current image" variant="ghost" onPress={() => setImage(null)} /> : null}
        <AppText variant="caption">JPEG, PNG, WebP or GIF up to 5 MB. Photos are converted to JPEG automatically. An image can be replaced but not removed.</AppText>
      </View>
      {initial ? <Button label="Delete announcement" icon="trash-outline" variant="destructive" onPress={onDelete} disabled={!canWrite} /> : null}
    </FormSection>
  );

  const submitButton = <Button label={initial ? 'Save changes' : 'Publish announcement'} onPress={submit} disabled={!canWrite} testID="announcement-submit" />;

  if (initial) {
    return (
      <View style={{ gap: theme.spacing.md }}>
        {fields}
        {submitButton}
      </View>
    );
  }
  return (
    <Screen keyboardAvoiding footer={submitButton}>
      <Stack.Screen options={{ title: 'New announcement' }} />
      {fields}
    </Screen>
  );
}
