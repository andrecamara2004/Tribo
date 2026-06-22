// src/components/ProtectedRoute.tsx
import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import type { ReactNode } from "react";

/**
 * Gates a route on authentication, and optionally on role.
 * - not logged in         → redirect to /login
 * - logged in, wrong role → redirect to /activities (no access)
 */
export function ProtectedRoute({
  children,
  roles,
}: {
  children: ReactNode;
  roles?: string[];
}) {
  const { user, loading } = useAuth();
  if (loading) return <p style={{ padding: 24 }}>Loading…</p>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/activities" replace />;
  return <>{children}</>;
}