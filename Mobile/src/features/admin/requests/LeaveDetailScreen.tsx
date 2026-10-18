import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import {
  AppText,
  Avatar,
  Button,
  Card,
  confirm,
  DetailRow,
  LoadingState,
  QueryStateView,
  Screen,
  SectionHeader,
  StatusPill,
  toast,
} from '@/components';
import { fetchLeaveDetail, reviewLeave } from '@/features/admin/ops/api';
import { InlineNotice } from '@/features/admin/ops/components';
import { departmentName, employeeCode, employeeName, storedDateToYmd } from '@/features/admin/ops/format';
import { useAdminOpsKeys } from '@/features/admin/ops/keys';
import type { AdminLeave, LeaveBalanceResponse } from '@/features/admin/ops/types';
import { api } from '@/services/api';
import { useApiMutation } from '@/services/hooks';
import { useQueryKeys } from '@/services/queryKeys';
import { useSession } from '@/services/session';
import { useTheme } from '@/theme';
import { formatDate, formatDateLong, formatDateTime, pluralize } from '@/utils/format';

import { handleReviewError } from './reviewErrors';

/** /admin/leaves/[id] — leave request detail, employee balance, approve / reject. */
export function LeaveDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const leaveId = String(id ?? '');
  const opsKeys = useAdminOpsKeys();
  const query = useQuery({
    queryKey: opsKeys.leaveDetail(leaveId),
    queryFn: ({ signal }) => fetchLeaveDetail(leaveId, signal),
    enabled: !!leaveId,
  });
  return (
    <Screen refreshing={query.isRefetching} onRefresh={() => void query.refetch()}>
      <Stack.Screen options={{ title: 'Leave request' }} />
      <QueryStateView query={query} errorTitle="Couldn't load this leave request">
        {(data) => <LeaveDetailBody leave={data.leave} onRefetch={() => query.refetch()} />}
      </QueryStateView>
    </Screen>
  );
}

