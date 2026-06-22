// src/auth/tokenStore.ts

/**
 * W-1 — Token storage for the web client.
 *
 * STRATEGY (course-project pragmatic, no backend changes):
 *   - access token  → in MEMORY only (module variable). Never persisted, so a
 *     successful XSS can't read it from disk; it dies with the tab.
 *   - refresh token → localStorage, so a page reload can silently re-establish
 *     a session by calling /auth/refresh (W-2 does this on bootstrap).
 *
 * HARDENING PATH (not now): move the refresh token into an httpOnly cookie set
 * by /auth/login on the backend. The JS would then hold ONLY the access token
 * in memory and never see the refresh token at all. That needs backend changes
 * (set/read cookies in AuthResource + JwtAuthFilter), so it's deferred.
 *
 * This module is intentionally framework-agnostic — no React. The HTTP wrapper
 * (W-2) and the auth context (W-3) read/write through these functions so token
 * handling lives in exactly one place.
 */

const REFRESH_TOKEN_KEY = "tribo.refreshToken";

// In-memory access token. Reset on every page load (that's the point).
let accessToken: string | null = null;

/** The shape /auth/login returns (matches the backend response body). */
export interface LoginTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // seconds until the access token expires
  userId: string;
  role: string;
  verified: boolean; // whether the account is cleared to act in its role (D-1)
}

// --- access token (memory) -------------------------------------------------

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

// --- refresh token (localStorage) ------------------------------------------

export function getRefreshToken(): string | null {
  try {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  } catch {
    // localStorage can throw in private-mode / blocked-cookie browsers.
    return null;
  }
}

function setRefreshToken(token: string | null): void {
  try {
    if (token === null) {
      localStorage.removeItem(REFRESH_TOKEN_KEY);
    } else {
      localStorage.setItem(REFRESH_TOKEN_KEY, token);
    }
  } catch {
    // Best-effort; if storage is unavailable the session just won't survive reload.
  }
}

// --- lifecycle --------------------------------------------------------------

/** Call after a successful login: stash both tokens. */
export function setSession(tokens: LoginTokens): void {
  setAccessToken(tokens.accessToken);
  setRefreshToken(tokens.refreshToken);
}

/** Call after a successful /auth/refresh: only the access token changes. */
export function updateAccessToken(token: string): void {
  setAccessToken(token);
}

/** Call on logout (or when refresh fails): wipe everything. */
export function clearSession(): void {
  setAccessToken(null);
  setRefreshToken(null);
}

/** True if we have a refresh token to attempt a session bootstrap on load. */
export function hasPersistedSession(): boolean {
  return getRefreshToken() !== null;
}