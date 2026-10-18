/**
 * Generation-checked persistence of auth state.
 * Rule: check generation → write → re-check; if the session changed meanwhile, undo our own
 * writes (only if still ours) and report false. Used by the API client's refresh (before the
 * single-flight lock is released), by boot, login and refreshUser.
 */
import type { MobileAuthResponse, SessionUser } from '@/types/api';

import { authState } from '../api/authState';
import { sessionStorage, toSnapshot } from './storage';

export function isCurrentGeneration(generation: number): boolean {
  return generation === authState.getGeneration();
}

/**
 * Persist tokens + snapshot for `generation`. Returns false (and undoes its own writes)
 * if the session changed meanwhile. The access token stays in memory only.
 */
export async function persistAuthForGeneration(
  res: Pick<MobileAuthResponse, 'accessToken' | 'accessTokenExpiresAt' | 'refreshToken' | 'user'>,
  generation: number,
): Promise<boolean> {
  if (!isCurrentGeneration(generation)) return false;
  authState.setAccessToken(res.accessToken, res.accessTokenExpiresAt);
  authState.setRefreshToken(res.refreshToken);
  await sessionStorage.setRefreshToken(res.refreshToken);
  if (!isCurrentGeneration(generation)) {
    await sessionStorage.removeIfOwned(res.refreshToken, res.user._id);
    return false;
  }
  await sessionStorage.setSnapshot(toSnapshot(res.user));
  if (!isCurrentGeneration(generation)) {
    await sessionStorage.removeIfOwned(res.refreshToken, res.user._id);
    return false;
  }
  return true;
}

/** Persist only the user snapshot (after /auth/verify) if the generation is still current. */
export async function persistSnapshotForGeneration(user: SessionUser, generation: number): Promise<boolean> {
  if (!isCurrentGeneration(generation)) return false;
  await sessionStorage.setSnapshot(toSnapshot(user));
  if (!isCurrentGeneration(generation)) {
    await sessionStorage.removeSnapshotIfOwned(user._id);
    return false;
  }
  return true;
}

