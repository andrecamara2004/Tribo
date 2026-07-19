// src/auth/AuthContext.tsx
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import * as authApi from "../api/auth";
import type { CurrentUser, RegisterInput, RegisterResult } from "../api/auth";
import { getMe, type Me } from "../api/users";
import { refreshAccessToken } from "../api/http";
import { hasPersistedSession } from "./tokenStore";

interface AuthContextValue {
  user: CurrentUser | null;
  profile: Me | null; // full DB-backed profile (name, clan, …); null until loaded
  loading: boolean; // true during the initial session bootstrap
  login: (email: string, password: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<RegisterResult>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>; // re-fetch /users/me (e.g. after a clan change)
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [profile, setProfile] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  // Best-effort profile load. Identity (user) is the source of truth for auth;
  // the profile is display-only, so a failure here never blocks the session.
  async function loadProfile() {
    try {
      const p = await getMe();
      setProfile(p);
      // Apply theme
      if (p.themePreference) {
        localStorage.setItem("theme", p.themePreference);
        if (p.themePreference === "DARK") {
          document.documentElement.setAttribute("data-theme", "dark");
        } else {
          document.documentElement.removeAttribute("data-theme");
        }
      }
    } catch {
      setProfile(null);
    }
  }

  // Restore theme on boot from localStorage ONLY if we have a session
  useEffect(() => {
    if (hasPersistedSession()) {
      const saved = localStorage.getItem("theme");
      if (saved === "DARK") {
        document.documentElement.setAttribute("data-theme", "dark");
      }
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
  }, []);

  // On load: if a refresh token persisted, re-establish the session. We mint a
  // fresh access token FIRST (from the persisted refresh token), then whoami()
  // — so the identity probe carries a valid token instead of firing a noisy
  // (though recoverable) 401. If the refresh fails, whoami still triggers
  // apiFetch's reactive refresh as a fallback.
  useEffect(() => {
    async function boot() {
      if (!hasPersistedSession()) {
        setLoading(false);
        return;
      }
      try {
        await refreshAccessToken();
        const me = await authApi.whoami();
        setUser(me);
        loadProfile(); // best-effort load
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    }
    boot();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function login(email: string, pass: string) {
    const me = await authApi.login(email, pass);
    setUser(me);
    await loadProfile();
  }

  // Register does NOT log in — the account must confirm its email first. We
  // surface the result so the page can show a "check your email" message.
  async function register(input: RegisterInput) {
    return authApi.register(input);
  }

  async function logout() {
    await authApi.logout();
    setUser(null);
    setProfile(null);
    localStorage.removeItem("theme");
    document.documentElement.removeAttribute("data-theme");
  }

  return (
    <AuthContext.Provider
      value={{ user, profile, loading, login, register, logout, refreshProfile: loadProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
