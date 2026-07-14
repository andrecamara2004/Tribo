// src/api/auth.ts
import { apiFetch } from "./http";
import {
  setSession,
  clearSession,
  getRefreshToken,
  type LoginTokens,
} from "../auth/tokenStore";

export interface RegisterInput {
  email: string;
  password: string;
  fullName: string;
  phoneNumber: string;
  age: number;
  role?: string;
}

export interface CurrentUser {
  userId: string;
  role: string;
  verified?: boolean;
}

/** POST /auth/login — stores the session and returns the user identity. */
export async function login(email: string, password: string): Promise<CurrentUser> {
  const tokens = await apiFetch<LoginTokens>("/auth/login", {
    method: "POST",
    skipAuth: true,
    body: JSON.stringify({ email, password }),
  });

  if (!tokens) {
    throw new Error("Login returned no body.");
  }

  setSession(tokens);
  return {
    userId: tokens.userId,
    role: tokens.role,
    verified: tokens.verified,
  };
}

/** POST /auth/register — creates the account only, no auto-login. */
export async function register(input: RegisterInput): Promise<void> {
  await apiFetch("/auth/register", {
    method: "POST",
    skipAuth: true,
    body: JSON.stringify(input),
  });
}

/** POST /auth/logout — revokes the refresh token, then clears local session. */
export async function logout(): Promise<void> {
  const refreshToken = getRefreshToken();

  if (refreshToken) {
    try {
      await apiFetch("/auth/logout", {
        method: "POST",
        skipAuth: true,
        body: JSON.stringify({ refreshToken }),
      });
    } catch {
      // Even if the server call fails, clear locally — the user wants out.
    }
  }

  clearSession();
}

/** GET /ping-auth/whoami — used to bootstrap a session on page load. */
export async function whoami(): Promise<CurrentUser> {
  const user = await apiFetch<CurrentUser>("/ping-auth/whoami");

  if (!user) {
    throw new Error("whoami returned no body.");
  }

  return user;
}