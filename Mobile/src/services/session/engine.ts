/**
 * Framework-free session logic (unit-tested in src/services/session/__tests__).
 *
 * Race rule: every async step re-checks the session generation (authState.getGeneration()).
 * Writes follow "check generation → write → re-check; if stale, delete what we wrote"
 * so a late refresh can never repopulate storage after logout, update a different user,
 * or sign out a newer account.
 */
import type { SessionUser } from '@/types/api';

import { authState } from '../api/authState';
import { refreshSession } from '../api/client';
import { ApiError, isApiError } from '../api/errors';
import { isCurrentGeneration, persistAuthForGeneration, persistSnapshotForGeneration } from './persist';
import { fromSnapshot, sessionStorage } from './storage';

export { isCurrentGeneration, persistAuthForGeneration, persistSnapshotForGeneration };

export type SessionStatus = 'booting' | 'signedOut' | 'authenticated' | 'offlineUnverified';

export interface SessionState {
  status: SessionStatus;
  user: SessionUser | null;
  /** Why the user was signed out (shown on the login screen), if not voluntary. */
  signOutReason: string | null;
}

export const SIGN_OUT_REASONS = {
  inactive: 'Your account is inactive. Please contact your administrator.',
  expired: 'Your session has expired. Please sign in again.',
  security: 'You were signed out for security reasons. Please sign in again.',
  passwordChanged: 'Your password was changed. Please sign in again with your new password.',
} as const;

/** The server definitively rejected the stored session (vs. a transient failure). */
export function isSessionRejectedOnRefresh(e: unknown): e is ApiError {
  return isApiError(e) && e.kind === 'http' && (e.status === 400 || e.status === 401 || e.status === 403);
}

export function reasonForRejection(e: ApiError): string {
  switch (e.code) {
    case 'ACCOUNT_INACTIVE':
      return SIGN_OUT_REASONS.inactive;
    case 'REFRESH_REUSED':
    case 'SESSION_REVOKED':
      return SIGN_OUT_REASONS.security;
    default:
      return SIGN_OUT_REASONS.expired;
  }
}

/**
 * Local half of sign-out: invalidates every in-flight request (generation bump), forgets
 * tokens in memory and wipes SecureStore. Returns the refresh token that was active
 * (for the best-effort remote revoke) and the new generation.
 */
export async function clearSessionLocal(): Promise<{ previousRefreshToken: string | null; generation: number }> {
  const previousRefreshToken = authState.getRefreshToken();
  const generation = authState.bumpGeneration();
  authState.clear();
  await sessionStorage.clear();
  return { previousRefreshToken, generation };
}

/**
 * Boot:
 *  - no refresh token → signedOut
 *  - refresh OK → authenticated
 *  - 400/401/403 → clear storage → signedOut (+ reason)
 *  - network / timeout / 5xx / 429 / other → offlineUnverified with the cached snapshot (token kept)
 * Returns null if the session generation changed during boot (caller ignores the result).
 */
export async function bootSession(): Promise<SessionState | null> {
  const generation = authState.getGeneration();
  const [refreshToken, snapshot] = await Promise.all([sessionStorage.getRefreshToken(), sessionStorage.getSnapshot()]);
  if (!isCurrentGeneration(generation)) return null;
  if (!refreshToken) {
    if (snapshot) await sessionStorage.clear();
    return { status: 'signedOut', user: null, signOutReason: null };
  }
  authState.setRefreshToken(refreshToken);
  try {
    // refreshSession persists the rotated token (generation-checked) before resolving.
    const res = await refreshSession();
    if (!isCurrentGeneration(generation)) return null;
    return { status: 'authenticated', user: res.user, signOutReason: null };
  } catch (e) {
    if (!isCurrentGeneration(generation)) return null;
    if (isApiError(e) && e.kind === 'cancelled') return null;
    if (isSessionRejectedOnRefresh(e)) {
      authState.clear();
      await sessionStorage.clear();
      return { status: 'signedOut', user: null, signOutReason: reasonForRejection(e) };
    }
    return {
      status: 'offlineUnverified',
      user: snapshot ? fromSnapshot(snapshot) : null,
      signOutReason: null,
    };
  }
}
