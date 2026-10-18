import { authState } from '@/services/api/authState';
import { api, refreshSession, setAuthHandlers, toFormData } from '@/services/api/client';
import { __setApiBaseUrlForTests } from '@/services/api/config';
import { ApiError } from '@/services/api/errors';
import { SESSION_STORAGE_KEYS } from '@/services/session/storage';
import { authResponse, deferred, flush, jsonResponse, mockFetch } from '@/testing/fetchMock';
import { resetAuthWorld, secureStore } from '@/testing/resetSession';

async function catchError(p: Promise<unknown>): Promise<ApiError> {
  try {
    await p;
  } catch (e) {
    return e as ApiError;
  }
  throw new Error('expected rejection');
}

/** Signed-in state: access + refresh token in memory. */
function signIn(access = 'access-0', refresh = 'refresh-0') {
  authState.setAccessToken(access, new Date(Date.now() + 10 * 60_000).toISOString());
  authState.setRefreshToken(refresh);
}

beforeEach(() => {
  resetAuthWorld();
  __setApiBaseUrlForTests(null);
});

describe('apiClient error mapping', () => {
  it('maps a rejected fetch to kind "network"', async () => {
    (globalThis as unknown as { fetch: unknown }).fetch = jest.fn(() => Promise.reject(new TypeError('Network request failed')));
    const err = await catchError(api.get('/api/holiday/upcoming', { auth: false }));
    expect(err).toBeInstanceOf(ApiError);
    expect(err.kind).toBe('network');
  });

  it('maps a request exceeding the timeout to kind "timeout"', async () => {
    mockFetch(() => new Promise(() => undefined)); // never answers
    const err = await catchError(api.get('/api/holiday/upcoming', { auth: false, timeoutMs: 30 }));
    expect(err.kind).toBe('timeout');
  });

  it('maps caller cancellation to kind "cancelled"', async () => {
    mockFetch(() => new Promise(() => undefined));
    const controller = new AbortController();
    const p = api.get('/api/holiday/upcoming', { auth: false, signal: controller.signal });
    controller.abort();
    expect((await catchError(p)).kind).toBe('cancelled');
  });

  it('maps a 401 (no session to refresh) to kind "http" with status and code', async () => {
    mockFetch(() => jsonResponse(401, { success: false, error: 'No token provided', code: 'AUTH_REQUIRED' }));
    const err = await catchError(api.get('/api/employee/me'));
    expect(err.kind).toBe('http');
    expect(err.status).toBe(401);
    expect(err.code).toBe('AUTH_REQUIRED');
  });

  it('maps 5xx to kind "http" with a generic message (server text not leaked)', async () => {
    mockFetch(() => jsonResponse(500, { success: false, error: 'MongoError: secret internals' }));
    const err = await catchError(api.get('/api/holiday/upcoming', { auth: false }));
    expect(err.kind).toBe('http');
    expect(err.status).toBe(500);
    expect(err.message).not.toContain('MongoError');
  });

  it('uses the contract error/code for 4xx, and legacy `message` bodies', async () => {
    mockFetch((call) =>
      call.path === '/api/leave/add'
        ? jsonResponse(409, { success: false, error: 'Overlapping leave', code: 'CONFLICT', details: { id: 1 } })
        : jsonResponse(404, { success: false, message: 'Leave request not found' }),
    );
    const conflict = await catchError(api.post('/api/leave/add', { a: 1 }, { auth: false }));
    expect(conflict).toMatchObject({ kind: 'http', status: 409, code: 'CONFLICT', message: 'Overlapping leave', details: { id: 1 } });
    const legacy = await catchError(api.get('/api/leave/detail/x', { auth: false }));
    expect(legacy).toMatchObject({ status: 404, message: 'Leave request not found' });
  });

  it('treats 200 with success:false as an http error', async () => {
    mockFetch(() => jsonResponse(200, { success: false, error: 'Nope', code: 'VALIDATION_ERROR' }));
    expect(await catchError(api.get('/api/x', { auth: false }))).toMatchObject({ kind: 'http', code: 'VALIDATION_ERROR' });
  });

  it('throws a config error when EXPO_PUBLIC_API_URL is missing', async () => {
    __setApiBaseUrlForTests('');
    const saved = process.env.EXPO_PUBLIC_API_URL;
    process.env.EXPO_PUBLIC_API_URL = '';
    const err = await catchError(api.get('/api/x', { auth: false }));
    process.env.EXPO_PUBLIC_API_URL = saved;
    expect(err.kind).toBe('config');
  });

  it('sends JSON with Content-Type, multipart without it, and the bearer token', async () => {
    signIn('tok-1');
    const calls = mockFetch(() => jsonResponse(200, { success: true }));
    await api.post('/api/leave/add', { days: 1 });
    await api.post('/api/client/1/gallery', toFormData({ caption: 'x' }, { image: { uri: 'file:///a.jpg', name: 'a.jpg', type: 'image/jpeg' } }));
    expect(calls[0].headers['Content-Type']).toBe('application/json');
    expect(calls[0].headers.Authorization).toBe('Bearer tok-1');
    expect(calls[1].headers['Content-Type']).toBeUndefined();
    expect(calls[1].headers.Authorization).toBe('Bearer tok-1');
  });
});

