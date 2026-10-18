import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';

import { AppText, Avatar, Button, Card, QueryStateView, Screen, SearchBar, StatusPill } from '@/components';
import { FilterChips, InlineNotice, type ChipOption } from '@/features/admin/ops/components';
import {
  compareCodes,
  departmentName,
  displayAttendanceStatus,
  employeeCode,
  employeeName,
  formatHours,
  matchesSearch,
  type AttendanceFilterKey,
} from '@/features/admin/ops/format';
import { useAdminOpsKeys } from '@/features/admin/ops/keys';
import type { TodayAttendanceResponse, TodayAttendanceRow } from '@/features/admin/ops/types';
import { usePendingCounts } from '@/features/admin/requests/hooks';
import { useDebouncedValue, useNow } from '@/hooks';
import { useApiQuery } from '@/services/hooks';
import { useTheme } from '@/theme';
import { computeWorkedMs } from '@/utils/attendanceTimer';
import { formatDateLong, formatTime } from '@/utils/format';

const FILTERS: AttendanceFilterKey[] = ['All', 'Present', 'Working', 'Half Day', 'Absent', 'Leave', 'Holiday', 'Not marked'];

/** Worked time: live for an open session (h:mm, refreshed every 30 s), else the stored hours. */
export function workedLabel(row: Pick<TodayAttendanceRow, 'checkIn' | 'checkOut' | 'isPaused' | 'pauseStartedAt' | 'totalPausedMs' | 'workedHours'>, now: number): string {
  if (row.checkIn && !row.checkOut) return formatHours(computeWorkedMs(row, 0, now) / 3_600_000);
  return formatHours(row.workedHours ?? 0);
}

/** Admin "Attendance" tab: today's attendance for every active employee. */
export function AdminAttendanceScreen() {
  const router = useRouter();
  const theme = useTheme();
  const opsKeys = useAdminOpsKeys();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<AttendanceFilterKey>('All');
  const debounced = useDebouncedValue(search, 200);
  const now = useNow(30_000);
  const query = useApiQuery<TodayAttendanceResponse>(opsKeys.attendanceToday(), '/api/attendance');
  const { corrections } = usePendingCounts();

  const rows = useMemo(
    () =>
      [...(query.data?.attendance ?? [])]
        .map((row) => ({ row, display: displayAttendanceStatus(row) }))
        .sort((a, b) => compareCodes(employeeCode(a.row.employeeId), employeeCode(b.row.employeeId))),
    [query.data],
  );
  const counts = useMemo(() => {
    const c: Record<string, number> = { All: rows.length };
    for (const r of rows) c[r.display.filter] = (c[r.display.filter] ?? 0) + 1;
    return c;
  }, [rows]);
  const visible = useMemo(
    () =>
      rows.filter(
        (r) =>
          (filter === 'All' || r.display.filter === filter) &&
          matchesSearch(debounced, employeeName(r.row.employeeId), employeeCode(r.row.employeeId), departmentName(r.row.employeeId)),
      ),
    [rows, filter, debounced],
  );
  const chipOptions: ChipOption<AttendanceFilterKey>[] = FILTERS.filter((f) => f === 'All' || counts[f]).map((f) => ({
    label: f,
    value: f,
    count: counts[f] ?? 0,
  }));
  const pendingCorrections = corrections.data ?? 0;

  return (
    <Screen
      scroll={false}
      padded={false}
      header={<SearchBar value={search} onChangeText={setSearch} placeholder="Search name, code or department" accessibilityLabel="Search employees" />}
    >
      <QueryStateView query={query} loadingVariant="skeleton" isEmpty={(d) => d.attendance.length === 0} emptyTitle="No active employees" emptyMessage="Attendance appears here once employees are added.">
        {(data) => (
          <FlatList
            data={visible}
            keyExtractor={(r) => r.row.employeeId._id}
            extraData={now}
            contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.md }}
            refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => void query.refetch()} />}
            ListHeaderComponent={
              <View style={{ gap: theme.spacing.md, paddingBottom: theme.spacing.sm }}>
                <AppText variant="heading">{formatDateLong(data.businessDate)}</AppText>
                {data.isOffDay ? (
                  <InlineNotice tone="info" icon="sunny-outline" message={`${data.reason || 'Off day'} — no attendance is expected today.`} />
                ) : null}
                <View style={{ flexDirection: 'row', gap: theme.spacing.sm, flexWrap: 'wrap' }}>
                  <Button
                    label="Attendance report"
                    icon="document-text-outline"
                    variant="secondary"
                    fullWidth={false}
                    onPress={() => router.push('/admin/attendance-report')}
                  />
                  <Button
                    label={pendingCorrections ? `Review corrections (${pendingCorrections})` : 'Review corrections'}
                    icon="chatbox-ellipses-outline"
                    variant="secondary"
                    fullWidth={false}
                    onPress={() => router.push({ pathname: '/admin/requests', params: { segment: 'corrections' } })}
                  />
                </View>
                <FilterChips options={chipOptions} value={filter} onChange={setFilter} accessibilityLabel="Attendance status filter" />
              </View>
            }
            ListEmptyComponent={
              <AppText variant="body" color="textSecondary" align="center">
                No employees match this filter.
              </AppText>
            }
            renderItem={({ item }) => (
              <AttendanceRowCard
                row={item.row}
                label={item.display.label}
                tone={item.display.tone}
                worked={workedLabel(item.row, now)}
                onPress={() => router.push(`/admin/attendance/${item.row.employeeId._id}`)}
              />
            )}
          />
        )}
      </QueryStateView>
    </Screen>
  );
}

function AttendanceRowCard({
  row,
  label,
  tone,
  worked,
  onPress,
}: {
  row: TodayAttendanceRow;
  label: string;
  tone: ReturnType<typeof displayAttendanceStatus>['tone'];
  worked: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  const e = row.employeeId;
  const name = employeeName(e);
  const inOut = `In ${formatTime(row.checkIn)} · Out ${formatTime(row.checkOut)}`;
  return (
    <Card
      onPress={onPress}
      accessibilityLabel={`${name}, ${employeeCode(e)}, ${departmentName(e)}, ${label}, check in ${formatTime(row.checkIn, 'none')}, check out ${formatTime(row.checkOut, 'none')}, worked ${worked}`}
      accessibilityHint="Opens attendance details and status update"
    >
      <View style={{ flexDirection: 'row', gap: theme.spacing.md, alignItems: 'center' }}>
        <Avatar uri={e.userId?.profileImage} name={name} id={e._id} size={40} />
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="bodyStrong">{name}</AppText>
          <AppText variant="secondary">
            {employeeCode(e)} · {departmentName(e)}
          </AppText>
        </View>
        <StatusPill label={label} tone={tone} accessibilityPrefix="Status" />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: theme.spacing.sm }}>
        <AppText variant="secondary">{inOut}</AppText>
        <AppText variant="secondary">Worked {worked}</AppText>
      </View>
    </Card>
  );
}