function LeaveDetailBody({ leave, onRefetch }: { leave: AdminLeave; onRefetch: () => unknown }) {
  const theme = useTheme();
  const { canWrite } = useSession();
  const keys = useQueryKeys();
  const opsKeys = useAdminOpsKeys();
  const queryClient = useQueryClient();
  const employee = leave.employeeId;
  const name = employeeName(employee);
  const start = storedDateToYmd(leave.startDate);
  const end = storedDateToYmd(leave.endDate);
  const isPending = leave.status === 'Pending';

  const balance = useQuery({
    queryKey: opsKeys.leaveBalance(employee?._id ?? ''),
    queryFn: ({ signal }) => api.get<LeaveBalanceResponse>(`/api/leave/balance/${encodeURIComponent(employee?._id ?? '')}`, { signal }),
    enabled: !!employee?._id,
  });

  const review = useApiMutation((status: 'Approved' | 'Rejected') => reviewLeave(leave._id, status), {
    invalidate: [opsKeys.leavesAll(), opsKeys.leaveBalance(employee?._id ?? ''), keys.dashboard(), opsKeys.attendanceAll()],
    onSuccess: (res) => {
      queryClient.setQueryData(opsKeys.leaveDetail(leave._id), { success: true, leave: { ...leave, ...res.leave, employeeId: leave.employeeId } });
    },
  });

  const decide = async (status: 'Approved' | 'Rejected') => {
    const approve = status === 'Approved';
    const ok = await confirm({
      title: approve ? 'Approve leave?' : 'Reject leave?',
      message: `${name}: ${leave.leaveType}, ${formatDate(start)} – ${formatDate(end)} (${pluralize(leave.days ?? 0, 'working day')}). ${
        approve ? 'The days count against the employee’s leave balance.' : 'The employee will be notified.'
      }`,
      confirmLabel: approve ? 'Approve' : 'Reject',
      destructive: !approve,
    });
    if (!ok) return;
    try {
      await review.mutateAsync(status);
      toast.success(approve ? 'Leave approved.' : 'Leave rejected.');
    } catch (e) {
      handleReviewError(e, async () => {
        await Promise.all([onRefetch(), queryClient.invalidateQueries({ queryKey: opsKeys.leavesAll() })]);
      });
    }
  };

  const bucket = leave.leaveType === 'Sick Leave' ? balance.data?.sick : leave.leaveType === 'Casual Leave' ? balance.data?.casual : undefined;
  const exceeds = isPending && bucket !== undefined && (leave.days ?? 0) > bucket.balance;

  return (
    <View style={{ gap: theme.spacing.md }}>
      <Card>
        <View style={[styles.row, { gap: theme.spacing.lg }]}>
          <Avatar uri={employee?.userId?.profileImage} name={name} id={employee?._id} size={56} />
          <View style={styles.flex}>
            <AppText variant="title">{name}</AppText>
            <AppText variant="secondary">
              {employeeCode(employee)} · {departmentName(employee)}
            </AppText>
            {employee?.designation ? <AppText variant="secondary">{employee.designation}</AppText> : null}
          </View>
        </View>
        <StatusPill status={leave.status} accessibilityPrefix="Leave status" />
      </Card>

      <Card>
        <DetailRow label="Leave type" value={leave.leaveType} />
        <DetailRow label="From" value={formatDateLong(start)} />
        <DetailRow label="To" value={formatDateLong(end)} />
        <DetailRow label="Working days" value={pluralize(leave.days ?? 0, 'day')} />
        <DetailRow label="Reason" value={leave.reason || ''} placeholder="No reason given" />
        <DetailRow label="Email" value={employee?.userId?.email ?? ''} />
        <DetailRow label="Applied on" value={leave.createdAt ? formatDateTime(leave.createdAt) : ''} />
        {leave.reviewedAt ? <DetailRow label="Reviewed on" value={formatDateTime(leave.reviewedAt)} /> : null}
        {leave.cancelledAt ? <DetailRow label="Cancelled on" value={formatDateTime(leave.cancelledAt)} /> : null}
      </Card>

      <SectionHeader
        title="Leave balance"
        subtitle={
          balance.data?.period?.start ? `${formatDate(balance.data.period.start)} – ${formatDate(balance.data.period.end)}` : undefined
        }
      />
      {balance.isPending && balance.fetchStatus !== 'idle' ? (
        <LoadingState label="Loading balance" />
      ) : balance.data ? (
        <Card>
          {(
            [
              ['Casual Leave', balance.data.casual],
              ['Sick Leave', balance.data.sick],
              ['Total', balance.data.total],
            ] as const
          ).map(([label, b]) =>
            b ? (
              <DetailRow key={label} label={label} value={`${b.balance} of ${b.total} days left (${b.used} used)`} />
            ) : null,
          )}
        </Card>
      ) : balance.isError ? (
        <InlineNotice tone="warning" message="The leave balance couldn't be loaded." />
      ) : null}

      {exceeds && bucket ? (
        <InlineNotice
          tone="warning"
          icon="warning-outline"
          message={`This request (${pluralize(leave.days, 'day')}) is more than the remaining ${leave.leaveType} balance (${pluralize(bucket.balance, 'day')}). The server reports this but does not block approval.`}
        />
      ) : null}

      {isPending ? (
        <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.sm }}>
          {!canWrite ? <InlineNotice tone="warning" message="You are offline. Reviews are available when you reconnect." /> : null}
          <Button label="Approve leave" icon="checkmark-circle-outline" onPress={() => decide('Approved')} disabled={!canWrite} testID="leave-approve" />
          <Button label="Reject leave" icon="close-circle-outline" variant="destructive" onPress={() => decide('Rejected')} disabled={!canWrite} testID="leave-reject" />
        </View>
      ) : (
        <InlineNotice message={`This request is ${leave.status}. No further action is needed.`} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1, gap: 2 },
});
