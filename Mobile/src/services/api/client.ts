/**
 * Hakirush API client (fetch based).
 *
 * - Base URL from EXPO_PUBLIC_API_URL (see config.ts).
 * - 20 s timeout (AbortController) + optional caller AbortSignal (react-query passes one).
 * - JSON bodies, or multipart when `body` is a FormData (Content-Type is NOT set manually so
 *   the runtime adds the multipart boundary). File parts: `{ uri, name, type }`.
 * - Errors are always `ApiError` (see errors.ts), mapped from `{success:false,error,code}`.
 * - `Authorization: Bearer <access token from memory>`; on 401 the client performs ONE
 *   single-flight refresh (POST /api/auth/mobile/refresh, shared by concurrent callers) and
 *   retries the original request once. No other automatic replays of writes.
 * - Session generation: responses that resolve after logout / account switch are discarded
 *   with an ApiError of kind `cancelled`.
 */
import type { MobileAuthResponse } from '@/types/api';

import { persistAuthForGeneration } from '../session/persist';
import { authState } from './authState';
import { buildUrl } from './config';
import { ApiError, defaultMessageForStatus, isSessionRejection } from './errors';

export const DEFAULT_TIMEOUT_MS = 20_000;

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
export type QueryParams = Record<string, string | number | boolean | null | undefined>;

export interface RequestOptions {
  method?: HttpMethod;
  /** Plain object/array → JSON. FormData → multipart. */
  body?: unknown;
  query?: QueryParams;
  headers?: Record<string, string>;
  /** Caller cancellation (react-query's `signal`, or your own AbortController). */
  signal?: AbortSignal;
  /** Send the bearer token and handle 401 refresh (default true). */
  auth?: boolean;
  timeoutMs?: number;
  /** Sets the `Idempotency-Key` header (attendance transitions accept it). */
  idempotencyKey?: string;
}

export interface AuthHandlers {
  /**
   * Called after every successful refresh, AFTER the rotated refresh token has been persisted
   * to SecureStore (and only if the generation is still current). Update UI state here.
   */
  onTokensRefreshed?: (res: MobileAuthResponse, generation: number) => Promise<void> | void;
  /** The server rejected the session (401 after a failed refresh, or 403 ACCOUNT_INACTIVE). Only called for the CURRENT generation. */
  onSessionRejected?: (error: ApiError, generation: number) => void;
}

let handlers: AuthHandlers = {};
/** Single-flight refresh, namespaced by session generation (a new session never joins an old refresh). */
let refreshInFlight: { generation: number; promise: Promise<MobileAuthResponse> } | null = null;
let lastRejectedGeneration = -1;

/** SessionProvider registers its callbacks here. */
export function setAuthHandlers(next: AuthHandlers): void {
  handlers = next;
}

function cancelledError(message = 'Request cancelled'): ApiError {
  return new ApiError({ kind: 'cancelled', message });
}

function assertGeneration(generation: number): void {
  if (generation !== authState.getGeneration()) {
    throw cancelledError('Discarded: the session changed while the request was in flight');
  }
}

function notifySessionRejected(error: ApiError, generation: number): void {
  // A stale request (from a session that already ended) must never sign out the new session.
  if (generation !== authState.getGeneration()) return;
  if (lastRejectedGeneration === generation) return;
  lastRejectedGeneration = generation;
  handlers.onSessionRejected?.(error, generation);
}

interface RawResponse {
  status: number;
  ok: boolean;
  data: unknown;
}

function isFormData(body: unknown): body is FormData {
  return typeof FormData !== 'undefined' && body instanceof FormData;
}

