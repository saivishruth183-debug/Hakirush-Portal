import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, Avatar, Badge, Card, Divider, IconButton, ListRow, QueryStateView, Screen, SectionHeader } from '@/components';
import { useNow } from '@/hooks';
import { useApiQuery } from '@/services/hooks';
import { useQueryKeys } from '@/services/queryKeys';
import { useSession } from '@/services/session';
import { useTheme } from '@/theme';
import { formatDate, formatDateLong } from '@/utils/format';

import { TodayAttendanceCard } from '../attendance/TodayAttendanceCard';
import { formatMonthDay, mediaUrl } from '../format';
import { TeamPreviewCard } from '../team/TeamPreviewCard';
import type {
  AnnouncementsResponse,
  AttendanceRequestsResponse,
  CelebrationsResponse,
  HolidaysResponse,
  LeavesResponse,
  NewJoinersResponse,
  NotificationsResponse,
  ExpensesResponse,
} from '../types';

function greeting(nowMs: number): string {
  const h = new Date(nowMs + 330 * 60_000).getUTCHours(); // Asia/Kolkata
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export function EmployeeHomeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const keys = useQueryKeys();
  const queryClient = useQueryClient();
  const { user, directoryVerified } = useSession();
  const now = useNow(60_000);
  const [refreshing, setRefreshing] = useState(false);

  const notifications = useApiQuery<NotificationsResponse>([...keys.notifications(), 'summary'], '/api/notifications', {
    query: { page: 1, limit: 1 },
    refetchInterval: 60_000,
  });
  const leaves = useApiQuery<LeavesResponse>(keys.leaves(), '/api/leave/me');
  const requests = useApiQuery<AttendanceRequestsResponse>(keys.attendanceRequests(), '/api/attendance-request/me');
  const holidays = useApiQuery<HolidaysResponse>(keys.holidays('upcoming'), '/api/holiday/upcoming');
  const announcements = useApiQuery<AnnouncementsResponse>(keys.announcements(), '/api/announcements/public');
  const expenses = useApiQuery<ExpensesResponse>(keys.expenses(), '/api/expenses/me');

  const onRefresh = async () => {
    setRefreshing(true);
    await queryClient.refetchQueries({ queryKey: keys.all(), type: 'active' }).catch(() => undefined);
    setRefreshing(false);
  };

  const unseen = notifications.data?.unseenCount ?? 0;
  const pendingLeaves = leaves.data?.leaves.filter((l) => l.status === 'Pending').length;
  const pendingRequests = requests.data?.requests.filter((r) => r.status === 'Pending').length;
  const pendingExpenses = expenses.data?.claims.filter((c) => c.status === 'Pending').length;
  const firstName = (user?.name ?? '').split(/\s+/)[0];

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}>
      <View style={styles.row}>
        <View style={styles.flex}>
          <AppText variant="title">
            {greeting(now)}
            {firstName ? `, ${firstName}` : ''}
          </AppText>
          {user?.designation ? <AppText variant="secondary">{user.designation}</AppText> : null}
        </View>
        <View>
          <IconButton
            icon="notifications-outline"
            accessibilityLabel={unseen ? `Notifications, ${unseen} unread` : 'Notifications'}
            onPress={() => router.push('/employee/notifications')}
            variant="tonal"
          />
          {unseen ? (
            <View style={[styles.dot, { backgroundColor: theme.colors.danger, borderRadius: 10 }]} pointerEvents="none">
              <AppText variant="label" style={{ color: theme.colors.onDanger, fontSize: 11, lineHeight: 14 }}>
                {unseen > 99 ? '99+' : unseen}
              </AppText>
            </View>
          ) : null}
        </View>
      </View>

      <TodayAttendanceCard />

      <SectionHeader title="Pending" />
      <Card padded={false}>
        <ListRow
          title="Leave requests"
          subtitle={pendingLeaves === undefined ? 'Loading…' : `${pendingLeaves} pending`}
          left={{ icon: 'calendar-outline' }}
          onPress={() => router.navigate('/employee/leave')}
        />
        <Divider inset={68} />
        <ListRow
          title="Attendance corrections"
          subtitle={pendingRequests === undefined ? 'Loading…' : `${pendingRequests} pending`}
          left={{ icon: 'create-outline' }}
          onPress={() => router.navigate('/employee/attendance')}
        />
        <Divider inset={68} />
        <ListRow
          title="Expense claims"
          subtitle={pendingExpenses === undefined ? 'Loading…' : `${pendingExpenses} pending`}
          left={{ icon: 'receipt-outline' }}
          onPress={() => router.navigate('/employee/expenses')}
        />
      </Card>

      <SectionHeader title="My team" />
      <TeamPreviewCard />

      <SectionHeader title="Upcoming holidays" actionLabel="View all" onAction={() => router.push('/employee/holidays')} />
      <Card padded={false}>
        <QueryStateView query={holidays} isEmpty={(d) => d.holidays.length === 0} emptyTitle="No upcoming holidays">
          {(d) =>
            d.holidays.slice(0, 3).map((h, i) => (
              <View key={h._id}>
                {i ? <Divider inset={68} /> : null}
                <ListRow title={h.title} subtitle={formatDateLong(h.ymd)} left={{ icon: 'sunny-outline' }} />
              </View>
            ))
          }
        </QueryStateView>
      </Card>

      <SectionHeader title="Announcements" actionLabel="View all" onAction={() => router.push('/employee/notices')} />
      <Card padded={false}>
        <QueryStateView query={announcements} isEmpty={(d) => d.announcements.length === 0} emptyTitle="No announcements">
          {(d) =>
            d.announcements.slice(0, 3).map((a, i) => (
              <View key={a._id}>
                {i ? <Divider inset={68} /> : null}
                <ListRow
                  title={a.title}
                  subtitle={[a.type, a.date ? formatDate(a.date) : null].filter(Boolean).join(' · ')}
                  left={{ icon: 'megaphone-outline' }}
                  right={a.seen ? undefined : <Badge label="New" tone="primary" />}
                  accessibilityLabel={`${a.title}${a.seen ? '' : ', unread'}`}
                  onPress={() => router.push(`/employee/notice/${a._id}`)}
                />
              </View>
            ))
          }
        </QueryStateView>
      </Card>

      {directoryVerified ? <Highlights /> : null}
    </Screen>
  );
}

