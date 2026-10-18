/**
 * Test-only helper (not a test file): boots a real admin session against a fetch mock and renders
 * `ui` once the session is authenticated. Route handlers are keyed by "METHOD /api/path".
 */
import { QueryClient } from '@tanstack/react-query';
import type { ReactElement, ReactNode } from 'react';

import { useSession } from '@/services/session';
import { SESSION_STORAGE_KEYS, toSnapshot } from '@/services/session/storage';
import { authResponse, jsonResponse, mockFetch, type FakeResponse, type RecordedCall } from '@/testing/fetchMock';
import { renderWithProviders } from '@/testing/renderWithProviders';
import { secureStore } from '@/testing/resetSession';

export type RouteHandler = (call: RecordedCall) => FakeResponse | Promise<FakeResponse>;

const ADMIN = { _id: 'admin-1', name: 'Ada Admin', email: 'ada@example.com', role: 'admin' as const, departmentId: null };

function AdminReady({ children }: { children: ReactNode }) {
  const { status } = useSession();
  return status === 'authenticated' ? <>{children}</> : null;
}

export async function renderAdmin(ui: ReactElement, routes: Record<string, RouteHandler>) {
  secureStore().set(SESSION_STORAGE_KEYS.refreshToken, 'refresh-0');
  secureStore().set(SESSION_STORAGE_KEYS.snapshot, JSON.stringify(toSnapshot({ ...ADMIN, email: '' })));
  const calls = mockFetch((call) => {
    if (call.path === '/api/auth/mobile/refresh') return jsonResponse(200, authResponse('1', ADMIN));
    if (call.path === '/api/auth/verify') return jsonResponse(200, { success: true, user: ADMIN });
    const handler = routes[`${call.method} ${call.path}`];
    return handler ? handler(call) : jsonResponse(404, { success: false, error: `No mock for ${call.method} ${call.path}`, code: 'NOT_FOUND' });
  });
  // gcTime Infinity: no 5-minute mutation GC timer keeps Jest alive after the suite.
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } },
  });
  const result = await renderWithProviders(<AdminReady>{ui}</AdminReady>, client);
  const apiCalls = (method: string, path: string) => calls.filter((c) => c.method === method && c.path === path);
  return { ...result, calls, apiCalls };
}

export const ok = (body: Record<string, unknown>) => jsonResponse(200, { success: true, ...body });
export const fail = (status: number, code: string, error: string, details?: unknown) =>
  jsonResponse(status, { success: false, code, error, details });

/** Reads multipart fields (React Native FormData keeps `_parts`; a spec FormData exposes entries()). */
export function formFields(body: unknown): Record<string, unknown> {
  const b = body as { _parts?: [string, unknown][]; entries?: () => Iterable<[string, unknown]> } | null;
  const parts: [string, unknown][] = b?._parts ?? (typeof b?.entries === 'function' ? Array.from(b.entries()) : []);
  const out: Record<string, unknown> = {};
  for (const [k, v] of parts) out[k] = k in out ? ([] as unknown[]).concat(out[k], v) : v;
  return out;
}