async function send(url: string, opts: RequestOptions, accessToken: string | null): Promise<RawResponse> {
  const headers: Record<string, string> = { Accept: 'application/json', ...opts.headers };
  let body: BodyInit | undefined;
  if (opts.body !== undefined && opts.body !== null) {
    if (isFormData(opts.body)) {
      body = opts.body; // never set Content-Type for multipart
    } else {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(opts.body);
    }
  }
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  if (opts.idempotencyKey) headers['Idempotency-Key'] = opts.idempotencyKey;

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const callerSignal = opts.signal;
  const onCallerAbort = () => controller.abort();
  if (callerSignal) {
    if (callerSignal.aborted) {
      clearTimeout(timer);
      throw cancelledError();
    }
    callerSignal.addEventListener('abort', onCallerAbort);
  }

  try {
    const res = await fetch(url, {
      method: opts.method ?? 'GET',
      headers,
      body,
      signal: controller.signal,
    });
    const text = await res.text();
    let data: unknown = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = null;
      }
    }
    return { status: res.status, ok: res.ok, data };
  } catch {
    if (timedOut) {
      throw new ApiError({ kind: 'timeout', message: 'The server took too long to respond.' });
    }
    if (callerSignal?.aborted) throw cancelledError();
    throw new ApiError({ kind: 'network', message: 'Network request failed.' });
  } finally {
    clearTimeout(timer);
    callerSignal?.removeEventListener('abort', onCallerAbort);
  }
}

function toHttpError(res: RawResponse): ApiError {
  const body = (res.data && typeof res.data === 'object' ? res.data : {}) as {
    error?: unknown;
    message?: unknown;
    code?: unknown;
    details?: unknown;
  };
  const serverMessage =
    typeof body.error === 'string' ? body.error : typeof body.message === 'string' ? body.message : undefined;
  // 5xx messages can leak internals (legacy controllers return exception text) — use a generic one.
  const message = res.status >= 500 || !serverMessage ? defaultMessageForStatus(res.status) : serverMessage;
  return new ApiError({
    kind: 'http',
    status: res.status,
    code: typeof body.code === 'string' ? body.code : undefined,
    message,
    details: body.details,
  });
}

function isFailure(res: RawResponse): boolean {
  if (!res.ok) return true;
  return !!res.data && typeof res.data === 'object' && (res.data as { success?: unknown }).success === false;
}

/**
 * Single-flight refresh. Concurrent callers share one in-flight promise.
 * Rejects with ApiError; does NOT notify the session (callers decide).
 */
export function refreshSession(): Promise<MobileAuthResponse> {
  const generation = authState.getGeneration();
  if (refreshInFlight && refreshInFlight.generation === generation) return refreshInFlight.promise;
  const p = (async () => {
    const refreshToken = authState.getRefreshToken();
    if (!refreshToken) {
      throw new ApiError({ kind: 'http', status: 401, code: 'AUTH_REQUIRED', message: 'Please sign in.' });
    }
    const res = await send(
      buildUrl('/api/auth/mobile/refresh'),
      { method: 'POST', body: { refreshToken }, auth: false },
      null,
    );
    assertGeneration(generation); // late response after logout / account switch → dropped
    if (isFailure(res)) throw toHttpError(res);
    const data = res.data as MobileAuthResponse;
    // Persist the rotated token BEFORE releasing the single-flight lock: the old token is now
    // consumed server-side, and presenting it again would be treated as reuse (family revoked).
    const persisted = await persistAuthForGeneration(data, generation);
    if (!persisted) throw cancelledError('Discarded: the session changed during refresh');
    await handlers.onTokensRefreshed?.(data, generation);
    assertGeneration(generation);
    return data;
  })();
  const entry = { generation, promise: p };
  refreshInFlight = entry;
  const release = () => {
    if (refreshInFlight === entry) refreshInFlight = null;
  };
  p.then(release, release);
  return p;
}

/** Refresh, notifying the session when the server rejects it. */
async function refreshOrReject(generation: number): Promise<void> {
  try {
    await refreshSession();
  } catch (e) {
    if (e instanceof ApiError && isSessionRejection(e)) notifySessionRejected(e, generation);
    throw e;
  }
  assertGeneration(generation);
}

