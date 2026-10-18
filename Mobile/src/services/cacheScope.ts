import type { QueryClient } from '@tanstack/react-query';

import type { SessionUser } from '@/types/api';

/**
 * Directory data (team, birthdays, anniversaries, new joiners, department colleagues) is
 * scoped by user AND department: ['u', userId, 'dept', departmentId | 'none', ...].
 */
export function directoryScopeKey(userId: string, departmentId: string | null | undefined) {
  return ['u', userId, 'dept', departmentId || 'none'] as const;
}

export type UserChange = 'none' | 'department' | 'identity';

export function classifyUserChange(prev: SessionUser | null, next: SessionUser | null): UserChange {
  if (!prev || !next) return 'none';
  if (prev._id !== next._id || prev.role !== next.role) return 'identity';
  if ((prev.departmentId || null) !== (next.departmentId || null)) return 'department';
  return 'none';
}

/**
 * Call BEFORE exposing a new SessionUser from the server:
 * - different user/role → cancel everything and clear the whole cache;
 * - different department → cancel + REMOVE (not invalidate) the old department's directory
 *   queries so stale colleagues are never rendered, and refetch the own profile.
 */
export async function reconcileUserChange(
  queryClient: QueryClient,
  prev: SessionUser | null,
  next: SessionUser | null,
): Promise<UserChange> {
  const change = classifyUserChange(prev, next);
  if (change === 'identity') {
    await queryClient.cancelQueries();
    queryClient.clear();
  } else if (change === 'department' && prev) {
    const oldScope = directoryScopeKey(prev._id, prev.departmentId);
    await queryClient.cancelQueries({ queryKey: oldScope });
    queryClient.removeQueries({ queryKey: oldScope });
    void queryClient.invalidateQueries({ queryKey: ['u', prev._id, 'employee', 'me'] });
  }
  return change;
}
