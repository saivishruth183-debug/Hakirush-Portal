import { getErrorMessage, isApiError } from '@/services/api/errors';

/** User-facing message for a failed POST /api/auth/mobile/login. */
export function loginErrorMessage(e: unknown): string {
  if (isApiError(e)) {
    if (e.kind === 'network') return "Can't reach the server. Check your internet connection and try again.";
    if (e.kind === 'timeout') return 'The server took too long to respond. Please try again.';
    if (e.kind === 'config') return e.message;
    switch (e.code) {
      case 'INVALID_CREDENTIALS':
        return 'The email or password is incorrect.';
      case 'ACCOUNT_INACTIVE':
        return 'Your account is inactive. Please contact your administrator.';
      case 'RATE_LIMITED':
        return 'Too many sign-in attempts. Please wait a few minutes and try again.';
      case 'VALIDATION_ERROR':
        return 'Enter a valid email and password.';
      default:
        break;
    }
    if (e.status === 401) return 'The email or password is incorrect.';
    if (e.status === 429) return 'Too many sign-in attempts. Please wait a few minutes and try again.';
  }
  return getErrorMessage(e, 'Sign-in failed. Please try again.');
}
