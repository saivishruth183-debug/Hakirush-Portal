import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { api } from '@/services/api';
import { useAdminOpsKeys } from '@/features/admin/ops/keys';
import { fetchCorrectionPage, fetchLeavePage } from '@/features/admin/ops/api';
import type { CorrectionsResponse, LeaveListResponse, PagedFields } from '@/features/admin/ops/types';

const nextPage = (last: PagedFields) => (last.hasMore && last.page ? last.page + 1 : undefined);

/** GET /api/leave?status&page&limit (newest first), infinite. */
export function useLeaveList(status: string) {
  const keys = useAdminOpsKeys();
  return useInfiniteQuery({
    queryKey: keys.leaveList(status),
    queryFn: ({ pageParam, signal }) => fetchLeavePage(status, pageParam, signal),
    initialPageParam: 1,
    getNextPageParam: nextPage,
  });
}

/** GET /api/attendance-request?status&page&limit (newest first), infinite. */
export function useCorrectionList(status: string) {
  const keys = useAdminOpsKeys();
  return useInfiniteQuery({
    queryKey: keys.correctionList(status),
    queryFn: ({ pageParam, signal }) => fetchCorrectionPage(status, pageParam, signal),
    initialPageParam: 1,
    getNextPageParam: nextPage,
  });
}

/** Pending counts (page of 1, the server returns `total`). Used by Requests, Attendance and Home. */
export function usePendingCounts(options: { refetchInterval?: number | false } = {}) {
  const keys = useAdminOpsKeys();
  const leaves = useQuery({
    queryKey: keys.leavePendingCount(),
    queryFn: ({ signal }) =>
      api.get<LeaveListResponse>('/api/leave', { query: { status: 'Pending', page: 1, limit: 1 }, signal }),
    select: (d) => d.total ?? d.leaves.length,
    refetchInterval: options.refetchInterval,
  });
  const corrections = useQuery({
    queryKey: keys.correctionsPendingCount(),
    queryFn: ({ signal }) =>
      api.get<CorrectionsResponse>('/api/attendance-request', { query: { status: 'Pending', page: 1, limit: 1 }, signal }),
    select: (d) => d.total ?? d.requests.length,
    refetchInterval: options.refetchInterval,
  });
  return { leaves, corrections };
}
