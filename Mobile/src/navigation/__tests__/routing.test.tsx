import { renderRouter, screen, waitFor } from 'expo-router/testing-library';

import { SESSION_STORAGE_KEYS, toSnapshot } from '@/services/session/storage';
import { authResponse, jsonResponse, mockFetch } from '@/testing/fetchMock';
import { resetAuthWorld, secureStore } from '@/testing/resetSession';

jest.setTimeout(20_000);

/** renderRouter returns RNTL 14's render promise with router helpers attached to it. */
async function open(initialUrl: string): Promise<{ getPathname: () => string }> {
  const r = renderRouter('./src/app', { initialUrl });
  await Promise.resolve(r);
  // Wrap: returning the thenable itself from an async function would unwrap it and lose the helpers.
  return { getPathname: () => r.getPathname() };
}

afterEach(() => {
  jest.useRealTimers(); // renderRouter enables fake timers
});

function seedEmployeeSession() {
  secureStore().set(SESSION_STORAGE_KEYS.refreshToken, 'refresh-0');
  secureStore().set(
    SESSION_STORAGE_KEYS.snapshot,
    JSON.stringify(toSnapshot({ _id: 'user-a', name: 'Asha Rao', email: '', role: 'employee', departmentId: 'dep-1' })),
  );
}

beforeEach(() => {
  resetAuthWorld();
  mockFetch((call) =>
    call.path === '/api/auth/mobile/refresh' ? jsonResponse(200, authResponse('1')) : jsonResponse(404, { success: false }),
  );
});

describe('routing guards (real src/app tree)', () => {
  it('signed out: "/" and protected deep links go to /login', async () => {
    const r = await open('/employee/team');
    await waitFor(() => expect(r.getPathname()).toBe('/login'));
    expect(await screen.findByTestId('login-submit')).toBeTruthy();
  });

  it('employee session: "/" routes to the employee home', async () => {
    seedEmployeeSession();
    const r = await open('/');
    await waitFor(() => expect(r.getPathname()).toBe('/employee'));
  });

  it("employee deep-linking into an admin screen is redirected to their own home (admin screen never renders)", async () => {
    seedEmployeeSession();
    const r = await open('/admin/people');
    await waitFor(() => expect(r.getPathname()).toBe('/employee'));
    expect(screen.queryByText('People')).toBeNull();
  });
});
