/**
 * Thin react-query helpers bound to the API client.
 *
 *   const keys = useQueryKeys();
 *   const q = useApiQuery<TeamResponse>(keys.team({ search }), '/api/employee/team/me', { query: { search } });
 *
 *   const m = useApiMutation((body: LeaveInput) => api.post<{ leave: Leave }>('/api/leave/add', body), {
 *     invalidate: [keys.leaves(), keys.leaveBalance()],
 *   });
 */
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryKey,
  type UseMutationResult,
  type UseQueryOptions,
  type UseQueryResult,
} from '@tanstack/react-query';

import { api, type QueryParams } from './api/client';
import { ApiError } from './api/errors';
import { useSession } from './session';

export interface ApiQueryOptions<T, TSelected = T>
  extends Omit<UseQueryOptions<T, Error, TSelected, QueryKey>, 'queryKey' | 'queryFn'> {
  query?: QueryParams;
}

/** GET `path` with react-query; the request is cancelled when the query is (signal passed through). */
export function useApiQuery<T, TSelected = T>(
  queryKey: QueryKey,
  path: string,
  options: ApiQueryOptions<T, TSelected> = {},
): UseQueryResult<TSelected, Error> {
  const { query, ...rest } = options;
  return useQuery<T, Error, TSelected, QueryKey>({
    queryKey,
    queryFn: ({ signal }) => api.get<T>(path, { query, signal }),
    ...rest,
  });
}

export interface ApiMutationOptions<TResult> {
  /** Query keys (prefixes) to invalidate after success. */
  invalidate?: QueryKey[];
  onSuccess?: (result: TResult) => unknown;
}

/**
 * useMutation that refuses to run while the session is not verified (canWrite=false),
 * never retries, and invalidates the given keys on success.
 */
export function useApiMutation<TVars, TResult>(
  mutationFn: (vars: TVars) => Promise<TResult>,
  options: ApiMutationOptions<TResult> = {},
): UseMutationResult<TResult, Error, TVars> {
  const queryClient = useQueryClient();
  const { canWrite } = useSession();
  return useMutation<TResult, Error, TVars>({
    mutationFn: async (vars) => {
      if (!canWrite) {
        throw new ApiError({ kind: 'network', message: 'You are offline. Changes are paused until you reconnect.' });
      }
      return mutationFn(vars);
    },
    retry: false,
    onSuccess: async (result) => {
      await Promise.all((options.invalidate ?? []).map((queryKey) => queryClient.invalidateQueries({ queryKey })));
      await options.onSuccess?.(result);
    },
  });
}
