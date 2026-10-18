import type { UseQueryResult } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import type { ReactNode } from 'react';

import { QueryStateView, Screen } from '@/components';

/**
 * Loads a record, then hands it to `children` (which renders its own <Screen>, usually a form
 * initialised from the data). Loading / error (retry) / offline states render in a plain Screen.
 */
export function DetailLoader<T>({ query, title, children }: { query: UseQueryResult<T, Error>; title: string; children: (data: T) => ReactNode }) {
  if (query.data !== undefined) return <>{children(query.data)}</>;
  return (
    <Screen>
      <Stack.Screen options={{ title }} />
      <QueryStateView query={query}>{() => null}</QueryStateView>
    </Screen>
  );
}

/** Sets the native stack header title from inside a screen. */
export function ScreenTitle({ title }: { title: string }) {
  return <Stack.Screen options={{ title }} />;
}