function Highlights() {
  const keys = useQueryKeys();
  const birthdays = useApiQuery<CelebrationsResponse>(keys.birthdays(), '/api/employee/birthdays');
  const anniversaries = useApiQuery<CelebrationsResponse>(keys.anniversaries(), '/api/employee/anniversaries');
  const joiners = useApiQuery<NewJoinersResponse>(keys.newJoiners(), '/api/employee/new/recent');

  const rows: { key: string; name: string; photo?: string; text: string }[] = [];
  for (const b of [...(birthdays.data?.today ?? []), ...(birthdays.data?.upcoming ?? [])]) {
    const isToday = birthdays.data?.today.includes(b);
    rows.push({ key: `b-${b._id}`, name: b.name, photo: b.profileImage, text: `Birthday · ${isToday ? 'Today' : formatMonthDay(b.monthDay)}` });
  }
  for (const a of [...(anniversaries.data?.today ?? []), ...(anniversaries.data?.upcoming ?? [])]) {
    const isToday = anniversaries.data?.today.includes(a);
    rows.push({
      key: `a-${a._id}`,
      name: a.name,
      photo: a.profileImage,
      text: `${a.years ?? ''} year work anniversary · ${isToday ? 'Today' : formatMonthDay(a.monthDay)}`.trim(),
    });
  }
  for (const j of joiners.data?.employees ?? []) {
    const d = j.joinedDaysAgo ?? 0;
    rows.push({ key: `j-${j._id}`, name: j.name, photo: j.profileImage, text: `New joiner · ${d === 0 ? 'Joined today' : `Joined ${d} day${d === 1 ? '' : 's'} ago`}` });
  }
  const loading = birthdays.isPending || anniversaries.isPending || joiners.isPending;

  return (
    <>
      <SectionHeader title="Team highlights" subtitle="Your department, next 7 days" />
      <Card padded={false}>
        {rows.length === 0 ? (
          <AppText variant="secondary" style={{ padding: 16 }}>
            {loading ? 'Loading…' : 'No birthdays, work anniversaries or new joiners right now.'}
          </AppText>
        ) : (
          rows.map((r, i) => (
            <View key={r.key}>
              {i ? <Divider inset={68} /> : null}
              <ListRow title={r.name} subtitle={r.text} left={<Avatar uri={mediaUrl(r.photo)} name={r.name} id={r.key.slice(2)} size={40} />} />
            </View>
          ))
        )}
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  flex: { flex: 1 },
  dot: { position: 'absolute', top: 2, right: 2, minWidth: 20, paddingHorizontal: 4, alignItems: 'center' },
});
