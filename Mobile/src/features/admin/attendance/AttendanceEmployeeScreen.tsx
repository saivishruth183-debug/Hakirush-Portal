import { Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';

import {
  AppText,
  Avatar,
  Button,
  Card,
  confirm,
  DateField,
  DetailRow,
  EmptyState,
  IconButton,
  LoadingState,
  ErrorState,
  Screen,
  SectionHeader,
  SegmentedControl,
  StatusPill,
  toast,
  type SegmentOption,
} from '@/components';
import { updateAttendanceStatus } from '@/features/admin/ops/api';
import { InlineNotice } from '@/features/admin/ops/components';
import { departmentName, displayAttendanceStatus, employeeCode, employeeName, formatHours, sourceLabel } from '@/features/admin/ops/format';
import { useAdminOpsKeys } from '@/features/admin/ops/keys';
import type {
  AttendanceAudit,
  ManualStatus,
  MonthlyAttendanceDay,
  MonthlyAttendanceResponse,
  TodayAttendanceResponse,
  TodayAttendanceRow,
} from '@/features/admin/ops/types';
import { getErrorMessage, isApiError } from '@/services/api';
import { useApiMutation, useApiQuery } from '@/services/hooks';
import { useQueryKeys } from '@/services/queryKeys';
import { useSession } from '@/services/session';
import { useTheme } from '@/theme';
import { addMonths, businessDate, formatDateLong, formatDateTime, formatMonth, formatTime, monthKey } from '@/utils/format';

const STATUS_OPTIONS: readonly SegmentOption<ManualStatus>[] = [
  { label: 'Present', value: 'Present' },
  { label: 'Half Day', value: 'Half Day' },
  { label: 'Absent', value: 'Absent' },
  { label: 'Leave', value: 'Leave' },
];

const NOMINAL: Record<ManualStatus, string> = {
  Present: 'Worked hours are set to 8h.',
  'Half Day': 'Worked hours are set to 4h.',
  Absent: 'Worked hours are set to 0 and the day’s check-in/check-out are cleared.',
  Leave: 'Worked hours are set to 0 and the day’s check-in/check-out are cleared.',
};

/** Builds the confirmation text for a manual status change (exported for tests). */
export function manualStatusMessage(name: string, status: ManualStatus, date: string): string {
  return `Mark ${name} as ${status} on ${formatDateLong(date)}? ${NOMINAL[status]} This is recorded as an admin change.`;
}

/** /admin/attendance/[employeeId] — one employee: today, manual status update, monthly history. */
export function AttendanceEmployeeScreen() {
  const params = useLocalSearchParams<{ employeeId: string }>();
  const employeeId = String(params.employeeId ?? '');
  const theme = useTheme();
  const { canWrite } = useSession();
  const keys = useQueryKeys();
  const opsKeys = useAdminOpsKeys();
  const listRef = useRef<FlatList<MonthlyAttendanceDay>>(null);
  const today = useMemo(() => businessDate(), []);
  const [month, setMonth] = useState(() => monthKey());
  const [status, setStatus] = useState<ManualStatus>('Present');
  const [date, setDate] = useState<string | null>(today);
  const [lastUpdate, setLastUpdate] = useState<(TodayAttendanceRow & AttendanceAudit) | null>(null);

  const todayQuery = useApiQuery<TodayAttendanceResponse>(opsKeys.attendanceToday(), '/api/attendance');
  const todayRow = todayQuery.data?.attendance.find((r) => r.employeeId?._id === employeeId);
  const monthly = useApiQuery<MonthlyAttendanceResponse>(
    opsKeys.attendanceMonthly(employeeId, month),
    `/api/attendance/user/${encodeURIComponent(employeeId)}/monthly`,
    { query: { month }, enabled: !!employeeId },
  );

  const employee = todayRow?.employeeId;
  const name = employee ? employeeName(employee) : 'Employee';

  const update = useApiMutation(
    (vars: { status: ManualStatus; date: string }) => updateAttendanceStatus(employeeId, vars.status, vars.date),
    {
      invalidate: [opsKeys.attendanceAll(), keys.dashboard()],
      onSuccess: (res) => setLastUpdate(res.attendance),
    },
  );

  const submit = async () => {
    if (!date) {
      toast.error('Choose a date.');
      return;
    }
    if (date > today) {
      toast.error('The date cannot be in the future.');
      return;
    }
    const ok = await confirm({ title: 'Update attendance?', message: manualStatusMessage(name, status, date), confirmLabel: `Mark ${status}` });
    if (!ok) return;
    try {
      await update.mutateAsync({ status, date });
      toast.success(`${name} marked ${status} for ${formatDateLong(date)}.`);
    } catch (e) {
      if (isApiError(e) && e.kind === 'cancelled') return;
      toast.error(getErrorMessage(e));
    }
  };

  const days = useMemo(() => [...(monthly.data?.attendance ?? [])].reverse(), [monthly.data]);
  const summary = useMemo(() => {
    const c: Record<string, number> = {};
    for (const d of monthly.data?.attendance ?? []) {
      const label = displayAttendanceStatus(d).label;
      c[label] = (c[label] ?? 0) + 1;
    }
    return Object.entries(c)
      .map(([k, v]) => `${k} ${v}`)
      .join(' · ');
  }, [monthly.data]);

  const audit = lastUpdate ?? todayRow ?? null;
  const currentMonth = monthKey();

  const header = (
    <View style={{ gap: theme.spacing.md }}>
      {todayQuery.isError && !todayQuery.data ? (
        <ErrorState error={todayQuery.error} title="Couldn't load today's attendance" onRetry={() => todayQuery.refetch()} />
      ) : todayQuery.isPending ? (
        <LoadingState label="Loading employee" />
      ) : (
        <Card>
          <View style={{ flexDirection: 'row', gap: theme.spacing.lg, alignItems: 'center' }}>
            <Avatar uri={employee?.userId?.profileImage} name={name} id={employeeId} size={56} />
            <View style={{ flex: 1, gap: 2 }}>
              <AppText variant="title">{name}</AppText>
              {employee ? (
                <AppText variant="secondary">
                  {employeeCode(employee)} · {departmentName(employee)}
                </AppText>
              ) : (
                <AppText variant="secondary">Not in today’s list of active employees.</AppText>
              )}
            </View>
          </View>
          {todayRow ? (
            <>
              <StatusPill label={displayAttendanceStatus(todayRow).label} tone={displayAttendanceStatus(todayRow).tone} accessibilityPrefix="Today" />
              <DetailRow label="Check-in today" value={formatTime(todayRow.checkIn, '')} placeholder="Not checked in" />
              <DetailRow label="Check-out today" value={formatTime(todayRow.checkOut, '')} placeholder="Not checked out" />
              <DetailRow label="Worked (recorded)" value={formatHours(todayRow.workedHours)} />
              {todayRow.isPaused ? <DetailRow label="On break since" value={formatTime(todayRow.pauseStartedAt)} /> : null}
            </>
          ) : null}
        </Card>
      )}

      <SectionHeader title="Set status manually" subtitle="Admin override for one day (today or earlier)." />
      <Card>
        <SegmentedControl options={STATUS_OPTIONS} value={status} onChange={setStatus} accessibilityLabel="New attendance status" />
        <DateField label="Date" value={date} onChange={setDate} maximumDate={today} required testID="manual-date" />
        <AppText variant="secondary">{NOMINAL[status]}</AppText>
        {!canWrite ? <InlineNotice tone="warning" message="You are offline. Status changes are available when you reconnect." /> : null}
        <Button label={`Mark ${status}`} onPress={submit} disabled={!canWrite || !employeeId} testID="manual-submit" />
      </Card>

      {audit && (audit.source || audit.adminUpdatedAt || audit.correctedAt) ? (
        <Card>
          <AppText variant="subheading">{lastUpdate ? 'Saved change' : 'Last change today'}</AppText>
          {lastUpdate ? <DetailRow label="Date" value={formatDateLong(lastUpdate.date)} /> : null}
          {lastUpdate ? <DetailRow label="Status" value={displayAttendanceStatus(lastUpdate).label} /> : null}
          <DetailRow label="Source" value={sourceLabel(audit.source) ?? ''} />
          {audit.adminUpdatedAt ? <DetailRow label="Changed by admin at" value={formatDateTime(audit.adminUpdatedAt)} /> : null}
          {audit.correctedAt ? <DetailRow label="Corrected at" value={formatDateTime(audit.correctedAt)} /> : null}
          {audit.punchedHours !== null && audit.punchedHours !== undefined ? (
            <DetailRow label="Measured from punches" value={formatHours(audit.punchedHours)} />
          ) : null}
          <DetailRow label="Worked hours recorded" value={formatHours(audit.workedHours)} />
        </Card>
      ) : null}

      <SectionHeader title="Monthly attendance" subtitle={summary || undefined} />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <IconButton icon="chevron-back" accessibilityLabel="Previous month" onPress={() => setMonth((m) => addMonths(m, -1))} />
        <AppText variant="bodyStrong" accessibilityRole="header">
          {formatMonth(month)}
        </AppText>
        <IconButton
          icon="chevron-forward"
          accessibilityLabel="Next month"
          onPress={() => setMonth((m) => addMonths(m, 1))}
          disabled={month >= currentMonth}
        />
      </View>
      {monthly.isError && !monthly.data ? <ErrorState error={monthly.error} onRetry={() => monthly.refetch()} /> : null}
      {monthly.isPending && monthly.fetchStatus !== 'idle' ? <LoadingState label="Loading month" /> : null}
    </View>
  );

  return (
    <Screen scroll={false} padded={false}>
      <Stack.Screen options={{ title: employee ? name : 'Attendance' }} />
      <FlatList
        ref={listRef}
        data={days}
        keyExtractor={(d) => d.date}
        contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.sm }}
        ListHeaderComponent={header}
        ListEmptyComponent={
          monthly.data ? <EmptyState title="No days to show" message="No attendance days for this month (before joining or in the future)." icon="calendar-outline" /> : null
        }
        renderItem={({ item }) => (
          <MonthDayRow
            day={item}
            onSelect={() => {
              setDate(item.date);
              listRef.current?.scrollToOffset({ offset: 0, animated: true });
              toast.info(`Selected ${formatDateLong(item.date)} in the status form.`);
            }}
          />
        )}
      />
    </Screen>
  );
}

