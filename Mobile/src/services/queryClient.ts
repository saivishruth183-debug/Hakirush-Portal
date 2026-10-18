import NetInfo from '@react-native-community/netinfo';
import { focusManager, onlineManager, QueryClient } from '@tanstack/react-query';
import { AppState, Platform, type AppStateStatus } from 'react-native';

import { isApiError } from './api/errors';

/** Retry transient failures (network/timeout/5xx) up to 2 times; never retry 4xx, config or cancelled. */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (isApiError(error)) {
    if (error.kind === 'config' || error.kind === 'cancelled') return false;
    if (error.kind === 'http' && error.status !== undefined && error.status < 500 && error.status !== 429) {
      return false;
    }
  }
  return failureCount < 2;
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: shouldRetry,
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
        staleTime: 30_000,
        gcTime: 10 * 60_000,
        refetchOnWindowFocus: true, // "window focus" = app returns to foreground (see focusManager below)
        refetchOnReconnect: true,
      },
      mutations: {
        retry: false, // never replay writes automatically
      },
    },
  });
}

/** The app-wide client. Tests create their own with createQueryClient(). */
export const queryClient = createQueryClient();

let nativeWired = false;

/**
 * Wire react-query to React Native:
 * - focusManager ← AppState (refetch stale queries on foreground; polling via refetchInterval
 *   pauses while backgrounded because refetchIntervalInBackground defaults to false).
 * - onlineManager ← NetInfo (queries pause offline and resume on reconnect).
 * Idempotent; returns an unsubscribe for tests.
 */
export function wireReactQueryToNative(): () => void {
  if (nativeWired) return () => {};
  nativeWired = true;

  const onAppStateChange = (status: AppStateStatus) => {
    if (Platform.OS !== 'web') focusManager.setFocused(status === 'active');
  };
  const appStateSub = AppState.addEventListener('change', onAppStateChange);

  onlineManager.setEventListener((setOnline) =>
    NetInfo.addEventListener((state) => {
      // isInternetReachable may be null while unknown; only treat explicit false as offline.
      setOnline(!!state.isConnected && state.isInternetReachable !== false);
    }),
  );

  return () => {
    appStateSub.remove();
    nativeWired = false;
  };
}
