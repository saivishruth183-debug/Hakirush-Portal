import { authState } from '@/services/api/authState';
import { refreshSession } from '@/services/api/client';
import { bootSession, clearSessionLocal, persistAuthForGeneration, SIGN_OUT_REASONS } from '@/services/session/engine';
import { SESSION_STORAGE_KEYS, toSnapshot } from '@/services/session/storage';
import type { SessionUser } from '@/types/api';
import { authResponse, deferred, flush, jsonResponse, mockFetch } from '@/testing/fetchMock';
import { resetAuthWorld, secureControl, secureStore } from '@/testing/resetSession';

const userA: SessionUser = { _id: 'user-a', name: 'Asha Rao', email: 'asha@example.com', role: 'employee', departmentId: 'dep-1' };

function seedStoredSession(refreshToken = 'refresh-0', user: SessionUser = userA) {
  secureStore().set(SESSION_STORAGE_KEYS.refreshToken, refreshToken);
  secureStore().set(SESSION_STORAGE_KEYS.snapshot, JSON.stringify(toSnapshot(user)));
}

beforeEach(() => {
  resetAuthWorld();
});

describe('bootSession', () => {
  it('no refresh token → signedOut', async () => {
    mockFetch(() => jsonResponse(500, {}));
    await expect(bootSession()).resolves.toEqual({ status: 'signedOut', user: null, signOutReason: null });
  });

  it('refresh OK → authenticated; rotated token persisted, access token only in memory', async () => {
    seedStoredSession();
    const calls = mockFetch(() => jsonResponse(200, authResponse('1')));
    const result = await bootSession();
    expect(result?.status).toBe('authenticated');
    expect(result?.user?._id).toBe('user-a');
    expect(calls[0].body).toEqual({ refreshToken: 'refresh-0' });
    expect(secureStore().get(SESSION_STORAGE_KEYS.refreshToken)).toBe('refresh-1');
    expect([...secureStore().values()].join()).not.toContain('access-1');
    expect(authState.getAccessToken()).toBe('access-1');
  });

  it('network error → offlineUnverified with cached snapshot; refresh token kept', async () => {
    seedStoredSession();
    (globalThis as unknown as { fetch: unknown }).fetch = jest.fn(() => Promise.reject(new TypeError('Network request failed')));
    const result = await bootSession();
    expect(result?.status).toBe('offlineUnverified');
    expect(result?.user).toMatchObject({ _id: 'user-a', role: 'employee', email: '' });
    expect(secureStore().get(SESSION_STORAGE_KEYS.refreshToken)).toBe('refresh-0');
  });

  it('5xx → offlineUnverified (token kept)', async () => {
    seedStoredSession();
    mockFetch(() => jsonResponse(503, { success: false, code: 'AUTH_UNAVAILABLE' }));
    expect((await bootSession())?.status).toBe('offlineUnverified');
    expect(secureStore().get(SESSION_STORAGE_KEYS.refreshToken)).toBe('refresh-0');
  });

  it('401 → signedOut, storage cleared, reason shown', async () => {
    seedStoredSession();
    mockFetch(() => jsonResponse(401, { success: false, code: 'REFRESH_INVALID' }));
    const result = await bootSession();
    expect(result).toEqual({ status: 'signedOut', user: null, signOutReason: SIGN_OUT_REASONS.expired });
    expect(secureStore().size).toBe(0);
    expect(authState.getRefreshToken()).toBeNull();
  });

  it('403 ACCOUNT_INACTIVE → signedOut with the inactive message', async () => {
    seedStoredSession();
    mockFetch(() => jsonResponse(403, { success: false, code: 'ACCOUNT_INACTIVE' }));
    const result = await bootSession();
    expect(result?.signOutReason).toBe(SIGN_OUT_REASONS.inactive);
    expect(secureStore().size).toBe(0);
  });
});

describe('session races', () => {
  it('boot persistence racing logout: nothing remains in storage, boot result is dropped', async () => {
    seedStoredSession();
    mockFetch(() => jsonResponse(200, authResponse('1')));
    secureControl().writeDelayMs = 30; // slow SecureStore write of the rotated token
    const boot = bootSession();
    await new Promise((r) => setTimeout(r, 10)); // refresh answered, write in progress
    await clearSessionLocal(); // user taps "Sign out"
    secureControl().writeDelayMs = 0;
    await expect(boot).resolves.toBeNull();
    expect(secureStore().size).toBe(0);
    expect(authState.getAccessToken()).toBeNull();
    expect(authState.getRefreshToken()).toBeNull();
  });

  it('account switch during an in-flight refresh: user A\'s late tokens never replace user B', async () => {
    seedStoredSession('refresh-a');
    authState.setRefreshToken('refresh-a');
    const gate = deferred<void>();
    mockFetch(async () => {
      await gate.promise;
      return jsonResponse(200, authResponse('a2'));
    });
    const refreshA = refreshSession();
    await flush(10);

    // A signs out, B signs in (login response persisted for the new generation).
    const { generation } = await clearSessionLocal();
    const userB = authResponse('b', { _id: 'user-b', name: 'Bala', departmentId: 'dep-2' });
    await expect(persistAuthForGeneration(userB, generation)).resolves.toBe(true);

    gate.resolve();
    await expect(refreshA).rejects.toMatchObject({ kind: 'cancelled' });
    expect(secureStore().get(SESSION_STORAGE_KEYS.refreshToken)).toBe('refresh-b');
    expect(JSON.parse(secureStore().get(SESSION_STORAGE_KEYS.snapshot)!)._id).toBe('user-b');
    expect(authState.getAccessToken()).toBe('access-b');
  });

  it('a stale persist that lands after a newer login does not delete the newer session', async () => {
    const stale = authState.getGeneration();
    secureControl().writeDelayMs = 20;
    const stalePersist = persistAuthForGeneration(authResponse('old'), stale);
    const { generation } = await clearSessionLocal(); // queued after the stale write
    secureControl().writeDelayMs = 0;
    await persistAuthForGeneration(authResponse('new', { _id: 'user-b' }), generation);
    await expect(stalePersist).resolves.toBe(false);
    expect(secureStore().get(SESSION_STORAGE_KEYS.refreshToken)).toBe('refresh-new');
    expect(JSON.parse(secureStore().get(SESSION_STORAGE_KEYS.snapshot)!)._id).toBe('user-b');
  });
});
