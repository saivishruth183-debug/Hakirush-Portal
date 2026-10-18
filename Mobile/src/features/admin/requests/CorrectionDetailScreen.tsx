import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, Avatar, Button, Card, confirm, DetailRow, QueryStateView, Screen, StatusPill, TextField, toast } from '@/components';
import { reviewCorrection } from '@/features/admin/ops/api';
import { InlineNotice } from '@/features/admin/ops/components';
import { departmentName, employeeCode, employeeName } from '@/features/admin/ops/format';
import { useAdminOpsKeys } from '@/features/admin/ops/keys';
import type { CorrectionRequest, CorrectionsResponse } from '@/features/admin/ops/types';
import { api, ApiError } from '@/services/api';
import { useApiMutation } from '@/services/hooks';
import { useQueryKeys } from '@/services/queryKeys';
import { useSession } from '@/services/session';
import { useTheme } from '@/theme';
import { formatDateLong, formatDateTime } from '@/utils/format';

import { handleReviewError } from './reviewErrors';

const REMARKS_MAX = 500;

/** Finds a request in any cached admin correction list (infinite pages or plain lists). */
function findCached(queryClient: QueryClient, prefix: readonly unknown[], id: string): CorrectionRequest | undefined {
  for (const [, data] of queryClient.getQueriesData<unknown>({ queryKey: prefix })) {
    const pages = (data as { pages?: CorrectionsResponse[] } | undefined)?.pages;
    const lists = pages ?? [data as CorrectionsResponse | undefined];
    for (const list of lists) {
      const hit = list?.requests?.find?.((r) => r._id === id);
      if (hit) return hit;
    }
  }
  return undefined;
}

/**
 * /admin/corrections/[id]?employeeId= — one attendance-correction request with remarks + review.
 * There is no GET-by-id endpoint, so the request is read from the employee's list
 * (GET /api/attendance-request?employeeId=) or, without employeeId, from the full list.
 */
export function CorrectionDetailScreen() {
  const params = useLocalSearchParams<{ id: string; employeeId?: string }>();
  const id = String(params.id ?? '');
  const employeeId = params.employeeId ? String(params.employeeId) : undefined;
  const keys = useQueryKeys();
  const opsKeys = useAdminOpsKeys();
  const queryClient = useQueryClient();
  const cached = findCached(queryClient, opsKeys.correctionsAll(), id);

  const query = useQuery({
    queryKey: keys.attendanceRequests({ scope: 'admin', requestId: id }),
    queryFn: async ({ signal }) => {
      const res = await api.get<CorrectionsResponse>('/api/attendance-request', { query: employeeId ? { employeeId } : undefined, signal });
      const found = res.requests.find((r) => r._id === id);
      if (!found) throw new ApiError({ kind: 'http', status: 404, message: 'This correction request no longer exists.' });
      return found;
    },
    placeholderData: cached,
    enabled: !!id,
  });

  return (
    <Screen keyboardAvoiding refreshing={query.isRefetching && !query.isPlaceholderData} onRefresh={() => void query.refetch()}>
      <Stack.Screen options={{ title: 'Correction request' }} />
      <QueryStateView query={query} errorTitle="Couldn't load this request">
        {(request) => <CorrectionReview request={request} onRefetch={() => query.refetch()} />}
      </QueryStateView>
    </Screen>
  );
}

export function CorrectionReview({ request, onRefetch }: { request: CorrectionRequest; onRefetch: () => unknown }) {
  const theme = useTheme();
  const { canWrite, user } = useSession();
  const keys = useQueryKeys();
  const opsKeys = useAdminOpsKeys();
  const queryClient = useQueryClient();
  const [remarks, setRemarks] = useState('');
  const employee = request.employeeId;
  const name = employeeName(employee);
  const isPending = request.status === 'Pending';

  const review = useApiMutation(
    (decision: 'Approved' | 'Rejected') => reviewCorrection(request._id, decision, remarks),
    {
      invalidate: [opsKeys.correctionsAll(), opsKeys.attendanceAll(), keys.dashboard()],
      onSuccess: (res) => {
        queryClient.setQueryData(keys.attendanceRequests({ scope: 'admin', requestId: request._id }), {
          ...request,
          ...res.request,
          employeeId: request.employeeId,
        });
      },
    },
  );

  const decide = async (decision: 'Approved' | 'Rejected') => {
    const approve = decision === 'Approved';
    const ok = await confirm({
      title: approve ? 'Approve correction?' : 'Reject correction?',
      message: `${name}, ${formatDateLong(request.date)}: ${request.currentStatus} → ${request.requestedStatus}.${
        approve ? ` The day will be recorded as ${request.requestedStatus}.` : ''
      }${remarks.trim() ? `\nRemarks: ${remarks.trim()}` : ''}`,
      confirmLabel: approve ? 'Approve' : 'Reject',
      destructive: !approve,
    });
    if (!ok) return;
    try {
      await review.mutateAsync(decision);
      toast.success(approve ? 'Correction approved.' : 'Correction rejected.');
    } catch (e) {
      handleReviewError(e, async () => {
        await Promise.all([onRefetch(), queryClient.invalidateQueries({ queryKey: opsKeys.correctionsAll() })]);
      });
    }
  };

  const reviewer = request.reviewedBy ? (request.reviewedBy === user?._id ? 'You' : 'Another admin') : '';

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
          </View>
        </View>
        <StatusPill status={request.status} accessibilityPrefix="Request status" />
      </Card>
      <Card>
        <DetailRow label="Date" value={formatDateLong(request.date)} />
        <DetailRow label="Current status" value={request.currentStatus} />
        <DetailRow label="Requested status" value={request.requestedStatus} />
        <DetailRow label="Reason" value={request.reason} />
        <DetailRow label="Submitted" value={request.createdAt ? formatDateTime(request.createdAt) : ''} />
        {!isPending ? (
          <>
            <DetailRow label="Reviewed by" value={reviewer} />
            <DetailRow label="Reviewed on" value={request.reviewedAt ? formatDateTime(request.reviewedAt) : ''} />
            <DetailRow label="Remarks" value={request.reviewRemarks ?? ''} placeholder="No remarks" />
          </>
        ) : null}
      </Card>

      {isPending ? (
        <View style={{ gap: theme.spacing.md }}>
          <TextField
            label="Remarks for the employee"
            value={remarks}
            onChangeText={setRemarks}
            multiline
            maxLength={REMARKS_MAX}
            helper={`Optional. ${remarks.length}/${REMARKS_MAX} characters.`}
            disabled={!canWrite}
            testID="correction-remarks"
          />
          {!canWrite ? <InlineNotice tone="warning" message="You are offline. Reviews are available when you reconnect." /> : null}
          <Button label="Approve correction" icon="checkmark-circle-outline" onPress={() => decide('Approved')} disabled={!canWrite} testID="correction-approve" />
          <Button
            label="Reject correction"
            icon="close-circle-outline"
            variant="destructive"
            onPress={() => decide('Rejected')}
            disabled={!canWrite}
            testID="correction-reject"
          />
        </View>
      ) : (
        <InlineNotice message={`This request was ${request.status.toLowerCase()}. No further action is needed.`} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1, gap: 2 },
});
