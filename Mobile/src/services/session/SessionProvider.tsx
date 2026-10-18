import NetInfo from '@react-native-community/netinfo';
import { useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState, Platform } from 'react-native';

import type { MobileAuthResponse, SessionUser, VerifyResponse } from '@/types/api';

import { authState } from '../api/authState';
import { api, refreshSession, setAuthHandlers } from '../api/client';
import { clearPrivateFiles } from '../api/download';
import { ApiError } from '../api/errors';
import { reconcileUserChange } from '../cacheScope';
import {
  bootSession,
  clearSessionLocal,
  isCurrentGeneration,
  isSessionRejectedOnRefresh,
  persistAuthForGeneration,
  persistSnapshotForGeneration,
  reasonForRejection,
  SIGN_OUT_REASONS,
  type SessionState,
  type SessionStatus,
} from './engine';

export interface SessionContextValue {
  status: SessionStatus;
  /** Present when authenticated or offlineUnverified (snapshot; `email` is '' offline). */
  user: SessionUser | null;
  /** False unless the session is verified with the server: disable writes otherwise. */
  canWrite: boolean;
  /**
   * True only when the user's department membership is server-verified (authenticated).
   * Directory screens (team, birthdays…) must not render cached data while false.
   */
  directoryVerified: boolean;
  /** Message to show on the login screen after a forced sign-out. */
  signOutReason: string | null;
  /** Set when boot failed unexpectedly (e.g. secure storage unavailable). */
  bootError: string | null;
  login: (email: string, password: string) => Promise<SessionUser>;
  /** Voluntary sign-out: revokes the refresh token remotely (best effort) and wipes local data. */
  logout: () => Promise<void>;
  /** Forced sign-out with a message (e.g. after password change). */
  endSession: (reason: string | null, opts?: { revokeRemote?: boolean }) => Promise<void>;
  /** Re-fetch the SessionUser from the server (POST /api/auth/verify). Also runs on foreground/reconnect. */
  refreshUser: () => Promise<void>;
  /** offlineUnverified → try to verify again now. */
  retryVerification: () => Promise<void>;
  /** Re-run boot after a bootError. */
  retryBoot: () => void;
  clearSignOutReason: () => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

const INITIAL: SessionState = { status: 'booting', user: null, signOutReason: null };
const REVERIFY_MIN_INTERVAL_MS = 60_000;

export function SessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<SessionState>(INITIAL);
  const [bootError, setBootError] = useState<string | null>(null);
  const [bootAttempt, setBootAttempt] = useState(0);
  // Mirrors of state for async callbacks (updated only through commit()).
  const current = useRef<SessionState>(INITIAL);
  const lastVerifiedAt = useRef(0);

  const commit = useCallback((next: SessionState) => {
    current.current = next;
    setState(next);
  }, []);

  /** Wipe everything person-specific held on the device (SecureStore is handled by clearSessionLocal). */
  const clearPersonalData = useCallback(async () => {
    try {
      await queryClient.cancelQueries();
    } catch {
      // ignore
    }
    queryClient.clear();
    await clearPrivateFiles();
    try {
      Image.clearMemoryCache();
      await Image.clearDiskCache();
    } catch {
      // ignore (not available in tests)
    }
  }, [queryClient]);

  const endSession = useCallback(
    async (reason: string | null, opts: { revokeRemote?: boolean } = {}) => {
      // Bump generation first so nothing in flight can write back afterwards.
      const pending = clearSessionLocal();
      commit({ status: 'signedOut', user: null, signOutReason: reason });
      const { previousRefreshToken } = await pending;
      if (opts.revokeRemote !== false && previousRefreshToken) {
        // Best effort; started after the generation bump so it is not discarded.
        api.post('/api/auth/mobile/logout', { refreshToken: previousRefreshToken }, { auth: false }).catch(() => undefined);
      }
      await clearPersonalData();
    },
    [clearPersonalData, commit],
  );

  /** Expose a server-verified user, after reconciling caches if user/department changed. */
  const applyVerifiedUser = useCallback(
    async (next: SessionUser, generation: number) => {
      if (!isCurrentGeneration(generation)) return;
      await reconcileUserChange(queryClient, current.current.user, next);
      if (!isCurrentGeneration(generation)) return;
      lastVerifiedAt.current = Date.now();
      commit({ status: 'authenticated', user: next, signOutReason: null });
    },
    [queryClient, commit],
  );

  // API client callbacks: persist rotated refresh tokens; react to server-side rejection.
  useEffect(() => {
    setAuthHandlers({
      // Called after the API client persisted the rotated token (generation-checked).
      onTokensRefreshed: async (res, generation) => {
        if (current.current.status === 'signedOut') return;
        await applyVerifiedUser(res.user, generation);
      },
      onSessionRejected: (error, generation) => {
        if (!isCurrentGeneration(generation) || current.current.status === 'signedOut') return;
        void endSession(reasonForRejection(error), { revokeRemote: false });
      },
    });
    return () => setAuthHandlers({});
  }, [endSession, applyVerifiedUser]);

