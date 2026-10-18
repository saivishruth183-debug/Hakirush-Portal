import type { MobileAuthResponse, SessionUser } from '@/types/api';

/** Test helpers: a programmable global.fetch and deferred promises. */

export interface FakeResponse {
  status: number;
  ok: boolean;
  text: () => Promise<string>;
}

export function jsonResponse(status: number, body: unknown): FakeResponse {
  return { status, ok: status >= 200 && status < 300, text: async () => (body === undefined ? '' : JSON.stringify(body)) };
}

export interface Deferred<T> {
  promise: Promise<T>;
  resolve: (v: T) => void;
  reject: (e: unknown) => void;
}

export function deferred<T>(): Deferred<T> {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

export interface RecordedCall {
  url: string;
  path: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
}

type Handler = (call: RecordedCall, init: RequestInit) => Promise<FakeResponse> | FakeResponse;

/** Installs a fetch mock; returns the list of recorded calls. Abort signals reject with AbortError. */
export function mockFetch(handler: Handler): RecordedCall[] {
  const calls: RecordedCall[] = [];
  const fn = jest.fn((url: string, init: RequestInit = {}) => {
    const headers = (init.headers ?? {}) as Record<string, string>;
    let body: unknown = init.body;
    if (typeof init.body === 'string') {
      try {
        body = JSON.parse(init.body);
      } catch {
        body = init.body;
      }
    }
    const call: RecordedCall = {
      url,
      path: url.replace(/^https?:\/\/[^/]+/, '').split('?')[0],
      method: init.method ?? 'GET',
      headers,
      body,
    };
    calls.push(call);
    return new Promise<FakeResponse>((resolve, reject) => {
      const signal = init.signal;
      if (signal) {
        if (signal.aborted) {
          reject(Object.assign(new Error('Aborted'), { name: 'AbortError' }));
          return;
        }
        signal.addEventListener('abort', () => reject(Object.assign(new Error('Aborted'), { name: 'AbortError' })));
      }
      Promise.resolve(handler(call, init)).then(resolve, reject);
    });
  });
  (globalThis as unknown as { fetch: unknown }).fetch = fn;
  return calls;
}

/** Let pending promise callbacks run. */
export async function flush(times = 5): Promise<void> {
  for (let i = 0; i < times; i++) await Promise.resolve();
}

export function authResponse(suffix: string, user: Partial<SessionUser> = {}): MobileAuthResponse {
  return {
    success: true,
    accessToken: `access-${suffix}`,
    accessTokenExpiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
    refreshToken: `refresh-${suffix}`,
    refreshTokenExpiresAt: new Date(Date.now() + 30 * 86_400_000).toISOString(),
    user: { _id: 'user-a', name: 'Asha Rao', email: 'asha@example.com', role: 'employee' as const, departmentId: 'dep-1', ...user },
  };
}
