import { act, screen, waitFor } from '@testing-library/react-native';
import { useEffect } from 'react';
import { Text } from 'react-native';

import { createQueryKeys } from '@/services/queryKeys';
import { useSession, type SessionContextValue } from '@/services/session';
import { SESSION_STORAGE_KEYS, toSnapshot } from '@/services/session/storage';
import { authResponse, jsonResponse, mockFetch } from '@/testing/fetchMock';
import { renderWithProviders } from '@/testing/renderWithProviders';
import { resetAuthWorld, secureStore } from '@/testing/resetSession';

const probe: { session: SessionContextValue | null } = { session: null };
function Probe() {
  const s = useSession();
  useEffect(() => {
    probe.session = s;
  });
  return (
    <Text testID="probe">
      {s.status}|{s.user?.departmentId ?? '-'}|{String(s.directoryVerified)}
    </Text>
  );
}
/** Latest session value captured by <Probe/>. */
const sessionNow = (): SessionContextValue => {
  if (!probe.session) throw new Error('Probe not rendered');
  return probe.session;
};

beforeEach(() => resetAuthWorld());

describe('SessionProvider', () => {
  it('department change from the server removes the old department directory cache before exposing the user', async () => {
    secureStore().set(SESSION_STORAGE_KEYS.refreshToken, 'refresh-0');
    secureStore().set(
      SESSION_STORAGE_KEYS.snapshot,
      JSON.stringify(toSnapshot({ _id: 'user-a', name: 'Asha', email: '', role: 'employee', departmentId: 'dep-1' })),
    );
    let department = 'dep-1';
    mockFetch((call) => {
      if (call.path === '/api/auth/mobile/refresh') return jsonResponse(200, authResponse('1', { departmentId: department }));
      if (call.path === '/api/auth/verify') {
        return jsonResponse(200, { success: true, user: { ...authResponse('x').user, departmentId: department } });
      }
      return jsonResponse(404, {});
    });
    const { queryClient } = await renderWithProviders(<Probe />);
    await waitFor(() => expect(screen.getByTestId('probe').props.children.join('')).toBe('authenticated|dep-1|true'));

    const oldKeys = createQueryKeys('user-a', 'dep-1');
    queryClient.setQueryData(oldKeys.team(), { members: ['old colleague'] });
    queryClient.setQueryData(oldKeys.leaves(), ['mine']);

    department = 'dep-2';
    await act(async () => {
      await sessionNow().refreshUser();
    });
    expect(screen.getByTestId('probe').props.children.join('')).toBe('authenticated|dep-2|true');
    expect(queryClient.getQueryCache().find({ queryKey: oldKeys.team() })).toBeUndefined();
    expect(queryClient.getQueryData(oldKeys.leaves())).toEqual(['mine']);
  });

  it('offlineUnverified: cached role shell, writes and directory blocked, token kept', async () => {
    secureStore().set(SESSION_STORAGE_KEYS.refreshToken, 'refresh-0');
    secureStore().set(
      SESSION_STORAGE_KEYS.snapshot,
      JSON.stringify(toSnapshot({ _id: 'user-a', name: 'Asha', email: '', role: 'employee', departmentId: 'dep-1' })),
    );
    (globalThis as unknown as { fetch: unknown }).fetch = jest.fn(() => Promise.reject(new TypeError('Network request failed')));
    await renderWithProviders(<Probe />);
    await waitFor(() => expect(sessionNow().status).toBe('offlineUnverified'));
    expect(sessionNow().user?.role).toBe('employee');
    expect(sessionNow().canWrite).toBe(false);
    expect(sessionNow().directoryVerified).toBe(false);
    expect(secureStore().get(SESSION_STORAGE_KEYS.refreshToken)).toBe('refresh-0');
  });

  it('logout clears storage and caches and revokes remotely (best effort)', async () => {
    const calls = mockFetch((call) =>
      call.path === '/api/auth/mobile/login' ? jsonResponse(200, authResponse('1')) : jsonResponse(200, { success: true }),
    );
    const { queryClient } = await renderWithProviders(<Probe />);
    await waitFor(() => expect(sessionNow().status).toBe('signedOut'));
    await act(async () => {
      await sessionNow().login('asha@example.com', 'secret123');
    });
    expect(sessionNow().status).toBe('authenticated');
    queryClient.setQueryData(createQueryKeys('user-a', 'dep-1').leaves(), ['mine']);
    await act(async () => {
      await sessionNow().logout();
    });
    expect(sessionNow().status).toBe('signedOut');
    expect(secureStore().size).toBe(0);
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
    const logoutCall = calls.find((c) => c.path === '/api/auth/mobile/logout');
    expect(logoutCall?.body).toEqual({ refreshToken: 'refresh-1' });
  });
});
