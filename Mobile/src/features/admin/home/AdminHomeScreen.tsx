import { useQuery } from '@tanstack/react-query';
import { useIsFocused, useRouter } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { useState } from 'react';
import { View } from 'react-native';

import { AppText, Avatar, Button, Card, Divider, ErrorState, ListRow, LoadingState, Screen, SectionHeader } from '@/components';
import { BarChart, InlineNotice, StatTile, TileGrid } from '@/features/admin/ops/components';
import { exportCsv } from '@/features/admin/ops/export';
import { useAdminOpsKeys } from '@/features/admin/ops/keys';
import type { AdminAttendanceSummary, DashboardBirthday, DashboardSummaryResponse } from '@/features/admin/ops/types';
import { usePendingCounts } from '@/features/admin/requests/hooks';
import { api } from '@/services/api';
import { useSession } from '@/services/session';
import { useTheme } from '@/theme';
import { businessDate, formatDateLong, formatNumber } from '@/utils/format';

import { NotificationBell } from './NotificationBell';
import { buildSummaryCsv } from './summaryCsv';

/** Days from `todayYmd` until the next MM-DD of `dobIso` (0 = today). */
export function daysUntilBirthday(dobIso: string | undefined, todayYmd: string): number | null {
  if (!dobIso) return null;
  const d = new Date(dobIso);
  if (Number.isNaN(d.getTime())) return null;
  const dob = businessDate(d);
  const [ty, tm, td] = todayYmd.split('-').map(Number);
  const [, bm, bd] = dob.split('-').map(Number);
  const today = Date.UTC(ty, tm - 1, td);
  let next = Date.UTC(ty, bm - 1, bd);
  if (next < today) next = Date.UTC(ty + 1, bm - 1, bd);
  return Math.round((next - today) / 86_400_000);
}

