import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';

import { AppText, Button, DateField, FormSection, Screen, TextField, toast } from '@/components';
import { addHoliday } from '@/features/admin/ops/api';
import { useAdminOpsKeys } from '@/features/admin/ops/keys';
import { getErrorMessage, isApiError } from '@/services/api';
import { useApiMutation } from '@/services/hooks';
import { useSession } from '@/services/session';

export const HOLIDAY_TITLE_MAX = 200;

export interface HolidayErrors {
  title?: string;
  date?: string;
}

/** Client-side validation mirroring POST /api/holiday/add (title 1–200 chars, date YYYY-MM-DD). */
export function validateHoliday(v: { title: string; date: string | null }): HolidayErrors {
  const errors: HolidayErrors = {};
  const title = v.title.trim();
  if (!title) errors.title = 'Enter the holiday name.';
  else if (title.length > HOLIDAY_TITLE_MAX) errors.title = `Use at most ${HOLIDAY_TITLE_MAX} characters.`;
  if (!v.date) errors.date = 'Choose the date.';
  else if (!/^\d{4}-\d{2}-\d{2}$/.test(v.date)) errors.date = 'Choose a valid date.';
  return errors;
}

/** /admin/holidays/new */
export function HolidayFormScreen() {
  const router = useRouter();
  const { canWrite } = useSession();
  const keys = useAdminOpsKeys();
  const [title, setTitle] = useState('');
  const [date, setDate] = useState<string | null>(null);
  const [errors, setErrors] = useState<HolidayErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const create = useApiMutation((body: { title: string; date: string }) => addHoliday(body), {
    invalidate: [keys.holidays(), keys.attendanceAll(), keys.leavesAll()],
  });

  const submit = async () => {
    setFormError(null);
    const v = validateHoliday({ title, date });
    setErrors(v);
    if (Object.keys(v).length || !date) return;
    try {
      await create.mutateAsync({ title: title.trim(), date });
      toast.success('Holiday added.');
      router.back();
    } catch (e) {
      if (isApiError(e) && e.kind === 'cancelled') return;
      setFormError(getErrorMessage(e));
    }
  };

  return (
    <Screen keyboardAvoiding footer={<Button label="Add holiday" onPress={submit} disabled={!canWrite} testID="holiday-submit" />}>
      <Stack.Screen options={{ title: 'Add holiday' }} />
      <FormSection description="Holidays are skipped when counting leave days and are shown as off days in attendance.">
        {!canWrite ? (
          <AppText variant="secondary" color="warning">
            You are offline. Connect to the internet to add a holiday.
          </AppText>
        ) : null}
        {formError ? (
          <AppText variant="body" color="danger" accessibilityRole="alert">
            {formError}
          </AppText>
        ) : null}
        <TextField
          label="Holiday name"
          value={title}
          onChangeText={setTitle}
          maxLength={HOLIDAY_TITLE_MAX}
          error={errors.title}
          required
          autoCapitalize="words"
          returnKeyType="done"
        />
        <DateField label="Date" value={date} onChange={setDate} error={errors.date} required testID="holiday-date" />
      </FormSection>
    </Screen>
  );
}
