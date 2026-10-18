import type { ApiErrorCode } from '@/types/api';

/**
 * - `network`: no response (offline, DNS, TLS, connection refused).
 * - `timeout`: no response within the client timeout (20 s by default).
 * - `http`: the server answered with a non-2xx status (or `success:false`).
 * - `config`: the app is misconfigured (e.g. EXPO_PUBLIC_API_URL missing / not https in production).
 * - `cancelled`: the caller aborted, or the response belonged to a previous session
 *   (logout / account switch) and was discarded. Never show this to the user.
 */
export type ApiErrorKind = 'network' | 'timeout' | 'http' | 'config' | 'cancelled';

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status?: number;
  readonly code?: ApiErrorCode | string;
  readonly details?: unknown;

  constructor(init: {
    kind: ApiErrorKind;
    message: string;
    status?: number;
    code?: ApiErrorCode | string;
    details?: unknown;
  }) {
    super(init.message);
    this.name = 'ApiError';
    this.kind = init.kind;
    this.status = init.status;
    this.code = init.code;
    this.details = init.details;
  }
}

export function isApiError(e: unknown): e is ApiError {
  return e instanceof ApiError;
}

export function isCancelledError(e: unknown): boolean {
  return isApiError(e) && e.kind === 'cancelled';
}

/** Network failure, timeout, rate limit or 5xx: keep the session, show "try again". */
export function isTransientError(e: unknown): boolean {
  if (!isApiError(e)) return false;
  if (e.kind === 'network' || e.kind === 'timeout') return true;
  return e.kind === 'http' && (e.status === undefined || e.status >= 500 || e.status === 429);
}

/**
 * The server rejected the session itself (refresh failed / account inactive):
 * sign out and clear private state (contract "Client session rule").
 */
export function isSessionRejection(e: unknown): boolean {
  if (!isApiError(e) || e.kind !== 'http') return false;
  if (e.status === 401) return true;
  if (e.status === 403 && e.code === 'ACCOUNT_INACTIVE') return true;
  return false;
}

const DEFAULT_MESSAGES: Record<number, string> = {
  400: 'Some of the information is not valid. Please check and try again.',
  401: 'Your session has ended. Please sign in again.',
  403: 'You do not have permission to do that.',
  404: 'We could not find what you were looking for.',
  409: 'This was changed by someone else. Refresh and try again.',
  413: 'The file is too large.',
  415: 'This file type is not supported.',
  429: 'Too many attempts. Please wait a moment and try again.',
};

export function defaultMessageForStatus(status: number): string {
  if (DEFAULT_MESSAGES[status]) return DEFAULT_MESSAGES[status];
  if (status >= 500) return 'The server had a problem. Please try again shortly.';
  return 'Something went wrong. Please try again.';
}

/** A user-presentable message for any thrown value. */
export function getErrorMessage(e: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (isApiError(e)) {
    switch (e.kind) {
      case 'network':
        return 'You appear to be offline or the server cannot be reached. Check your connection and try again.';
      case 'timeout':
        return 'The server took too long to respond. Please try again.';
      case 'config':
        return e.message;
      case 'cancelled':
        return 'The request was cancelled.';
      case 'http':
      default:
        return e.message || (e.status ? defaultMessageForStatus(e.status) : fallback);
    }
  }
  return fallback;
}
