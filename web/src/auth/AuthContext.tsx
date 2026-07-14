// src/auth/AuthContext.tsx
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import * as authApi from "../api/auth";
import type { CurrentUser, RegisterInput } from "../api/auth";
import { getMe, type Me } from "../api/users";
import { hasPersistedSession } from "./tokenStore";

interface AuthContextValue {
  user: CurrentUser | null;
  profile: Me | null; // full DB-backed profile (name, clan, …); null until loaded
  loading: boolean; // true during the initial session bootstrap
  login: (email: string, password: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
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
      setProfile(await getMe());
    } catch {
      setProfile(null);
    }
  }

  // On load: if a refresh token persisted, try to re-establish the session.
  // whoami() will 401 (no access token in memory yet), which makes apiFetch
  // refresh using the persisted refresh token and retry — that IS the bootstrap.
  useEffect(() => {
    let cancelled = false;
    async function bootstrap() {
      if (!hasPersistedSession()) {
        setLoading(false);
        return;
      }
      try {
        const me = await authApi.whoami();
        if (cancelled) return;
        setUser(me);
        await loadProfile();
      } catch {
        if (!cancelled) setUser(null); // refresh failed → not logged in
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  async function login(email: string, password: string) {
    setUser(await authApi.login(email, password));
    await loadProfile();
  }

  async function register(input: RegisterInput) {
    await authApi.register(input);
  }

  async function logout() {
    await authApi.logout();
    setUser(null);
    setProfile(null);
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