describe('401 handling and single-flight refresh', () => {
  it('two concurrent 401 TOKEN_EXPIRED → exactly one refresh, both requests retried with the new token', async () => {
    signIn('old-access', 'refresh-0');
    const refreshGate = deferred<void>();
    const calls = mockFetch(async (call) => {
      if (call.path === '/api/auth/mobile/refresh') {
        await refreshGate.promise;
        return jsonResponse(200, authResponse('1'));
      }
      if (call.headers.Authorization === 'Bearer old-access') {
        return jsonResponse(401, { success: false, error: 'Session expired', code: 'TOKEN_EXPIRED' });
      }
      return jsonResponse(200, { success: true, path: call.path });
    });
    const a = api.get<{ path: string }>('/api/employee/me');
    const b = api.get<{ path: string }>('/api/attendance/today/me');
    await flush(20);
    refreshGate.resolve();
    await expect(a).resolves.toMatchObject({ path: '/api/employee/me' });
    await expect(b).resolves.toMatchObject({ path: '/api/attendance/today/me' });
    expect(calls.filter((c) => c.path === '/api/auth/mobile/refresh')).toHaveLength(1);
    expect(calls.filter((c) => c.headers.Authorization === 'Bearer access-1')).toHaveLength(2);
    // Rotated refresh token was persisted before the lock was released.
    expect(secureStore().get(SESSION_STORAGE_KEYS.refreshToken)).toBe('refresh-1');
  });

  it('boot refresh + a concurrent 401-triggered refresh produce exactly one /auth/mobile/refresh call', async () => {
    signIn('old-access', 'refresh-0');
    const refreshGate = deferred<void>();
    const calls = mockFetch(async (call) => {
      if (call.path === '/api/auth/mobile/refresh') {
        await refreshGate.promise;
        return jsonResponse(200, authResponse('1'));
      }
      if (call.headers.Authorization === 'Bearer old-access') {
        return jsonResponse(401, { success: false, code: 'TOKEN_EXPIRED' });
      }
      return jsonResponse(200, { success: true });
    });
    const boot = refreshSession(); // what bootSession() does
    const req = api.get('/api/employee/me'); // 401 while the boot refresh is in flight
    await flush(20);
    refreshGate.resolve();
    await expect(boot).resolves.toMatchObject({ refreshToken: 'refresh-1' });
    await expect(req).resolves.toMatchObject({ success: true });
    expect(calls.filter((c) => c.path === '/api/auth/mobile/refresh')).toHaveLength(1);
  });

  it('401 SESSION_REVOKED → signed out immediately, no refresh attempt', async () => {
    signIn();
    const onSessionRejected = jest.fn();
    setAuthHandlers({ onSessionRejected });
    const calls = mockFetch(() => jsonResponse(401, { success: false, code: 'SESSION_REVOKED' }));
    const err = await catchError(api.get('/api/employee/me'));
    expect(err.code).toBe('SESSION_REVOKED');
    expect(calls.some((c) => c.path === '/api/auth/mobile/refresh')).toBe(false);
    expect(onSessionRejected).toHaveBeenCalledTimes(1);
  });

  it('failed refresh (401 REFRESH_REUSED) notifies the session exactly once for concurrent callers', async () => {
    signIn('old-access');
    const onSessionRejected = jest.fn();
    setAuthHandlers({ onSessionRejected });
    mockFetch((call) =>
      call.path === '/api/auth/mobile/refresh'
        ? jsonResponse(401, { success: false, code: 'REFRESH_REUSED' })
        : jsonResponse(401, { success: false, code: 'TOKEN_EXPIRED' }),
    );
    const results = await Promise.allSettled([api.get('/api/a'), api.get('/api/b')]);
    expect(results.every((r) => r.status === 'rejected')).toBe(true);
    expect(onSessionRejected).toHaveBeenCalledTimes(1);
    expect(onSessionRejected.mock.calls[0][0]).toMatchObject({ status: 401, code: 'REFRESH_REUSED' });
  });

  it('a transient refresh failure (network) keeps the session (no rejection)', async () => {
    signIn('old-access');
    const onSessionRejected = jest.fn();
    setAuthHandlers({ onSessionRejected });
    mockFetch((call) =>
      call.path === '/api/auth/mobile/refresh'
        ? Promise.reject(new TypeError('Network request failed'))
        : jsonResponse(401, { success: false, code: 'TOKEN_EXPIRED' }),
    );
    expect((await catchError(api.get('/api/a'))).kind).toBe('network');
    expect(onSessionRejected).not.toHaveBeenCalled();
    expect(authState.getRefreshToken()).toBe('refresh-0');
  });
});

