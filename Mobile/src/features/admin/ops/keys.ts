/**
 * Feature-local query keys for the admin operations screens. Every key is derived from the
 * shared factory (src/services/queryKeys.ts), so it is user-scoped and the shared prefixes
 * (`keys.attendanceAdmin()`, `keys.leaves()`, ...) still invalidate everything below them.
 */
import { useQueryKeys, type QueryKeys } from '@/services/queryKeys';

export function createAdminOpsKeys(keys: QueryKeys) {
  return {
    dashboardSummary: () => [...keys.dashboard(), 'summary'] as const,

    /** Prefix of every admin attendance view (today list, summary, monthly, report). */
    attendanceAll: () => keys.attendanceAdmin(),
    attendanceToday: () => keys.attendanceAdmin({ view: 'today' }),
    attendanceSummary: () => keys.attendanceAdmin({ view: 'summary' }),
    attendanceMonthly: (employeeId: string, month: string) => keys.attendanceAdmin({ view: 'monthly', employeeId, month }),
    attendanceReport: (params: Record<string, string | undefined>) => keys.attendanceAdmin({ view: 'report', ...params }),

    /** Prefix of all leave lists/details. */
    leavesAll: () => keys.leaves(),
    leaveList: (status: string) => keys.leaves({ scope: 'admin', status }),
    leavePendingCount: () => keys.leaves({ scope: 'admin', count: 'Pending' }),
    leaveDetail: (leaveId: string) => keys.leave(leaveId),
    leaveBalance: (employeeRecordId: string) => keys.leaveBalance(employeeRecordId),

    /** Prefix of all correction-request lists. */
    correctionsAll: () => keys.attendanceRequests(),
    correctionList: (status: string) => keys.attendanceRequests({ scope: 'admin', status }),
    correctionsForEmployee: (employeeId: string) => keys.attendanceRequests({ scope: 'admin', employeeId }),
    correctionsPendingCount: () => keys.attendanceRequests({ scope: 'admin', count: 'Pending' }),

    holidays: () => keys.holidays('all'),

    announcements: () => keys.announcements({ scope: 'admin' }),
    announcementsAll: () => keys.announcements(),
    announcement: (id: string) => keys.announcement(id),

    notificationsAll: () => keys.notifications(),
    notificationList: () => [...keys.notifications(), 'list'] as const,
    notificationBadge: () => [...keys.notifications(), 'badge'] as const,
  };
}

export type AdminOpsKeys = ReturnType<typeof createAdminOpsKeys>;

export function useAdminOpsKeys(): AdminOpsKeys {
  return createAdminOpsKeys(useQueryKeys());
}