function MonthDayRow({ day, onSelect }: { day: MonthlyAttendanceDay; onSelect: () => void }) {
  const theme = useTheme();
  const display = displayAttendanceStatus(day);
  const off = day.dayType === 'holiday' ? day.holidayName || 'Holiday' : day.dayType === 'weekend' ? 'Weekend' : null;
  const source = sourceLabel(day.source);
  const label = `${formatDateLong(day.date)}, ${display.label}${off ? `, ${off}` : ''}, in ${formatTime(day.checkIn, 'none')}, out ${formatTime(day.checkOut, 'none')}, worked ${formatHours(day.workedHours)}${source ? `, ${source}` : ''}`;
  return (
    <Pressable
      onPress={onSelect}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint="Selects this day in the status form"
      style={({ pressed }) => ({
        minHeight: theme.touchTarget,
        padding: theme.spacing.md,
        borderRadius: theme.radii.md,
        borderWidth: 1,
        borderColor: theme.colors.border,
        backgroundColor: pressed ? theme.colors.surfaceAlt : theme.colors.surface,
        gap: 4,
      })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
        <AppText variant="bodyStrong" style={{ flex: 1 }}>
          {formatDateLong(day.date)}
        </AppText>
        <StatusPill label={display.label} tone={display.tone} />
      </View>
      <AppText variant="secondary">
        In {formatTime(day.checkIn)} · Out {formatTime(day.checkOut)} · {formatHours(day.workedHours)}
      </AppText>
      {off || source ? <AppText variant="caption">{[off, source].filter(Boolean).join(' · ')}</AppText> : null}
    </Pressable>
  );
}
