import { ApiError } from './errors';

let overrideBaseUrl: string | null = null;

/** Test-only: force a base URL (pass null to restore env behaviour). */
export function __setApiBaseUrlForTests(url: string | null): void {
  overrideBaseUrl = url;
}

function isDevBuild(): boolean {
  return typeof __DEV__ !== 'undefined' ? __DEV__ : process.env.NODE_ENV !== 'production';
}

/**
 * Local emulator/LAN test builds only: http is accepted in a release build when
 * EXPO_PUBLIC_ALLOW_INSECURE_LOCAL_API=true AND the host is loopback, the Android emulator
 * host alias (10.0.2.2) or a private LAN address. Public hosts always require https.
 */
export function isAllowedLocalTestUrl(value: string): boolean {
  // NOTE: written literally so Expo inlines it at build time.
  if (process.env.EXPO_PUBLIC_ALLOW_INSECURE_LOCAL_API !== 'true') return false;
  const match = /^http:\/\/([^/:]+)/i.exec(value);
  if (!match) return false;
  const host = match[1];
  return (
    host === 'localhost' ||
    host === '10.0.2.2' ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  );
}

/**
 * Base URL of the backend, from EXPO_PUBLIC_API_URL (inlined at build time).
 * Throws ApiError(kind 'config') when missing, malformed, or not https in a production build.
 */
export function getApiBaseUrl(): string {
  // NOTE: must be written literally as process.env.EXPO_PUBLIC_API_URL so Expo can inline it.
  const raw = overrideBaseUrl ?? process.env.EXPO_PUBLIC_API_URL;
  const value = (raw ?? '').trim().replace(/\/+$/, '');
  if (!value) {
    throw new ApiError({
      kind: 'config',
      message: 'The app is not configured: EXPO_PUBLIC_API_URL is missing. Copy .env.example to .env and set it.',
    });
  }
  if (!/^https?:\/\/[^\s/]+/i.test(value)) {
    throw new ApiError({ kind: 'config', message: `EXPO_PUBLIC_API_URL is not a valid http(s) URL.` });
  }
  if (!isDevBuild() && !/^https:\/\//i.test(value) && !isAllowedLocalTestUrl(value)) {
    throw new ApiError({ kind: 'config', message: 'Production builds require an https EXPO_PUBLIC_API_URL.' });
  }
  return value;
}

/** Joins the base URL with an `/api/...` path and optional query params (skips null/undefined/''). */
export function buildUrl(
  path: string,
  query?: Record<string, string | number | boolean | null | undefined>,
): string {
  if (!path.startsWith('/api/')) {
    throw new ApiError({ kind: 'config', message: `API paths must start with /api/ (got "${path}")` });
  }
  let url = getApiBaseUrl() + path;
  if (query) {
    const parts: string[] = [];
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null || v === '') continue;
      parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
    }
    if (parts.length) url += (url.includes('?') ? '&' : '?') + parts.join('&');
  }
  return url;
}
