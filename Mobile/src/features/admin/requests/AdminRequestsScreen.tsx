import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';

import {
  AppText,
  Card,
  QueryStateView,
  Screen,
  SearchBar,
  SegmentedControl,
  StatusPill,
  type SegmentOption,
} from '@/components';
import { LoadMoreFooter } from '@/features/admin/ops/components';
import { departmentName, employeeCode, employeeName, matchesSearch, storedDateToYmd } from '@/features/admin/ops/format';
import type { AdminLeave, CorrectionRequest } from '@/features/admin/ops/types';
import { useDebouncedValue } from '@/hooks';
import { useTheme } from '@/theme';
import { formatDate, formatDateLong, pluralize } from '@/utils/format';

import { useCorrectionList, useLeaveList, usePendingCounts } from './hooks';

type Segment = 'leave' | 'corrections';
type StatusFilter = 'Pending' | 'Approved' | 'Rejected' | 'All';

const STATUS_OPTIONS: readonly SegmentOption<StatusFilter>[] = [
  { label: 'Pending', value: 'Pending' },
  { label: 'Approved', value: 'Approved' },
  { label: 'Rejected', value: 'Rejected' },
  { label: 'All', value: 'All' },
];

/** Admin "Requests" tab: leave applications and attendance-correction requests. */
export function AdminRequestsScreen() {
  const params = useLocalSearchParams<{ segment?: string }>();
  const [segment, setSegment] = useState<Segment>(params.segment === 'corrections' ? 'corrections' : 'leave');
  const [search, setSearch] = useState('');
  const debounced = useDebouncedValue(search, 250);
  const { leaves: pendingLeaves, corrections: pendingCorrections } = usePendingCounts();
  const theme = useTheme();

  const countLabel = (base: string, n: number | undefined) => (n ? `${base} (${n})` : base);
  const segments: SegmentOption<Segment>[] = [
    { label: countLabel('Leave', pendingLeaves.data), value: 'leave' },
    { label: countLabel('Corrections', pendingCorrections.data), value: 'corrections' },
  ];

  return (
    <Screen
      scroll={false}
      padded={false}
      header={
        <View style={{ gap: theme.spacing.sm }}>
          <SegmentedControl options={segments} value={segment} onChange={setSegment} accessibilityLabel="Request type" />
          <SearchBar
            value={search}
            onChangeText={setSearch}
            placeholder={segment === 'leave' ? 'Search name, code, department or type' : 'Search name, code or department'}
            accessibilityLabel="Search requests"
          />
        </View>
      }
    >
      {segment === 'leave' ? <LeaveRequestsList search={debounced} /> : <CorrectionRequestsList search={debounced} />}
    </Screen>
  );
}

function StatusFilterHeader({ value, onChange, label }: { value: StatusFilter; onChange: (v: StatusFilter) => void; label: string }) {
  const theme = useTheme();
  return (
    <View style={{ paddingBottom: theme.spacing.md }}>
      <SegmentedControl options={STATUS_OPTIONS} value={value} onChange={onChange} accessibilityLabel={label} />
    </View>
  );
}

function searchNote(search: string, loaded: number, hasMore: boolean): string | undefined {
  if (!search || !hasMore) return undefined;
  return `Search covers the ${loaded} requests loaded so far. Load more to search older ones.`;
}

export function LeaveRequestsList({ search }: { search: string }) {
  const router = useRouter();
  const theme = useTheme();
  const [status, setStatus] = useState<StatusFilter>('Pending');
  const query = useLeaveList(status);
  const all = useMemo(() => query.data?.pages.flatMap((p) => p.leaves) ?? [], [query.data]);
  const items = useMemo(
    () =>
      all.filter((l) =>
        matchesSearch(search, employeeName(l.employeeId), employeeCode(l.employeeId), departmentName(l.employeeId), l.leaveType),
      ),
    [all, search],
  );
  const header = <StatusFilterHeader value={status} onChange={setStatus} label="Leave status filter" />;

  return (
    <QueryStateView query={query} loadingVariant="skeleton">
      {() => (
        <FlatList
          data={items}
          keyExtractor={(l) => l._id}
          contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.md }}
          ListHeaderComponent={header}
          ListEmptyComponent={
            <AppText variant="body" color="textSecondary" align="center">
              {search ? 'No leave requests match your search.' : `No ${status === 'All' ? '' : status.toLowerCase() + ' '}leave requests.`}
            </AppText>
          }
          renderItem={({ item }) => <LeaveCard leave={item} onPress={() => router.push(`/admin/leaves/${item._id}`)} />}
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
          }}
          refreshControl={
            <RefreshControl refreshing={query.isRefetching && !query.isFetchingNextPage} onRefresh={() => void query.refetch()} />
          }
          ListFooterComponent={
            <LoadMoreFooter
              hasNextPage={!!query.hasNextPage}
              isFetchingNextPage={query.isFetchingNextPage}
              onLoadMore={() => query.fetchNextPage()}
              note={searchNote(search, all.length, !!query.hasNextPage)}
            />
          }
        />
      )}
    </QueryStateView>
  );
}

