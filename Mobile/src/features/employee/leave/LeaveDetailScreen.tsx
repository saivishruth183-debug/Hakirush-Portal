import { Stack, useLocalSearchParams } from 'expo-router';

import { Button, Card, confirm, DetailRow, QueryStateView, Screen, StatusPill, toast } from '@/components';
import { api, getErrorMessage, isApiError } from '@/services/api';
import { useApiMutation, useApiQuery } from '@/services/hooks';
import { useQueryKeys } from '@/services/queryKeys';
import { useSession } from '@/services/session';
import type { Leave } from '@/types/api';
import { businessDate, formatDate, formatDateTime } from '@/utils/format';

import { ymdOf } from '../format';

/** Server rule: Pending, or Approved whose start date is after today. */
export function canCancelLeave(l: Pick<Leave, 'status' | 'startDate'>, today: string): boolean {
  return l.status === 'Pending' || (l.status === 'Approved' && ymdOf(l.startDate) > today);
}

export function LeaveDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const keys = useQueryKeys();
  const { canWrite } = useSession();
  const q = useApiQuery<{ leave: Leave }>(keys.leave(String(id)), `/api/leave/detail/${id}`);
  const cancel = useApiMutation(() => api.put<{ leave: Leave }>(`/api/leave/cancel/${id}`), {
    invalidate: [keys.leaves(), keys.leave(String(id)), keys.leaveBalance()],
  });

  const onCancel = async (leave: Leave) => {
    const ok = await confirm({
      title: 'Cancel this leave?',
      message: `${leave.leaveType}, ${formatDate(leave.startDate)} to ${formatDate(leave.endDate)}.`,
      confirmLabel: 'Cancel leave',
      cancelLabel: 'Keep',
      destructive: true,
    });
    if (!ok) return;
    try {
      await cancel.mutateAsync(undefined);
      toast.success('Leave cancelled.');
    } catch (e) {
      if (isApiError(e) && e.kind === 'cancelled') return;
      toast.error(getErrorMessage(e));
      void q.refetch();
    }
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Leave details' }} />
      <QueryStateView query={q} errorTitle="Couldn't load this leave">
        {({ leave }) => (
          <Card>
            <StatusPill status={leave.status} accessibilityPrefix="Leave status" />
            <DetailRow label="Type" value={leave.leaveType} />
            <DetailRow label="From" value={formatDate(leave.startDate)} />
            <DetailRow label="To" value={formatDate(leave.endDate)} />
            <DetailRow label="Working days" value={leave.days} />
            <DetailRow label="Reason" value={leave.reason} />
            <DetailRow label="Applied" value={leave.createdAt ? formatDateTime(leave.createdAt) : ''} />
            {canCancelLeave(leave, businessDate()) ? (
              <Button label="Cancel leave" variant="destructive" disabled={!canWrite} onPress={() => onCancel(leave)} />
            ) : null}
          </Card>
        )}
      </QueryStateView>
    </Screen>
  );
}
