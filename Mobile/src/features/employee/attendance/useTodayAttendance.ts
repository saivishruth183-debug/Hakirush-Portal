import { useIsMutating, useMutation, useQueryClient } from '@tanstack/react-query';
import { useFocusEffect } from 'expo-router';
import { useCallback, useSyncExternalStore } from 'react';

import { confirm, toast } from '@/components';
import { api, ApiError, createIdempotencyKey, getErrorMessage, isApiError } from '@/services/api';
import { useApiQuery } from '@/services/hooks';
import { useQueryKeys } from '@/services/queryKeys';
import { useSession } from '@/services/session';
import type { AttendanceAction, AttendanceTransitionResponse, TodayAttendanceResponse } from '@/types/api';
import { attendancePhase, type AttendancePhase } from '@/utils/attendanceTimer';

/** Actions offered per phase (same state machine on Home and the Attendance tab). */
export function actionsForPhase(phase: AttendancePhase): AttendanceAction[] {
  switch (phase) {
    case 'notStarted':
      return ['check-in'];
    case 'working':
      return ['pause', 'check-out'];
    case 'paused':
      return ['resume', 'check-out'];
    default:
      return [];
  }
}

export const ACTION_LABELS: Record<AttendanceAction, string> = {
  'check-in': 'Check in',
  pause: 'Pause',
  resume: 'Resume',
  'check-out': 'Check out',
};

const DONE: Record<AttendanceAction, string> = {
  'check-in': 'Checked in.',
  pause: 'Paused. Resume when you are back.',
  resume: 'Resumed.',
  'check-out': 'Checked out for today.',
};

/** After a 409 or an uncertain failure, writes stay blocked until today/me is refetched successfully. */
let blockedSince: number | null = null;
const listeners = new Set<() => void>();
const reconcileStore = {
  subscribe: (l: () => void) => {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  get: () => blockedSince,
  set: (v: number | null) => {
    blockedSince = v;
    listeners.forEach((l) => l());
  },
};

export function useTodayAttendance() {
  const keys = useQueryKeys();
  const queryClient = useQueryClient();
  const { canWrite } = useSession();
  const query = useApiQuery<TodayAttendanceResponse>(keys.attendanceToday(), '/api/attendance/today/me', { staleTime: 0 });
  const mutationKey = [...keys.attendanceToday(), 'transition'];
  const mutating = useIsMutating({ mutationKey }) > 0;
  const blocked = useSyncExternalStore(reconcileStore.subscribe, reconcileStore.get, reconcileStore.get);
  const reconciling = blocked !== null && !(query.dataUpdatedAt > blocked && !query.isError);

  const mutation = useMutation({
    mutationKey,
    retry: false,
    mutationFn: ({ action, key }: { action: AttendanceAction; key: string }) => {
      if (!canWrite) throw new ApiError({ kind: 'network', message: 'You are offline.' });
      return api.post<AttendanceTransitionResponse & { businessDate?: string; timezone?: string }>(
        `/api/attendance/${action}`,
        undefined,
        { idempotencyKey: key },
      );
    },
  });

  const { refetch } = query;
  // Reconcile with the server whenever the screen gains focus (timer is derived from server data).
  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch]),
  );

  const run = async (action: AttendanceAction) => {
    if (!canWrite || mutating || reconciling) return;
    if (action === 'check-out') {
      const ok = await confirm({
        title: 'Check out for today?',
        message: "Your worked time stops now. You can't check in again today.",
        confirmLabel: 'Check out',
      });
      if (!ok) return;
    }
    const key = createIdempotencyKey(); // one key per user tap; never replayed automatically
    try {
      const res = await mutation.mutateAsync({ action, key });
      const prev = queryClient.getQueryData<TodayAttendanceResponse>(keys.attendanceToday());
      queryClient.setQueryData<TodayAttendanceResponse>(keys.attendanceToday(), {
        success: true,
        attendance: res.attendance,
        serverTime: res.serverTime,
        businessDate: res.businessDate ?? prev?.businessDate ?? '',
        timezone: res.timezone ?? prev?.timezone ?? 'Asia/Kolkata',
      });
      void queryClient.invalidateQueries({ queryKey: [...keys.all(), 'attendance', 'month'] });
      toast.success(DONE[action]);
    } catch (e) {
      if (isApiError(e) && e.kind === 'cancelled') return;
      const invalid = isApiError(e) && e.status === 409;
      const uncertain = !isApiError(e) || e.kind === 'network' || e.kind === 'timeout' || (e.status ?? 0) >= 500;
      if (invalid || uncertain) {
        reconcileStore.set(Date.now());
        toast.info(
          invalid
            ? 'Your attendance changed elsewhere. Showing the latest status.'
            : "We couldn't confirm that change. Checking your latest attendance before you try again.",
        );
        await refetch();
      } else {
        toast.error(getErrorMessage(e));
      }
    }
  };

  const recheck = async () => {
    await refetch();
  };

  const data = query.data;
  const phase = attendancePhase(data?.attendance);
  return {
    query,
    data,
    phase,
    actions: actionsForPhase(phase),
    run,
    recheck,
    busyAction: mutating ? (mutation.variables?.action ?? null) : null,
    mutating,
    reconciling,
    canWrite,
  };
}