  // Boot (and re-boot after a bootError).
  useEffect(() => {
    let alive = true;
    bootSession().then(
      (result) => {
        if (!alive || !result) return;
        if (result.status === 'authenticated') lastVerifiedAt.current = Date.now();
        commit(result);
      },
      () => {
        if (!alive) return;
        setBootError('The app could not start. Please try again.');
      },
    );
    return () => {
      alive = false;
    };
  }, [bootAttempt, commit]);

  const retryBoot = useCallback(() => {
    setBootError(null);
    commit(INITIAL);
    setBootAttempt((n) => n + 1);
  }, [commit]);

  const retryVerification = useCallback(async () => {
    if (current.current.status !== 'offlineUnverified') return;
    const generation = authState.getGeneration();
    try {
      // refreshSession persists the rotated token; onTokensRefreshed applies the verified user.
      const res = await refreshSession();
      if (!isCurrentGeneration(generation)) return;
      await applyVerifiedUser(res.user, generation);
    } catch (e) {
      if (!isCurrentGeneration(generation)) return;
      if (isSessionRejectedOnRefresh(e)) {
        await endSession(reasonForRejection(e), { revokeRemote: false });
      }
      // transient: stay offlineUnverified
    }
  }, [endSession, applyVerifiedUser]);

  const refreshUser = useCallback(async () => {
    if (current.current.status !== 'authenticated') return;
    const generation = authState.getGeneration();
    const res = await api.post<VerifyResponse>('/api/auth/verify');
    if (!isCurrentGeneration(generation) || !res.user) return;
    if (!(await persistSnapshotForGeneration(res.user, generation))) return;
    await applyVerifiedUser(res.user, generation);
  }, [applyVerifiedUser]);

  // Re-verify on connectivity regain and on foreground:
  //  - offlineUnverified → try to verify the session;
  //  - authenticated     → refresh the user (role/department may have changed), throttled.
  useEffect(() => {
    if (state.status !== 'offlineUnverified' && state.status !== 'authenticated') return;
    const reverify = () => {
      if (current.current.status === 'offlineUnverified') {
        void retryVerification();
      } else if (Date.now() - lastVerifiedAt.current > REVERIFY_MIN_INTERVAL_MS) {
        lastVerifiedAt.current = Date.now();
        refreshUser().catch(() => undefined);
      }
    };
    let wasConnected: boolean | null = null;
    const unsubscribeNet = NetInfo.addEventListener((net) => {
      const connected = !!net.isConnected && net.isInternetReachable !== false;
      if (connected && wasConnected === false) reverify();
      wasConnected = connected;
    });
    const appStateSub = AppState.addEventListener('change', (next) => {
      if (next === 'active') reverify();
    });
    return () => {
      unsubscribeNet();
      appStateSub.remove();
    };
  }, [state.status, retryVerification, refreshUser]);

  const login = useCallback(
    async (email: string, password: string) => {
      // Always start clean: covers account switch (a different user on this device).
      await clearSessionLocal();
      await clearPersonalData();
      const generation = authState.getGeneration();
      const res = await api.post<MobileAuthResponse>(
        '/api/auth/mobile/login',
        { email: email.trim(), password, deviceName: `${Platform.OS} ${String(Platform.Version)}` },
        { auth: false },
      );
      if (!(await persistAuthForGeneration(res, generation))) {
        throw new ApiError({ kind: 'cancelled', message: 'Sign-in superseded' });
      }
      lastVerifiedAt.current = Date.now();
      commit({ status: 'authenticated', user: res.user, signOutReason: null });
      return res.user;
    },
    [clearPersonalData, commit],
  );

  const logout = useCallback(() => endSession(null, { revokeRemote: true }), [endSession]);

  const clearSignOutReason = useCallback(() => {
    commit({ ...current.current, signOutReason: null });
  }, [commit]);

  const value = useMemo<SessionContextValue>(
    () => ({
      status: state.status,
      user: state.user,
      canWrite: state.status === 'authenticated',
      directoryVerified: state.status === 'authenticated',
      signOutReason: state.signOutReason,
      bootError,
      login,
      logout,
      endSession,
      refreshUser,
      retryVerification,
      retryBoot,
      clearSignOutReason,
    }),
    [state, bootError, login, logout, endSession, refreshUser, retryVerification, retryBoot, clearSignOutReason],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession() must be used inside <SessionProvider>');
  return ctx;
}

export { SIGN_OUT_REASONS };
