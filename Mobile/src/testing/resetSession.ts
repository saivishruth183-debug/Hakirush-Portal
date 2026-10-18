import { authState } from '@/services/api/authState';
import { __resetApiClientForTests } from '@/services/api/client';

/** Reset in-memory auth + fake SecureStore between tests. */
export function resetAuthWorld(): void {
  __resetApiClientForTests();
  authState.bumpGeneration();
  authState.clear();
  const secure = jest.requireMock('expo-secure-store') as { __store: Map<string, string>; __control: { writeDelayMs: number; failReads: boolean } };
  secure.__store.clear();
  secure.__control.writeDelayMs = 0;
  secure.__control.failReads = false;
}

export function secureStore(): Map<string, string> {
  return (jest.requireMock('expo-secure-store') as { __store: Map<string, string> }).__store;
}

export function secureControl(): { writeDelayMs: number; failReads: boolean } {
  return (jest.requireMock('expo-secure-store') as { __control: { writeDelayMs: number; failReads: boolean } }).__control;
}