/**
 * Returns a usable access token, refreshing first when it is missing or about to expire.
 * Returns null when there is no session at all.
 */
export async function getValidAccessToken(): Promise<string | null> {
  const generation = authState.getGeneration();
  if (authState.isAccessTokenExpiring() && authState.getRefreshToken()) {
    await refreshOrReject(generation);
  }
  return authState.getAccessToken();
}

export async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const generation = authState.getGeneration();
  const useAuth = opts.auth !== false;
  const url = buildUrl(path, opts.query);

  let sentToken: string | null = null;
  if (useAuth) {
    sentToken = await getValidAccessToken();
    assertGeneration(generation);
  }

  let res = await send(url, opts, sentToken);
  assertGeneration(generation);

  if (useAuth && res.status === 401) {
    const err = toHttpError(res);
    // Session revoked (logout on this device, reuse detection, password change): no refresh.
    if (err.code === 'SESSION_REVOKED' || !authState.getRefreshToken()) {
      if (err.code === 'SESSION_REVOKED') notifySessionRejected(err, generation);
      throw err;
    }
    // Another caller may already have refreshed while we were waiting.
    const current = authState.getAccessToken();
    if (!current || current === sentToken) {
      // Joins the in-flight refresh of this generation if there is one (never two in parallel).
      await refreshOrReject(generation);
    }
    sentToken = authState.getAccessToken();
    res = await send(url, opts, sentToken); // the single auth retry
    assertGeneration(generation);
    if (res.status === 401) {
      const err = toHttpError(res);
      notifySessionRejected(err, generation);
      throw err;
    }
  }

  if (isFailure(res)) {
    const err = toHttpError(res);
    if (useAuth && err.status === 403 && err.code === 'ACCOUNT_INACTIVE') notifySessionRejected(err, generation);
    throw err;
  }
  return res.data as T;
}

type BodyOpts = Omit<RequestOptions, 'method' | 'body'>;

export const api = {
  request,
  get: <T>(path: string, opts?: Omit<RequestOptions, 'method' | 'body'>) => request<T>(path, { ...opts, method: 'GET' }),
  post: <T>(path: string, body?: unknown, opts?: BodyOpts) => request<T>(path, { ...opts, method: 'POST', body }),
  put: <T>(path: string, body?: unknown, opts?: BodyOpts) => request<T>(path, { ...opts, method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown, opts?: BodyOpts) => request<T>(path, { ...opts, method: 'PATCH', body }),
  delete: <T>(path: string, opts?: BodyOpts & { body?: unknown }) =>
    request<T>(path, { ...opts, method: 'DELETE' }),
};

/** Random key for the `Idempotency-Key` header (not a security token). */
export function createIdempotencyKey(): string {
  const rand = () => Math.random().toString(36).slice(2, 10);
  return `${Date.now().toString(36)}-${rand()}-${rand()}`;
}

/** A file part for multipart uploads (React Native FormData accepts this object). */
export interface UploadFile {
  uri: string;
  name: string;
  type: string;
}

/**
 * Build a FormData from plain fields + files.
 * Example: toFormData({ caption: 'Hi' }, { image: { uri, name: 'photo.jpg', type: 'image/jpeg' } })
 */
export function toFormData(
  fields: Record<string, string | number | boolean | null | undefined>,
  files?: Record<string, UploadFile | null | undefined>,
): FormData {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) {
    if (v === undefined || v === null) continue;
    form.append(k, String(v));
  }
  if (files) {
    for (const [k, file] of Object.entries(files)) {
      if (!file) continue;
      // React Native's FormData accepts {uri,name,type}; the DOM typings do not know it.
      form.append(k, file as unknown as Blob);
    }
  }
  return form;
}

/** Test-only reset of module state. */
export function __resetApiClientForTests(): void {
  handlers = {};
  refreshInFlight = null;
  lastRejectedGeneration = -1;
}
