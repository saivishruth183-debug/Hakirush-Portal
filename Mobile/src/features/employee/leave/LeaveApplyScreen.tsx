import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';

import { AppText, Button, Card, DateField, FormSection, Screen, SelectField, TextField } from '@/components';
import { api, getErrorMessage, isApiError } from '@/services/api';
import { useApiMutation } from '@/services/hooks';
import { useQueryKeys } from '@/services/queryKeys';
import { useSession } from '@/services/session';
import { businessDate } from '@/utils/format';

import { formatRange } from '../format';
import type { LeaveAddResponse } from '../types';

/** Same leave types the web EmployeeLeaveAdd.jsx offers. */
export const LEAVE_TYPES = ['Sick Leave', 'Casual Leave'] as const;
const MAX_SPAN_DAYS = 60;

export interface LeaveForm {
  leaveType: string | null;
  startDate: string | null;
  endDate: string | null;
  reason: string;
}

export function validateLeave(v: LeaveForm): Partial<Record<keyof LeaveForm, string>> {
  const e: Partial<Record<keyof LeaveForm, string>> = {};
  if (!v.leaveType) e.leaveType = 'Choose a leave type.';
  if (!v.startDate) e.startDate = 'Choose a start date.';
  if (!v.endDate) e.endDate = 'Choose an end date.';
  if (v.startDate && v.endDate) {
    if (v.endDate < v.startDate) e.endDate = 'The end date must be on or after the start date.';
    else {
      const span = (Date.parse(`${v.endDate}T00:00:00Z`) - Date.parse(`${v.startDate}T00:00:00Z`)) / 86_400_000 + 1;
      if (span > MAX_SPAN_DAYS) e.endDate = `One application can cover at most ${MAX_SPAN_DAYS} days.`;
    }
  }
  if (!v.reason.trim()) e.reason = 'Add a reason for your leave.';
  else if (v.reason.length > 1000) e.reason = 'Keep the reason under 1000 characters.';
  return e;
}

export function LeaveApplyScreen() {
  const router = useRouter();
  const keys = useQueryKeys();
  const { canWrite } = useSession();
  const today = businessDate();
  const [form, setForm] = useState<LeaveForm>({ leaveType: null, startDate: null, endDate: null, reason: '' });
  const [errors, setErrors] = useState<Partial<Record<keyof LeaveForm | 'form', string>>>({});
  const [result, setResult] = useState<LeaveAddResponse | null>(null);
  const set = (patch: Partial<LeaveForm>) => setForm((f) => ({ ...f, ...patch }));

  const mutation = useApiMutation((body: LeaveForm) => api.post<LeaveAddResponse>('/api/leave/add', body), {
    invalidate: [keys.leaves(), keys.leaveBalance()],
  });

  const submit = async () => {
    const v = validateLeave(form);
    setErrors(v);
    if (Object.keys(v).length) return;
    try {
      setResult(await mutation.mutateAsync({ ...form, reason: form.reason.trim() }));
    } catch (e) {
      if (isApiError(e) && e.kind === 'cancelled') return;
      setErrors({ form: getErrorMessage(e) });
    }
  };

  if (result) {
    const { leave, exceedsBalance } = result;
    return (
      <Screen footer={<Button label="Back to my leave" onPress={() => router.back()} />}>
        <Stack.Screen options={{ title: 'Leave requested' }} />
        <Card>
          <AppText variant="title">Request sent</AppText>
          <AppText variant="body">
            {leave.leaveType}: {formatRange(leave.startDate, leave.endDate)}
          </AppText>
          <AppText variant="bodyStrong" testID="leave-result-days">
            {leave.days} working {leave.days === 1 ? 'day' : 'days'} (calculated by the server; weekends and holidays excluded)
          </AppText>
          <AppText variant="secondary">Status: {leave.status}. You will get a notification when it is reviewed.</AppText>
          {exceedsBalance ? (
            <AppText variant="body" color="warning" accessibilityRole="alert">
              This request is more than your remaining {leave.leaveType} balance. HR may reject it or treat extra days differently.
            </AppText>
          ) : null}
        </Card>
      </Screen>
    );
  }

  return (
    <Screen keyboardAvoiding footer={<Button label="Submit request" onPress={submit} loading={mutation.isPending} disabled={!canWrite} testID="leave-submit" />}>
      <Stack.Screen options={{ title: 'Apply for leave' }} />
      <FormSection description="The number of working days is calculated by the server after you submit.">
        {!canWrite ? <AppText variant="secondary" color="warning">You are offline. Connect to apply.</AppText> : null}
        {errors.form ? (
          <AppText variant="body" color="danger" accessibilityRole="alert">
            {errors.form}
          </AppText>
        ) : null}
        <SelectField
          label="Leave type"
          value={form.leaveType}
          options={LEAVE_TYPES.map((t) => ({ label: t, value: t }))}
          onChange={(leaveType) => set({ leaveType })}
          error={errors.leaveType}
          required
        />
        <DateField
          label="Start date"
          value={form.startDate}
          minimumDate={today}
          onChange={(startDate) => set({ startDate })}
          error={errors.startDate}
          required
        />
        <DateField
          label="End date"
          value={form.endDate}
          minimumDate={form.startDate ?? today}
          onChange={(endDate) => set({ endDate })}
          error={errors.endDate}
          required
        />
        <TextField label="Reason" value={form.reason} onChangeText={(reason) => set({ reason })} multiline maxLength={1000} error={errors.reason} required />
      </FormSection>
    </Screen>
  );
}
