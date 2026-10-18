import { fireEvent, screen } from '@testing-library/react-native';

import { LoginScreen } from '@/features/auth/LoginScreen';
import { jsonResponse, mockFetch } from '@/testing/fetchMock';
import { renderWithProviders } from '@/testing/renderWithProviders';
import { resetAuthWorld } from '@/testing/resetSession';

beforeEach(() => resetAuthWorld());

describe('LoginScreen', () => {
  it('renders the form and validates empty fields without calling the server', async () => {
    const calls = mockFetch(() => jsonResponse(500, {}));
    await renderWithProviders(<LoginScreen />);
    expect(await screen.findByLabelText('Email')).toBeTruthy();
    expect(screen.getByLabelText('Password')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('login-submit'));
    expect(await screen.findByText('Enter your email address.')).toBeTruthy();
    expect(screen.getByText('Enter your password.')).toBeTruthy();
    expect(calls).toHaveLength(0);
  });

  it('shows the server error for invalid credentials and does not store anything', async () => {
    const calls = mockFetch(() =>
      jsonResponse(401, { success: false, error: 'Invalid email or password', code: 'INVALID_CREDENTIALS' }),
    );
    await renderWithProviders(<LoginScreen />);
    await fireEvent.changeText(await screen.findByLabelText('Email'), 'asha@example.com');
    await fireEvent.changeText(screen.getByLabelText('Password'), 'wrong-password');
    await fireEvent.press(screen.getByTestId('login-submit'));
    expect(await screen.findByText('The email or password is incorrect.')).toBeTruthy();
    const loginCalls = calls.filter((c) => c.path === '/api/auth/mobile/login');
    expect(loginCalls).toHaveLength(1);
    expect(loginCalls[0].body).toMatchObject({ email: 'asha@example.com', password: 'wrong-password' });
    expect(loginCalls[0].headers.Authorization).toBeUndefined();
  });

  it('maps network failures to an offline message', async () => {
    (globalThis as unknown as { fetch: unknown }).fetch = jest.fn(() => Promise.reject(new TypeError('Network request failed')));
    await renderWithProviders(<LoginScreen />);
    await fireEvent.changeText(await screen.findByLabelText('Email'), 'asha@example.com');
    await fireEvent.changeText(screen.getByLabelText('Password'), 'secret123');
    await fireEvent.press(screen.getByTestId('login-submit'));
    expect(await screen.findByText(/Can't reach the server/)).toBeTruthy();
  });
});
