// src/api/auth.ts
import { apiFetch } from "./http";
import { setSession, clearSession, getRefreshToken, type LoginTokens } from "../auth/tokenStore";

export interface RegisterInput {
  email: string;
  password: string;
  fullName: string;
  phoneNumber: string;
  birthDate: string; // ISO date "YYYY-MM-DD"; age is derived server-side
  role?: string; // optional self-selected role (D-1); omit → END_USER
}

export interface CurrentUser {
  userId: string;
  role: string;
  verified?: boolean; // known after login/register; undefined after a whoami bootstrap
}

export interface RegisterResult {
  email: string;
  emailVerified: boolean;
  message: string;
}

export interface PasswordPolicy {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireDigit: boolean;
  requireSpecial: boolean;
  rules: string[];
}

/** POST /auth/login — stores the session and returns the user identity. */
export async function login(email: string, password: string): Promise<CurrentUser> {
  const tokens = await apiFetch<LoginTokens>("/auth/login", {
    method: "POST",
    skipAuth: true,
    body: JSON.stringify({ email, password }),
  });
  if (!tokens) throw new Error("Login returned no body.");
  setSession(tokens);
  return { userId: tokens.userId, role: tokens.role, verified: tokens.verified };
}

/**
 * POST /auth/register. Does NOT log in: the account must confirm its email
 * before login is allowed, so we return the verification status/message.
 */
export async function register(input: RegisterInput): Promise<RegisterResult> {
  const res = await apiFetch<RegisterResult>("/auth/register", {
    method: "POST",
    skipAuth: true,
    body: JSON.stringify(input),
  });
  return {
    email: res?.email ?? input.email,
    emailVerified: res?.emailVerified ?? false,
    message: res?.message ?? "Account created. Check your email to confirm it before logging in.",
  };
}

/** POST /auth/verify-email — confirm the email from the link's token. */
export async function verifyEmail(token: string): Promise<string> {
  const res = await apiFetch<{ message: string }>("/auth/verify-email", {
    method: "POST",
    skipAuth: true,
    body: JSON.stringify({ token }),
  });
  return res?.message ?? "Email confirmed. You can now log in.";
}

/** POST /auth/resend-verification — re-send the confirmation link. */
export async function resendVerification(email: string): Promise<string> {
  const res = await apiFetch<{ message: string }>("/auth/resend-verification", {
    method: "POST",
    skipAuth: true,
    body: JSON.stringify({ email }),
  });
  return res?.message ?? "If that account exists and is unverified, a new link has been sent.";
}

/** GET /auth/password-policy — the current (DB-backed) password rules. */
export async function getPasswordPolicy(): Promise<PasswordPolicy> {
  const p = await apiFetch<PasswordPolicy>("/auth/password-policy", { skipAuth: true });
  return (
    p ?? {
      minLength: 8,
      requireUppercase: false,
      requireLowercase: true,
      requireDigit: true,
      requireSpecial: false,
      rules: ["At least 8 characters"],
    }
  );
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
  if (!user) throw new Error("whoami returned no body.");
  return user;
}

/** POST /auth/reset-password-request — Request a password reset link. */
export async function requestPasswordReset(email: string): Promise<string> {
  const res = await apiFetch<{ message: string }>("/auth/reset-password-request", {
    method: "POST",
    skipAuth: true,
    body: JSON.stringify({ email }),
  });
  return res?.message ?? "A password reset link has been sent.";
}

/** POST /auth/reset-password — Consume token and set new password. */
export async function resetPassword(token: string, newPassword: string): Promise<string> {
  const res = await apiFetch<{ message: string }>("/auth/reset-password", {
    method: "POST",
    skipAuth: true,
    body: JSON.stringify({ token, newPassword }),
  });
  return res?.message ?? "Password successfully updated.";
}