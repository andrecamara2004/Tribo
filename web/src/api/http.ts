// src/api/http.ts

/**
 * W-2 — HTTP wrapper with auth interceptor.
 *
 * Every call goes through apiFetch(), which:
 *   1. attaches the in-memory access token as a Bearer header,
 *   2. on a 401, transparently calls /auth/refresh once, then retries,
 *   3. on refresh failure, clears the session (caller can redirect to login).
 *
 * SINGLE-FLIGHT REFRESH: if several requests 401 at the same time (the access
 * token expired), only the FIRST triggers a refresh; the rest await the same
 * in-flight refresh promise, then retry. This avoids a stampede of /auth/refresh
 * calls — and is essential once refresh-token rotation lands (B-8 follow-up),
 * where concurrent refreshes would invalidate each other.
 */

import {
  getAccessToken,
  getRefreshToken,
  updateAccessToken,
  clearSession,
} from "../auth/tokenStore";

// Base URL of the API. Per the foundations doc this belongs in config, not
// hardcoded — see import.meta.env usage below.
export const API_BASE = import.meta.env.VITE_API_BASE ?? "https://tribo-497810.ew.r.appspot.com/rest";

/** Thrown when a request fails; carries the status and parsed error body. */
/** Thrown when a request fails; carries the status and parsed error body. */
export class ApiError extends Error {
  status: number;
  code: string | null;

  constructor(status: number, code: string | null, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

// --- single-flight refresh state -------------------------------------------

// Holds the in-flight refresh promise, or null when no refresh is happening.
let refreshInFlight: Promise<string | null> | null = null;

/**
 * Calls /auth/refresh with the stored refresh token. Returns the new access
 * token, or null if refresh failed (no/expired/revoked refresh token).
 * De-duplicated: concurrent callers share one in-flight request.
 */
function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight !== null) {
    return refreshInFlight; // someone's already refreshing — join them
  }

  refreshInFlight = (async () => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) return null;

    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });

      if (!res.ok) {
        // Refresh token invalid/expired/revoked → session is dead.
        clearSession();
        return null;
      }

      const data = (await res.json()) as { accessToken: string };
      updateAccessToken(data.accessToken);
      return data.accessToken;
    } catch {
      clearSession();
      return null;
    } finally {
      refreshInFlight = null; // clear the gate so future 401s can refresh again
    }
  })();

  return refreshInFlight;
}

// --- main wrapper -----------------------------------------------------------

interface ApiFetchOptions extends RequestInit {
  /** Set true for public endpoints (login/register) — skips the auth header. */
  skipAuth?: boolean;
}

/**
 * Authenticated fetch. Use for all API calls.
 *
 * @param path  path under API_BASE, e.g. "/ping-auth/whoami"
 * @returns parsed JSON body (or null for 204 No Content)
 * @throws ApiError on non-2xx (after a refresh attempt for 401s)
 */
export async function apiFetch<T = unknown>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<T | null> {
  const { skipAuth, headers, ...rest } = options;

  const doRequest = async (): Promise<Response> => {
    const finalHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      ...(headers as Record<string, string>),
    };
    if (!skipAuth) {
      const token = getAccessToken();
      if (token) finalHeaders["Authorization"] = `Bearer ${token}`;
    }
    return fetch(`${API_BASE}${path}`, { ...rest, headers: finalHeaders });
  };

  let res = await doRequest();

  // On 401 for an authenticated request, try one refresh + retry.
  if (res.status === 401 && !skipAuth) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      res = await doRequest(); // retry once with the fresh token
    }
  }

  if (res.status === 204) return null;

  const body = await res.json().catch(() => null);

  if (!res.ok) {
    const err = (body as { error?: { code?: string; message?: string } })?.error;
    throw new ApiError(
      res.status,
      err?.code ?? null,
      err?.message ?? `Request failed with status ${res.status}`,
    );
  }

  return body as T;
}