/** Admin "Home" tab: today's attendance, pending reviews, organisation metrics and charts. */
export function AdminHomeScreen() {
  const router = useRouter();
  const isFocused = useIsFocused();
  const { user } = useSession();
  const keys = useAdminOpsKeys();
  const [exporting, setExporting] = useState(false);

  const summary = useQuery({
    queryKey: keys.dashboardSummary(),
    queryFn: ({ signal }) => api.get<DashboardSummaryResponse>('/api/dashboard/summary', { signal }),
  });
  const attendance = useQuery({
    queryKey: keys.attendanceSummary(),
    queryFn: ({ signal }) => api.get<AdminAttendanceSummary>('/api/attendance/admin/summary', { signal }),
    refetchInterval: isFocused ? 60_000 : false,
  });
  const pending = usePendingCounts({ refetchInterval: isFocused ? 60_000 : false });

  const refreshing = summary.isRefetching || attendance.isRefetching;
  const onRefresh = () => {
    void summary.refetch();
    void attendance.refetch();
    void pending.leaves.refetch();
    void pending.corrections.refetch();
  };

  const exportSummary = async () => {
    if (!summary.data) return;
    setExporting(true);
    try {
      const today = businessDate();
      await exportCsv(
        `Summary_${today}.csv`,
        buildSummaryCsv(summary.data, attendance.data, { leaves: pending.leaves.data, corrections: pending.corrections.data }, today),
      );
    } finally {
      setExporting(false);
    }
  };

  const a = attendance.data;
  const s = summary.data;
  const today = a?.businessDate ?? businessDate();

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}>
      <Tabs.Screen options={{ headerRight: () => <NotificationBell polling={isFocused} /> }} />
      <View>
        <AppText variant="title">Hello{user?.name ? `, ${user.name.split(' ')[0]}` : ''}</AppText>
        <AppText variant="secondary">{formatDateLong(today)}</AppText>
      </View>

      <SectionHeader title="Attendance today" actionLabel="Open" onAction={() => router.push('/admin/attendance')} />
      {attendance.isError && !a ? (
        <ErrorState error={attendance.error} title="Couldn't load today's attendance" onRetry={() => attendance.refetch()} />
      ) : !a ? (
        <LoadingState label="Loading attendance" />
      ) : (
        <>
          {a.isHoliday ? <InlineNotice icon="sunny-outline" message={`${a.holidayName || 'Holiday'} — off day, no attendance expected.`} /> : null}
          <TileGrid>
            <StatTile label="Present" value={a.presentToday ?? a.activeToday} icon="checkmark-circle-outline" tone="success" />
            <StatTile label="Half day" value={a.halfDayToday} icon="time-outline" tone="warning" />
            <StatTile label="On leave" value={a.onLeaveToday} icon="airplane-outline" tone="neutral" />
            <StatTile label="Absent" value={a.absentToday} icon="alert-circle-outline" tone="danger" />
            <StatTile label="Late logins (after 10:00)" value={a.lateLogins} icon="alarm-outline" tone="info" />
          </TileGrid>
        </>
      )}

      <SectionHeader title="Waiting for review" />
      <Card padded={false}>
        <ListRow
          title="Leave requests"
          subtitle={pending.leaves.isError ? 'Count unavailable' : `${formatNumber(pending.leaves.data ?? 0)} pending`}
          left={{ icon: 'calendar-outline' }}
          onPress={() => router.push({ pathname: '/admin/requests', params: { segment: 'leave' } })}
          accessibilityLabel={`Leave requests, ${pending.leaves.data ?? 0} pending`}
        />
        <Divider inset={68} />
        <ListRow
          title="Attendance corrections"
          subtitle={pending.corrections.isError ? 'Count unavailable' : `${formatNumber(pending.corrections.data ?? 0)} pending`}
          left={{ icon: 'chatbox-ellipses-outline' }}
          onPress={() => router.push({ pathname: '/admin/requests', params: { segment: 'corrections' } })}
          accessibilityLabel={`Attendance corrections, ${pending.corrections.data ?? 0} pending`}
        />
      </Card>

      <SectionHeader title="Organisation" />
      {summary.isError && !s ? (
        <ErrorState error={summary.error} title="Couldn't load the summary" onRetry={() => summary.refetch()} />
      ) : !s ? (
        <LoadingState label="Loading summary" variant="skeleton" />
      ) : (
        <>
          <TileGrid>
            <StatTile label="Employees" value={s.totalEmployees} icon="people-outline" />
            <StatTile label="Departments" value={s.totalDepartments} icon="business-outline" tone="info" />
            <StatTile label="Clients" value={s.totalClients} icon="briefcase-outline" tone="success" />
            <StatTile label="Sponsors" value={s.totalSponsors} icon="ribbon-outline" tone="warning" />
          </TileGrid>

          <BarChart
            title="Leave trends"
            subtitle={`${formatNumber(s.leaveSummary?.appliedFor ?? 0)} employees have applied for leave`}
            unit="requests"
            data={[
              { label: 'Pending', value: s.leaveSummary?.pending ?? 0, tone: 'warning' },
              { label: 'Approved', value: s.leaveSummary?.approved ?? 0, tone: 'success' },
              { label: 'Rejected', value: s.leaveSummary?.rejected ?? 0, tone: 'danger' },
            ]}
          />
          <BarChart
            title="Department staffing"
            unit="employees"
            data={[...(s.departmentSummary ?? [])].sort((x, y) => y.employees - x.employees).map((d) => ({ label: d.department, value: d.employees }))}
          />
          <BarChart
            title="Client plans"
            unit="clients"
            data={[
              { label: 'Annual', value: s.totalAnnual ?? 0 },
              { label: 'Quarterly', value: s.totalQuarterly ?? 0 },
            ]}
          />
          <BarChart
            title="Sponsor collaborations"
            subtitle={`${formatNumber(s.sponsorSummary?.totalSponsoredEvents ?? 0)} sponsored events`}
            unit="sponsors"
            data={Object.entries(s.sponsorSummary?.collaborationSummary ?? {}).map(([label, value]) => ({ label, value }))}
          />
          <BarChart
            title="Stall types"
            subtitle={`${formatNumber(s.stallSummary?.totalStalls ?? 0)} stalls · ${formatNumber(s.stallSummary?.totalStallEvents ?? 0)} events`}
            unit="stalls"
            data={Object.entries(s.stallSummary?.typeSummary ?? {}).map(([label, value]) => ({ label, value }))}
          />

          <Birthdays today={s.birthdaySummary?.today ?? []} upcoming={s.birthdaySummary?.upcoming ?? []} todayYmd={today} />

          <Card>
            <AppText variant="heading">Export</AppText>
            <AppText variant="secondary">Today’s attendance, pending reviews and organisation metrics as a CSV file.</AppText>
            <Button label="Export summary CSV" icon="download-outline" onPress={exportSummary} loading={exporting} testID="export-summary" />
          </Card>
        </>
      )}
    </Screen>
  );
}

function Birthdays({ today, upcoming, todayYmd }: { today: DashboardBirthday[]; upcoming: DashboardBirthday[]; todayYmd: string }) {
  const theme = useTheme();
  if (today.length === 0 && upcoming.length === 0) return null;
  const sorted = [...upcoming]
    .map((b) => ({ b, days: daysUntilBirthday(b.dob, todayYmd) }))
    .sort((x, y) => (x.days ?? 999) - (y.days ?? 999));
  return (
    <>
      <SectionHeader title="Birthdays" subtitle="Today and the next 30 days" />
      <Card padded={false}>
        {today.map((b) => (
          <View key={b._id}>
            <ListRow
              title={b.name ?? 'Employee'}
              subtitle={[b.department, 'Birthday today'].filter(Boolean).join(' · ')}
              left={<Avatar uri={b.profileImage} name={b.name ?? '?'} id={b._id} size={40} />}
            />
            <Divider inset={theme.spacing.lg} />
          </View>
        ))}
        {sorted.map(({ b, days }) => (
          <View key={b._id}>
            <ListRow
              title={b.name ?? 'Employee'}
              subtitle={[b.department, days === null ? null : days === 1 ? 'in 1 day' : `in ${days} days`].filter(Boolean).join(' · ')}
              left={<Avatar uri={b.profileImage} name={b.name ?? '?'} id={b._id} size={40} />}
            />
            <Divider inset={theme.spacing.lg} />
          </View>
        ))}
      </Card>
    </>
  );
}
