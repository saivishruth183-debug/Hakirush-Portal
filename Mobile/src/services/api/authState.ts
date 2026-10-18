/**
 * In-memory auth state shared by the API client and the session provider.
 *
 * - The access token lives ONLY in memory (never persisted).
 * - The refresh token is mirrored here; SessionProvider persists it in SecureStore.
 * - `generation` increases on every logout / login / account switch. Requests remember the
 *   generation they started in and their results are discarded if it changed.
 */

interface AccessToken {
  token: string;
  /** epoch ms; 0 when unknown */
  expiresAt: number;
}

let access: AccessToken | null = null;
let refreshToken: string | null = null;
let generation = 0;

export const authState = {
  getAccessToken(): string | null {
    return access?.token ?? null;
  },
  /** True when there is no access token or it expires within `skewMs`. */
  isAccessTokenExpiring(skewMs = 30_000): boolean {
    if (!access) return true;
    if (!access.expiresAt) return false;
    return access.expiresAt - Date.now() <= skewMs;
  },
  setAccessToken(token: string | null, expiresAtIso?: string | null): void {
    if (!token) {
      access = null;
      return;
    }
    const parsed = expiresAtIso ? Date.parse(expiresAtIso) : NaN;
    access = { token, expiresAt: Number.isFinite(parsed) ? parsed : 0 };
  },
  getRefreshToken(): string | null {
    return refreshToken;
  },
  setRefreshToken(token: string | null): void {
    refreshToken = token;
  },
  getGeneration(): number {
    return generation;
  },
  /** Invalidate everything in flight (logout / account switch). Returns the new generation. */
  bumpGeneration(): number {
    generation += 1;
    return generation;
  },
  /** Clears tokens from memory (does not touch SecureStore). */
  clear(): void {
    access = null;
    refreshToken = null;
  },
};
