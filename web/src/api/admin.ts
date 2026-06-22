// src/api/admin.ts
// Backoffice/admin API (BACKOFFICE/SYSADMIN only). Platform statistics; the
// pending-approval queue reuses listActivities({ status: "PENDING_APPROVAL" }).
import { apiFetch } from "./http";

export interface PlatformStats {
  totalUsers: number;
  totalActivities: number;
  volunteerEvents: number;
  totalRuns: number;
}

/** GET /admin/stats — aggregate platform counts. */
export async function getPlatformStats(): Promise<PlatformStats> {
  const s = await apiFetch<PlatformStats>("/admin/stats");
  return s ?? { totalUsers: 0, totalActivities: 0, volunteerEvents: 0, totalRuns: 0 };
}

export interface AdminUser {
  userId: string;
  email: string;
  fullName: string;
  role: string;
  verified: boolean;
  suspended: boolean;
  createdAt: string;
}

/** GET /users — list all users (backoffice). */
export async function listUsers(): Promise<AdminUser[]> {
  const page = await apiFetch<{ items: AdminUser[] }>("/users");
  return page?.items ?? [];
}

/** POST /users/{id}/verify — clear a self-registered manager/partner. */
export async function verifyUser(id: string): Promise<void> {
  await apiFetch(`/users/${id}/verify`, { method: "POST" });
}

/** POST /users/{id}/suspend — disable an account (blocks login). */
export async function suspendUser(id: string): Promise<void> {
  await apiFetch(`/users/${id}/suspend`, { method: "POST" });
}

/** POST /users/{id}/unsuspend — re-enable a suspended account. */
export async function unsuspendUser(id: string): Promise<void> {
  await apiFetch(`/users/${id}/unsuspend`, { method: "POST" });
}
