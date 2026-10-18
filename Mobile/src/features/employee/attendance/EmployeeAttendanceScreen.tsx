import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import {
  AppText,
  Badge,
  Button,
  Card,
  confirm,
  EmptyState,
  ErrorState,
  IconButton,
  LoadingState,
  SegmentedControl,
  Screen,
  StatusPill,
  toast,
} from '@/components';
import { api, getErrorMessage, isApiError } from '@/services/api';
import { useApiMutation, useApiQuery } from '@/services/hooks';
import { useQueryKeys } from '@/services/queryKeys';
import { useSession } from '@/services/session';
import { useTheme } from '@/theme';
import type { AttendanceRequest, TodayAttendanceResponse } from '@/types/api';
import { addMonths, formatDate, formatDateLong, formatDateTime, formatMonth, formatTime, monthKey } from '@/utils/format';

import { formatHours } from '../format';
import type { AttendanceRequestsResponse, MonthlyAttendanceResponse, MonthlyDay } from '../types';
import { TodayAttendanceCard } from './TodayAttendanceCard';

type Tab = 'history' | 'requests';
type Row = { kind: 'day'; day: MonthlyDay } | { kind: 'request'; request: AttendanceRequest };

export function EmployeeAttendanceScreen() {
  const theme = useTheme();
  const router = useRouter();
  const keys = useQueryKeys();
  const queryClient = useQueryClient();
  const { canWrite } = useSession();
  const [tab, setTab] = useState<Tab>('history');
  const today = queryClient.getQueryData<TodayAttendanceResponse>(keys.attendanceToday());
  const currentMonth = today?.businessDate?.slice(0, 7) ?? monthKey();
  const [month, setMonth] = useState<string | null>(null);
  const shownMonth = month ?? currentMonth;

  const monthly = useApiQuery<MonthlyAttendanceResponse>(keys.attendanceMonth(shownMonth), '/api/attendance/me/monthly', {
    query: { month: shownMonth },
  });
  const requests = useApiQuery<AttendanceRequestsResponse>(keys.attendanceRequests(), '/api/attendance-request/me');
  const cancel = useApiMutation((id: string) => api.delete(`/api/attendance-request/${id}`), { invalidate: [keys.attendanceRequests()] });

  const pendingDates = new Set((requests.data?.requests ?? []).filter((r) => r.status === 'Pending').map((r) => r.date));
  const active = tab === 'history' ? monthly : requests;
  const rows: Row[] =
    tab === 'history'
      ? [...(monthly.data?.attendance ?? [])].reverse().map((day) => ({ kind: 'day' as const, day }))
      : (requests.data?.requests ?? []).map((request) => ({ kind: 'request' as const, request }));

  const onCancel = async (r: AttendanceRequest) => {
    const ok = await confirm({
      title: 'Cancel this request?',
      message: `Your correction request for ${formatDate(r.date)} will be withdrawn.`,
      confirmLabel: 'Cancel request',
      cancelLabel: 'Keep',
      destructive: true,
    });
    if (!ok) return;
    try {
      await cancel.mutateAsync(r._id);
      toast.success('Request cancelled.');
    } catch (e) {
      if (isApiError(e) && e.kind === 'cancelled') return;
      toast.error(getErrorMessage(e));
      void requests.refetch();
    }
  };

  const renderItem = ({ item }: { item: Row }) => {
    if (item.kind === 'day') {
      const d = item.day;
      const status = d.status || (d.checkIn && !d.checkOut ? 'In progress' : '—');
      const label = d.status === 'Holiday' && d.holidayName ? `Holiday · ${d.holidayName}` : status;
      const corrected = d.source === 'correction' || !!d.correctionRequestId;
      return (
        <Card style={{ marginHorizontal: theme.spacing.lg }}>
          <View style={styles.row}>
            <AppText variant="bodyStrong" style={styles.flex}>
              {formatDateLong(d.date)}
            </AppText>
            <StatusPill status={d.status === 'Holiday' ? 'Leave' : status} label={label} accessibilityPrefix="Status" />
          </View>
          {d.checkIn ? (
            <AppText variant="secondary">
              In {formatTime(d.checkIn)} · Out {formatTime(d.checkOut)} · Worked {formatHours(d.workedHours)}
            </AppText>
          ) : d.workedHours ? (
            <AppText variant="secondary">Worked {formatHours(d.workedHours)}</AppText>
          ) : null}
          <View style={styles.tags}>
            {corrected ? <Badge label="Corrected" tone="info" /> : null}
            {pendingDates.has(d.date) ? <Badge label="Correction pending" tone="warning" /> : null}
          </View>
        </Card>
      );
    }
    const r = item.request;
    return (
      <Card style={{ marginHorizontal: theme.spacing.lg }}>
        <View style={styles.row}>
          <AppText variant="bodyStrong" style={styles.flex}>
            {formatDateLong(r.date)}
          </AppText>
          <StatusPill status={r.status} accessibilityPrefix="Request" />
        </View>
        <AppText variant="secondary">
          {r.currentStatus} → {r.requestedStatus}
        </AppText>
        <AppText variant="body">{r.reason}</AppText>
        {r.reviewRemarks ? <AppText variant="secondary">Remarks: {r.reviewRemarks}</AppText> : null}
        {r.reviewedAt ? <AppText variant="caption">Reviewed {formatDateTime(r.reviewedAt)}</AppText> : null}
        {r.status === 'Pending' ? (
          <Button label="Cancel request" variant="secondary" disabled={!canWrite} onPress={() => onCancel(r)} />
        ) : null}
      </Card>
    );
  };

  const header = (
    <View style={{ gap: theme.spacing.md, padding: theme.spacing.lg, paddingBottom: 0 }}>
      <TodayAttendanceCard />
      <Button
        label="Request a correction"
        variant="secondary"
        icon="create-outline"
        disabled={!canWrite}
        onPress={() => router.push('/employee/attendance-request')}
      />
      <SegmentedControl
        accessibilityLabel="Attendance view"
        value={tab}
        onChange={setTab}
        options={[
          { label: 'History', value: 'history' },
          { label: 'My requests', value: 'requests' },
        ]}
      />
      {tab === 'history' ? (
        <View style={styles.row}>
          <IconButton icon="chevron-back" accessibilityLabel="Previous month" onPress={() => setMonth(addMonths(shownMonth, -1))} />
          <AppText variant="subheading" align="center" style={styles.flex}>
            {formatMonth(shownMonth)}
          </AppText>
          <IconButton
            icon="chevron-forward"
            accessibilityLabel="Next month"
            disabled={shownMonth >= currentMonth}
            onPress={() => setMonth(addMonths(shownMonth, 1))}
          />
        </View>
      ) : null}
    </View>
  );

  const empty = active.isPending ? (
    <LoadingState />
  ) : active.isError && !active.data ? (
    <ErrorState error={active.error} onRetry={() => active.refetch()} />
  ) : tab === 'history' ? (
    <EmptyState title="No attendance for this month" message="Days appear here from your joining date up to today." />
  ) : (
    <EmptyState title="No correction requests" message="If a day's status is wrong, request a correction and HR will review it." />
  );

  return (
    <Screen scroll={false} padded={false}>
      <FlatList
        data={rows}
        keyExtractor={(r) => (r.kind === 'day' ? `d-${r.day.date}` : `r-${r.request._id}`)}
        renderItem={renderItem}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        contentContainerStyle={{ gap: theme.spacing.md, paddingBottom: theme.spacing.xl }}
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={() => {
              void queryClient.invalidateQueries({ queryKey: keys.attendanceToday() });
              void active.refetch();
            }}
            colors={[theme.colors.primary]}
            tintColor={theme.colors.primary}
          />
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  flex: { flex: 1 },
  tags: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
});
