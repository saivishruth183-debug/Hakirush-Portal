/**
 * Query keys. EVERY key starts with ['u', userId] so cached data can never leak across
 * accounts (logout also calls queryClient.clear(), this is defence in depth).
 *
 * Directory data (team, birthdays, anniversaries, new joiners, department colleagues) is ALSO
 * scoped by department: ['u', userId, 'dept', departmentId|'none', ...]. When the server reports a
 * new department, SessionProvider removes the old department's queries (see cacheScope.ts).
 * While `useSession().directoryVerified` is false (offlineUnverified), do not render directory data.
 *
 * Usage in a component:
 *   const keys = useQueryKeys();               // bound to the signed-in user
 *   useQuery({ queryKey: keys.team({ search }), queryFn: ({ signal }) => api.get(..., { signal }) });
 *   queryClient.invalidateQueries({ queryKey: keys.leaves() }); // prefix match → all leave lists
 *
 * Add new domains here (one line each) rather than inventing ad-hoc arrays in features.
 * Filters/params objects go LAST so `keys.x()` (no params) works as an invalidation prefix.
 */
import { directoryScopeKey } from './cacheScope';
import { useSession } from './session';

type Params = Record<string, unknown> | undefined;

/** Normalise params so `{}` / undefined produce the same key and the prefix stays clean. */
function withParams<T extends readonly unknown[]>(base: T, params?: Params): readonly unknown[] {
  if (!params) return base;
  const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== ''));
  return Object.keys(clean).length ? [...base, clean] : base;
}

export function createQueryKeys(userId: string, departmentId?: string | null) {
  const u = ['u', userId] as const;
  const dept = directoryScopeKey(userId, departmentId);
  return {
    /** Everything for this user (prefix). */
    all: () => u,
    session: () => [...u, 'session'] as const,

    // ----- employee self-service -----
    myEmployee: () => [...u, 'employee', 'me'] as const,
    /** Prefix of all department-scoped directory data for this user + department. */
    directory: () => dept,
    team: (params?: { search?: string; page?: number; limit?: number }) => withParams([...dept, 'team'] as const, params),
    departmentColleagues: () => [...dept, 'colleagues'] as const,
    attendanceToday: () => [...u, 'attendance', 'today'] as const,
    attendanceMonth: (month: string) => [...u, 'attendance', 'month', month] as const,
    attendanceRequests: (params?: Params) => withParams([...u, 'attendance-requests'] as const, params),
    leaves: (params?: Params) => withParams([...u, 'leaves'] as const, params),
    leave: (leaveId: string) => [...u, 'leave', leaveId] as const,
    leaveBalance: (employeeRecordId?: string) => withParams([...u, 'leave-balance'] as const, { employeeRecordId }),
    payslips: (params?: Params) => withParams([...u, 'payslips'] as const, params),
    payslip: (payslipId: string) => [...u, 'payslip', payslipId] as const,
    expenses: (params?: Params) => withParams([...u, 'expenses'] as const, params),
    overtimeSummary: () => [...u, 'overtime-summary'] as const,
    myAssets: () => [...u, 'my-assets'] as const,
    birthdays: () => [...dept, 'birthdays'] as const,
    anniversaries: () => [...dept, 'anniversaries'] as const,
    newJoiners: () => [...dept, 'new-joiners'] as const,

    // ----- shared -----
    holidays: (scope: 'upcoming' | 'all' = 'upcoming') => [...u, 'holidays', scope] as const,
    announcements: (params?: Params) => withParams([...u, 'announcements'] as const, params),
    announcement: (id: string) => [...u, 'announcement', id] as const,
    notifications: () => [...u, 'notifications'] as const,

    // ----- admin -----
    dashboard: () => [...u, 'dashboard'] as const,
    employees: (params?: Params) => withParams([...u, 'employees'] as const, params),
    employee: (employeeRecordId: string) => [...u, 'employee', employeeRecordId] as const,
    departments: () => [...u, 'departments'] as const,
    department: (departmentId: string) => [...u, 'department', departmentId] as const,
    eligibleManagers: (departmentId: string) => [...u, 'department', departmentId, 'eligible-managers'] as const,
    attendanceAdmin: (params?: Params) => withParams([...u, 'attendance-admin'] as const, params),
    clients: (params?: Params) => withParams([...u, 'clients'] as const, params),
    client: (clientId: string) => [...u, 'client', clientId] as const,
    sponsors: () => [...u, 'sponsors'] as const,
    stalls: () => [...u, 'stalls'] as const,

    // ----- client self-service -----
    myClient: () => [...u, 'client', 'me'] as const,
    roster: () => [...u, 'client', 'me', 'roster'] as const,
    gallery: (clientId?: string) => withParams([...u, 'gallery'] as const, { clientId }),
    performance: (clientId?: string) => withParams([...u, 'performance'] as const, { clientId }),
  };
}

export type QueryKeys = ReturnType<typeof createQueryKeys>;

/**
 * Keys bound to the current user. Throws if called while signed out — protected screens
 * only render inside an authenticated role layout, so this is a programming error.
 */
export function useQueryKeys(): QueryKeys {
  const { user } = useSession();
  if (!user) throw new Error('useQueryKeys() requires a signed-in user');
  return createQueryKeys(user._id, user.departmentId);
}
