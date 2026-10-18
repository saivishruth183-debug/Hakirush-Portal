import { QueryClient } from '@tanstack/react-query';

import { classifyUserChange, reconcileUserChange } from '@/services/cacheScope';
import { createQueryKeys } from '@/services/queryKeys';
import { shouldRetry } from '@/services/queryClient';
import { ApiError } from '@/services/api/errors';
import type { SessionUser } from '@/types/api';

const base: SessionUser = { _id: 'u1', name: 'Asha', email: '', role: 'employee', departmentId: 'dep-1' };

describe('query keys', () => {
  it('always start with the user id; directory keys also include the department', () => {
    const k = createQueryKeys('u1', 'dep-1');
    expect(k.leaves()).toEqual(['u', 'u1', 'leaves']);
    expect(k.team({ search: 'ra' })).toEqual(['u', 'u1', 'dept', 'dep-1', 'team', { search: 'ra' }]);
    expect(k.team()).toEqual(['u', 'u1', 'dept', 'dep-1', 'team']);
    expect(k.birthdays()).toEqual(['u', 'u1', 'dept', 'dep-1', 'birthdays']);
    expect(createQueryKeys('u1', null).team()).toEqual(['u', 'u1', 'dept', 'none', 'team']);
  });
});

describe('reconcileUserChange', () => {
  function seed(qc: QueryClient) {
    const k = createQueryKeys('u1', 'dep-1');
    qc.setQueryData(k.team(), { members: ['old colleague'] });
    qc.setQueryData(k.birthdays(), ['old dept birthday']);
    qc.setQueryData(k.leaves(), ['my leave']);
    return k;
  }

  it('department change REMOVES the old department directory queries and keeps personal data', async () => {
    const qc = new QueryClient();
    const k = seed(qc);
    const change = await reconcileUserChange(qc, base, { ...base, departmentId: 'dep-2' });
    expect(change).toBe('department');
    expect(qc.getQueryCache().find({ queryKey: k.team() })).toBeUndefined();
    expect(qc.getQueryCache().find({ queryKey: k.birthdays() })).toBeUndefined();
    expect(qc.getQueryData(k.leaves())).toEqual(['my leave']);
    qc.clear();
  });

  it('different user or role clears everything; same department changes nothing', async () => {
    const qc = new QueryClient();
    const k = seed(qc);
    expect(await reconcileUserChange(qc, base, { ...base })).toBe('none');
    expect(qc.getQueryData(k.team())).toBeDefined();
    expect(classifyUserChange(base, { ...base, role: 'admin' })).toBe('identity');
    expect(await reconcileUserChange(qc, base, { ...base, _id: 'u2' })).toBe('identity');
    expect(qc.getQueryCache().getAll()).toHaveLength(0);
    qc.clear();
  });
});

describe('query retry policy', () => {
  it('never retries 4xx/config/cancelled, retries transient errors twice', () => {
    expect(shouldRetry(0, new ApiError({ kind: 'http', status: 404, message: '' }))).toBe(false);
    expect(shouldRetry(0, new ApiError({ kind: 'config', message: '' }))).toBe(false);
    expect(shouldRetry(0, new ApiError({ kind: 'cancelled', message: '' }))).toBe(false);
    expect(shouldRetry(0, new ApiError({ kind: 'http', status: 503, message: '' }))).toBe(true);
    expect(shouldRetry(1, new ApiError({ kind: 'network', message: '' }))).toBe(true);
    expect(shouldRetry(2, new ApiError({ kind: 'network', message: '' }))).toBe(false);
  });
});