describe('session generation', () => {
  it('discards a response that resolves after logout (stale generation)', async () => {
    signIn();
    const gate = deferred<void>();
    mockFetch(async () => {
      await gate.promise;
      return jsonResponse(200, { success: true, secret: 'user A data' });
    });
    const p = api.get('/api/employee/me');
    await flush(10);
    authState.bumpGeneration(); // logout / account switch
    authState.clear();
    gate.resolve();
    const err = await catchError(p);
    expect(err.kind).toBe('cancelled');
  });

  it('logout during an in-flight refresh: late result is dropped, nothing persisted, no UI callback', async () => {
    signIn('old-access', 'refresh-0');
    const onTokensRefreshed = jest.fn();
    setAuthHandlers({ onTokensRefreshed });
    const gate = deferred<void>();
    mockFetch(async () => {
      await gate.promise;
      return jsonResponse(200, authResponse('late'));
    });
    const p = refreshSession();
    await flush(10);
    authState.bumpGeneration(); // logout
    authState.clear();
    gate.resolve();
    expect((await catchError(p)).kind).toBe('cancelled');
    expect(authState.getAccessToken()).toBeNull();
    expect(secureStore().size).toBe(0);
    expect(onTokensRefreshed).not.toHaveBeenCalled();
  });

  it('a stale 401 from a previous session never signs out the new session', async () => {
    signIn('a-access', 'a-refresh');
    const onSessionRejected = jest.fn();
    setAuthHandlers({ onSessionRejected });
    const gate = deferred<void>();
    mockFetch(async () => {
      await gate.promise;
      return jsonResponse(401, { success: false, code: 'SESSION_REVOKED' });
    });
    const p = api.get('/api/employee/me');
    await flush(10);
    authState.bumpGeneration(); // user B signs in
    signIn('b-access', 'b-refresh');
    gate.resolve();
    expect((await catchError(p)).kind).toBe('cancelled');
    expect(onSessionRejected).not.toHaveBeenCalled();
    expect(authState.getAccessToken()).toBe('b-access');
  });
});