function LeaveCard({ leave, onPress }: { leave: AdminLeave; onPress: () => void }) {
  const theme = useTheme();
  const name = employeeName(leave.employeeId);
  const start = formatDate(storedDateToYmd(leave.startDate));
  const end = formatDate(storedDateToYmd(leave.endDate));
  const days = pluralize(leave.days ?? 0, 'working day');
  return (
    <Card
      onPress={onPress}
      accessibilityLabel={`${name}, ${leave.leaveType}, ${start} to ${end}, ${days}, status ${leave.status}`}
      accessibilityHint="Opens the leave request"
    >
      <View style={{ flexDirection: 'row', gap: theme.spacing.md, alignItems: 'flex-start' }}>
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="bodyStrong">{name}</AppText>
          <AppText variant="secondary">
            {employeeCode(leave.employeeId)} · {departmentName(leave.employeeId)}
          </AppText>
        </View>
        <StatusPill status={leave.status} accessibilityPrefix="Status" />
      </View>
      <AppText variant="body">
        {leave.leaveType} · {days}
      </AppText>
      <AppText variant="secondary">
        {start} – {end}
      </AppText>
    </Card>
  );
}

export function CorrectionRequestsList({ search }: { search: string }) {
  const router = useRouter();
  const theme = useTheme();
  const [status, setStatus] = useState<StatusFilter>('Pending');
  const query = useCorrectionList(status);
  const all = useMemo(() => query.data?.pages.flatMap((p) => p.requests) ?? [], [query.data]);
  const items = useMemo(
    () => all.filter((r) => matchesSearch(search, employeeName(r.employeeId), employeeCode(r.employeeId), departmentName(r.employeeId))),
    [all, search],
  );
  const header = <StatusFilterHeader value={status} onChange={setStatus} label="Correction status filter" />;

  return (
    <QueryStateView query={query} loadingVariant="skeleton">
      {() => (
        <FlatList
          data={items}
          keyExtractor={(r) => r._id}
          contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.md }}
          ListHeaderComponent={header}
          ListEmptyComponent={
            <AppText variant="body" color="textSecondary" align="center">
              {search ? 'No correction requests match your search.' : `No ${status === 'All' ? '' : status.toLowerCase() + ' '}correction requests.`}
            </AppText>
          }
          renderItem={({ item }) => (
            <CorrectionCard
              request={item}
              onPress={() =>
                router.push({
                  pathname: '/admin/corrections/[id]',
                  params: { id: item._id, ...(item.employeeId?._id ? { employeeId: item.employeeId._id } : {}) },
                })
              }
            />
          )}
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
          }}
          refreshControl={
            <RefreshControl refreshing={query.isRefetching && !query.isFetchingNextPage} onRefresh={() => void query.refetch()} />
          }
          ListFooterComponent={
            <LoadMoreFooter
              hasNextPage={!!query.hasNextPage}
              isFetchingNextPage={query.isFetchingNextPage}
              onLoadMore={() => query.fetchNextPage()}
              note={searchNote(search, all.length, !!query.hasNextPage)}
            />
          }
        />
      )}
    </QueryStateView>
  );
}

function CorrectionCard({ request, onPress }: { request: CorrectionRequest; onPress: () => void }) {
  const theme = useTheme();
  const name = employeeName(request.employeeId);
  const date = formatDateLong(request.date);
  return (
    <Card
      onPress={onPress}
      accessibilityLabel={`${name}, ${date}, ${request.currentStatus} to ${request.requestedStatus}, status ${request.status}`}
      accessibilityHint="Opens the correction request"
    >
      <View style={{ flexDirection: 'row', gap: theme.spacing.md, alignItems: 'flex-start' }}>
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="bodyStrong">{name}</AppText>
          <AppText variant="secondary">
            {employeeCode(request.employeeId)} · {departmentName(request.employeeId)}
          </AppText>
        </View>
        <StatusPill status={request.status} accessibilityPrefix="Status" />
      </View>
      <AppText variant="body">{date}</AppText>
      <AppText variant="secondary">
        {request.currentStatus} → {request.requestedStatus}
      </AppText>
      <AppText variant="secondary">{request.reason}</AppText>
      {request.reviewedAt ? <AppText variant="caption">Reviewed {formatDate(request.reviewedAt)}</AppText> : null}
    </Card>
  );
}
