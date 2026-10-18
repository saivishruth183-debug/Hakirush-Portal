import { useQueryClient } from '@tanstack/react-query';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, Avatar, Button, Card, DateField, DetailRow, FormSection, QueryStateView, Screen, SelectField, TextField, toast } from '@/components';
import { openAppSettings, pickImage, type PickedFile } from '@/features/shared/media/pickers';
import { api, getErrorMessage, isApiError, toFormData } from '@/services/api';
import { useApiMutation } from '@/services/hooks';
import { useQueryKeys } from '@/services/queryKeys';
import { useSession } from '@/services/session';
import type { OwnEmployeeResponse } from '@/types/api';
import { businessDate, formatCurrency } from '@/utils/format';

import { mediaUrl, ymdOf } from '../format';
import { useMyEmployee } from './MyProfileScreen';

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const MARITAL = ['Single', 'Married', 'Divorced', 'Widowed'];
type Fields = { name: string; experience: string; dob: string; bloodGroup: string; maritalStatus: string; aadharcard: string; pancard: string; pfNumber: string };

export function EditProfileScreen() {
  const q = useMyEmployee();
  if (q.data) return <EditForm data={q.data} />;
  return (
    <Screen>
      <Stack.Screen options={{ title: 'Edit profile' }} />
      <QueryStateView query={q} errorTitle="Couldn't load your profile">
        {() => null}
      </QueryStateView>
    </Screen>
  );
}

function EditForm({ data }: { data: OwnEmployeeResponse }) {
  const e = data.employee;
  const router = useRouter();
  const keys = useQueryKeys();
  const queryClient = useQueryClient();
  const { canWrite, refreshUser } = useSession();
  const initial: Fields = {
    name: e.userId?.name ?? '',
    experience: e.experience ?? '',
    dob: e.dob ? ymdOf(e.dob) : '',
    bloodGroup: e.bloodGroup ?? '',
    maritalStatus: e.maritalStatus ?? '',
    aadharcard: e.aadharcard ?? '',
    pancard: e.pancard ?? '',
    pfNumber: e.pfNumber ?? '',
  };
  const [v, setV] = useState<Fields>(initial);
  const [photo, setPhoto] = useState<PickedFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<Fields>) => setV((cur) => ({ ...cur, ...patch }));

  const mutation = useApiMutation((form: FormData) => api.put(`/api/employee/update-profile/${e._id}`, form), {
    invalidate: [keys.myEmployee(), keys.directory()],
  });

  const choosePhoto = async () => {
    const r = await pickImage({ aspect: [1, 1], allowsEditing: true });
    if (r.status === 'picked') setPhoto(r.file);
    else if (r.status === 'denied') toast.show({ message: r.message, tone: 'error', actionLabel: 'Settings', onAction: () => void openAppSettings() });
    else if (r.status === 'error') toast.error(r.message);
  };

  const save = async () => {
    setError(null);
    if (!v.name.trim()) {
      setError('Enter your name.');
      return;
    }
    const changed = (Object.keys(v) as (keyof Fields)[]).filter((k) => v[k].trim() !== initial[k].trim());
    if (!changed.length && !photo) {
      toast.info('No changes to save.');
      return;
    }
    const fields = Object.fromEntries(changed.map((k) => [k, v[k].trim()]));
    try {
      await mutation.mutateAsync(toFormData(fields, { profileImage: photo }));
      await refreshUser().catch(() => undefined);
      await queryClient.invalidateQueries({ queryKey: keys.myEmployee() });
      toast.success('Profile updated.');
      router.back();
    } catch (err) {
      if (isApiError(err) && err.kind === 'cancelled') return;
      if (isApiError(err) && err.code === 'FIELD_NOT_EDITABLE') {
        setError(`${err.message} Contact HR to change salary, department or designation.`);
      } else if (isApiError(err) && (err.status ?? 0) >= 500) {
        setError('Your changes could not be saved (the server or photo storage had a problem). Please try again.');
      } else {
        setError(getErrorMessage(err));
      }
    }
  };

  return (
    <Screen keyboardAvoiding footer={<Button label="Save changes" onPress={save} loading={mutation.isPending} disabled={!canWrite} testID="profile-save" />}>
      <Stack.Screen options={{ title: 'Edit profile' }} />
      {!canWrite ? <AppText variant="secondary" color="warning">You are offline. Connect to save changes.</AppText> : null}
      {error ? (
        <AppText variant="body" color="danger" accessibilityRole="alert">
          {error}
        </AppText>
      ) : null}
      <Card>
        <View style={styles.row}>
          <Avatar uri={photo?.uri ?? mediaUrl(e.userId?.profileImage)} name={v.name || 'You'} id={e._id} size={72} />
          <View style={styles.flex}>
            <Button label={photo ? 'Choose another photo' : 'Change photo'} variant="secondary" icon="image-outline" onPress={choosePhoto} />
            {photo ? <Button label="Keep current photo" variant="ghost" onPress={() => setPhoto(null)} /> : null}
          </View>
        </View>
      </Card>
      <FormSection title="Personal">
        <TextField label="Full name" value={v.name} onChangeText={(name) => set({ name })} maxLength={100} required />
        <TextField label="Experience (years)" value={v.experience} onChangeText={(experience) => set({ experience })} maxLength={50} keyboardType="numbers-and-punctuation" />
        <DateField label="Date of birth" value={v.dob || null} onChange={(dob) => set({ dob: dob ?? '' })} maximumDate={businessDate()} clearable />
        <SelectField label="Blood group" value={v.bloodGroup || null} options={BLOOD_GROUPS.map((b) => ({ label: b, value: b }))} onChange={(bloodGroup) => set({ bloodGroup })} />
        <SelectField label="Marital status" value={v.maritalStatus || null} options={MARITAL.map((m) => ({ label: m, value: m }))} onChange={(maritalStatus) => set({ maritalStatus })} />
      </FormSection>
      <FormSection title="Identity">
        <TextField label="Aadhaar number" value={v.aadharcard} onChangeText={(aadharcard) => set({ aadharcard })} maxLength={50} autoCapitalize="characters" />
        <TextField label="PAN" value={v.pancard} onChangeText={(pancard) => set({ pancard })} maxLength={50} autoCapitalize="characters" />
        <TextField label="PF number" value={v.pfNumber} onChangeText={(pfNumber) => set({ pfNumber })} maxLength={50} autoCapitalize="characters" />
      </FormSection>
      <FormSection title="Managed by HR" description="Contact HR to change these.">
        <DetailRow label="Department" value={e.department?.dep_name} />
        <DetailRow label="Designation" value={e.designation} />
        <DetailRow label="Annual salary" value={typeof e.salary === 'number' ? formatCurrency(e.salary, { whole: true }) : ''} />
      </FormSection>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  flex: { flex: 1, gap: 4 },
});
