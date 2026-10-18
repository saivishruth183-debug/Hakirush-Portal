import { useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';

import { AppText, Button, DateField, FormSection, Screen, SegmentedControl, TextField, toast } from '@/components';
import { api, getErrorMessage, isApiError } from '@/services/api';
import { useApiMutation, useApiQuery } from '@/services/hooks';
import { useQueryKeys } from '@/services/queryKeys';
import { useSession } from '@/services/session';
import type { TodayAttendanceResponse } from '@/types/api';
import { businessDate } from '@/utils/format';

import type { MonthlyAttendanceResponse } from '../types';

type Requested = 'Present' | 'Half Day';

/** POST /api/attendance-request {date ≤ today, requestedStatus, reason ≤ 500}. */
export function CorrectionRequestScreen() {
  const router = useRouter();
  const keys = useQueryKeys();
  const queryClient = useQueryClient();
  const { canWrite } = useSession();
  const params = useLocalSearchParams<{ date?: string }>();
  const today = queryClient.getQueryData<TodayAttendanceResponse>(keys.attendanceToday())?.businessDate ?? businessDate();
  const [date, setDate] = useState<string | null>(typeof params.date === 'string' ? params.date : null);
  const [requested, setRequested] = useState<Requested>('Present');
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<{ date?: string; reason?: string; form?: string }>({});

  const month = date?.slice(0, 7) ?? today.slice(0, 7);
  const monthly = useApiQuery<MonthlyAttendanceResponse>(keys.attendanceMonth(month), '/api/attendance/me/monthly', {
    query: { month },
    enabled: !!date,
  });
  const current = date ? monthly.data?.attendance.find((d) => d.date === date)?.status : undefined;

  const mutation = useApiMutation(
    (body: { date: string; requestedStatus: Requested; reason: string }) => api.post('/api/attendance-request', body),
    { invalidate: [keys.attendanceRequests()] },
  );

  const submit = async () => {
    const next: typeof errors = {};
    if (!date) next.date = 'Choose the date to correct.';
    else if (date > today) next.date = 'You can only correct today or an earlier date.';
    if (!reason.trim()) next.reason = 'Explain why the status should change.';
    else if (reason.trim().length > 500) next.reason = 'Keep the reason under 500 characters.';
    setErrors(next);
    if (Object.keys(next).length || !date) return;
    try {
      await mutation.mutateAsync({ date, requestedStatus: requested, reason: reason.trim() });
      toast.success('Correction request sent to HR.');
      router.back();
    } catch (e) {
      if (isApiError(e) && e.kind === 'cancelled') return;
      setErrors({
        form: isApiError(e) && e.status === 409 ? 'A request for this date is already pending.' : getErrorMessage(e),
      });
    }
  };

  return (
    <Screen
      keyboardAvoiding
      footer={<Button label="Send request" onPress={submit} loading={mutation.isPending} disabled={!canWrite} testID="correction-submit" />}
    >
      <Stack.Screen options={{ title: 'Request a correction' }} />
      <FormSection description="Ask HR to correct a day's attendance status. The current status is taken from your attendance record.">
        {!canWrite ? (
          <AppText variant="secondary" color="warning">
            You are offline. Connect to send a request.
          </AppText>
        ) : null}
        {errors.form ? (
          <AppText variant="body" color="danger" accessibilityRole="alert">
            {errors.form}
          </AppText>
        ) : null}
        <DateField label="Date" value={date} onChange={setDate} maximumDate={today} error={errors.date} required helper="Today or an earlier date." />
        {date && current ? <AppText variant="secondary">Current status: {current}</AppText> : null}
        <AppText variant="label">Requested status</AppText>
        <SegmentedControl
          accessibilityLabel="Requested status"
          value={requested}
          onChange={setRequested}
          options={[
            { label: 'Present', value: 'Present' },
            { label: 'Half Day', value: 'Half Day' },
          ]}
        />
        <TextField label="Reason" value={reason} onChangeText={setReason} multiline maxLength={500} error={errors.reason} required />
      </FormSection>
    </Screen>
  );
}
