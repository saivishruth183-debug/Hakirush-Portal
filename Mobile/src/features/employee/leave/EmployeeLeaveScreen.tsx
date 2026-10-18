import { useRouter } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { AppText, Button, Card, EmptyState, ErrorState, LoadingState, Screen, StatusPill } from '@/components';
import { useApiQuery } from '@/services/hooks';
import { useQueryKeys } from '@/services/queryKeys';
import { useSession } from '@/services/session';
import { useTheme } from '@/theme';
import type { Leave, LeaveStatus } from '@/types/api';
import { formatDate } from '@/utils/format';

import { formatRange } from '../format';
import type { LeaveBalanceResponse, LeavesResponse } from '../types';

type Filter = 'All' | LeaveStatus;
const FILTERS: Filter[] = ['All', 'Pending', 'Approved', 'Rejected', 'Cancelled'];

export function EmployeeLeaveScreen() {
  const theme = useTheme();
  const router = useRouter();
  const keys = useQueryKeys();
  const { canWrite } = useSession();
  const [filter, setFilter] = useState<Filter>('All');
  const balance = useApiQuery<LeaveBalanceResponse>(keys.leaveBalance(), '/api/leave/balance/me');
  const leaves = useApiQuery<LeavesResponse>(keys.leaves(), '/api/leave/me');
  const rows = (leaves.data?.leaves ?? []).filter((l) => filter === 'All' || l.status === filter);

  const header = (
    <View style={{ gap: theme.spacing.md, padding: theme.spacing.lg, paddingBottom: 0 }}>
      <BalanceCard data={balance.data} loading={balance.isPending} error={balance.isError && !balance.data ? balance.error : null} onRetry={() => balance.refetch()} />
      <Button label="Apply for leave" icon="add" disabled={!canWrite} onPress={() => router.push('/employee/leave-apply')} />
      {!canWrite ? <AppText variant="secondary" color="warning">Applying and cancelling are paused while offline.</AppText> : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: theme.spacing.sm }} accessibilityRole="tablist">
        {FILTERS.map((f) => {
          const selected = f === filter;
          return (
            <Pressable
              key={f}
              onPress={() => setFilter(f)}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              accessibilityLabel={`Show ${f.toLowerCase()} leave`}
              style={[
                styles.chip,
                {
                  borderRadius: theme.radii.pill,
                  borderColor: selected ? theme.colors.primary : theme.colors.borderStrong,
                  backgroundColor: selected ? theme.colors.primarySoft : theme.colors.surface,
                },
              ]}
            >
              <AppText variant="label" color={selected ? 'primary' : 'textSecondary'}>
                {f}
              </AppText>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );

  return (
    <Screen scroll={false} padded={false}>
      <FlatList
        data={rows}
        keyExtractor={(l) => l._id}
        ListHeaderComponent={header}
        contentContainerStyle={{ gap: theme.spacing.md, paddingBottom: theme.spacing.xl }}
        renderItem={({ item }) => <LeaveCard leave={item} onPress={() => router.push(`/employee/leave-detail/${item._id}`)} />}
        ListEmptyComponent={
          leaves.isPending ? (
            <LoadingState />
          ) : leaves.isError && !leaves.data ? (
            <ErrorState error={leaves.error} onRetry={() => leaves.refetch()} />
          ) : (
            <EmptyState title={filter === 'All' ? 'No leave requests yet' : `No ${filter.toLowerCase()} leave`} />
          )
        }
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={() => {
              void balance.refetch();
              void leaves.refetch();
            }}
            colors={[theme.colors.primary]}
            tintColor={theme.colors.primary}
          />
        }
      />
    </Screen>
  );
}

function BalanceCard({
  data,
  loading,
  error,
  onRetry,
}: {
  data?: LeaveBalanceResponse;
  loading: boolean;
  error: unknown;
  onRetry: () => void;
}) {
  if (error) return <ErrorState error={error} title="Couldn't load your balance" onRetry={onRetry} />;
  if (!data) return <Card>{loading ? <LoadingState label="Loading balance…" /> : null}</Card>;
  const period =
    data.period?.start && data.period?.end ? `${formatDate(data.period.start)} – ${formatDate(data.period.end)}` : 'All time';
  return (
    <Card>
      <AppText variant="heading">Leave balance</AppText>
      <AppText variant="display">
        {data.total.balance}
        <AppText variant="body" color="textSecondary">
          {' '}
          of {data.total.total} days left
        </AppText>
      </AppText>
      <AppText variant="secondary">
        Casual: {data.casual.balance} left ({data.casual.used} of {data.casual.total} used)
      </AppText>
      <AppText variant="secondary">
        Sick: {data.sick.balance} left ({data.sick.used} of {data.sick.total} used)
      </AppText>
      <AppText variant="caption">Period: {period}. Only approved leave counts as used.</AppText>
    </Card>
  );
}

function LeaveCard({ leave, onPress }: { leave: Leave; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Card
      onPress={onPress}
      accessibilityLabel={`${leave.leaveType}, ${leave.status}, ${formatRange(leave.startDate, leave.endDate)}, ${leave.days} days`}
      style={{ marginHorizontal: theme.spacing.lg }}
    >
      <View style={styles.row}>
        <AppText variant="bodyStrong" style={styles.flex}>
          {leave.leaveType}
        </AppText>
        <StatusPill status={leave.status} accessibilityPrefix="Leave status" />
      </View>
      <AppText variant="secondary">
        {formatRange(leave.startDate, leave.endDate)} · {leave.days} {leave.days === 1 ? 'day' : 'days'}
      </AppText>
      {leave.reason ? <AppText variant="body">{leave.reason}</AppText> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  flex: { flex: 1 },
  chip: { minHeight: 48, paddingHorizontal: 16, justifyContent: 'center', borderWidth: 1 },
});
