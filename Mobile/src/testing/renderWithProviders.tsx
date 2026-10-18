import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ToastProvider } from '@/components/Toast';
import { SessionProvider } from '@/services/session';

export function createTestQueryClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } } });
}

/** Renders `ui` inside the app providers (no navigation). */
export async function renderWithProviders(ui: ReactElement, queryClient: QueryClient = createTestQueryClient()) {
  const result = await render(
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <SessionProvider>
          <ToastProvider>{ui}</ToastProvider>
        </SessionProvider>
      </QueryClientProvider>
    </SafeAreaProvider>,
  );
  return { ...result, queryClient };
}
