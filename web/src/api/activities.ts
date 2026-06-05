// src/api/activities.ts
//
// Activity Management API (Sprint 2). Thin wrappers over apiFetch — the auth
// interceptor (W-2) attaches the access token and handles refresh-on-401, so
// these are just typed calls.

import { apiFetch } from "./http";

export type ActivityStatus = "DRAFT" | "PUBLISHED" | "CANCELLED";
export type EventKind = "RUN" | "VOLUNTEER";
export type VerifiedBy = "PEER" | "PARTNER";
export type ParticipationRole = "PARTICIPANT" | "STAFF";

export interface Activity {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  category: string;
  location: string;
  startsAt: string; // ISO-8601
  endsAt: string; // ISO-8601
  capacity: number;
  status: ActivityStatus;
  createdAt: string;
  updatedAt: string;

  // volunteer-event extensions (D-6)
  eventKind: EventKind;
  host: string;
  distanceKm: number;
  verifiedBy: VerifiedBy;
  staffCapacity: number;
  pointsParticipant: number;
  pointsStaff: number;
  tags: string[];
  latitude: number | null;
  longitude: number | null;

  // derived — present only on read views (GET list / detail), not on create/edit
  participantsJoined?: number;
  staffJoined?: number;
  userRole?: ParticipationRole | null;
}

/** Body for create + edit. Server ignores any id/owner/status sent. */
export interface ActivityInput {
  title: string;
  description?: string;
  category?: string;
  location?: string;
  startsAt: string; // ISO-8601
  endsAt: string; // ISO-8601
  capacity: number;
  // volunteer-event extensions (optional)
  eventKind?: EventKind;
  host?: string;
  distanceKm?: number;
  verifiedBy?: VerifiedBy;
  staffCapacity?: number;
  pointsParticipant?: number;
  pointsStaff?: number;
  tags?: string[];
  latitude?: number;
  longitude?: number;
}

export interface ActivityPage {
  items: Activity[];
  nextCursor: string | null;
}

export interface Participant {
  userId: string;
  joinedAt: string;
  role?: ParticipationRole;
}

export interface Roster {
  activityId: string;
  count: number;
  participants: Participant[];
}

/** GET /activities — catalog/discovery, with optional status filter + paging. */
export async function listActivities(opts: {
  status?: ActivityStatus | "ALL";
  limit?: number;
  cursor?: string | null;
} = {}): Promise<ActivityPage> {
  const params = new URLSearchParams();
  if (opts.status) params.set("status", opts.status);
  if (opts.limit) params.set("limit", String(opts.limit));
  if (opts.cursor) params.set("cursor", opts.cursor);
  const qs = params.toString();
  const page = await apiFetch<ActivityPage>(`/activities${qs ? `?${qs}` : ""}`);
  return page ?? { items: [], nextCursor: null };
}

/** GET /activities/{id} — detail. */
export async function getActivity(id: string): Promise<Activity> {
  const a = await apiFetch<Activity>(`/activities/${id}`);
  if (!a) throw new Error("Activity not found.");
  return a;
}

/** POST /activities — create (verified ACTIVITY_MANAGER/PARTNER/SYSADMIN). */
export async function createActivity(input: ActivityInput): Promise<Activity> {
  const a = await apiFetch<Activity>("/activities", {
    method: "POST",
    body: JSON.stringify(input),
  });
  if (!a) throw new Error("Create returned no body.");
  return a;
}

/** PUT /activities/{id} — owner-only edit. */
export async function updateActivity(id: string, input: ActivityInput): Promise<Activity> {
  const a = await apiFetch<Activity>(`/activities/${id}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
  if (!a) throw new Error("Update returned no body.");
  return a;
}

/** POST /activities/{id}/cancel — owner-only soft cancel. */
export async function cancelActivity(id: string): Promise<Activity> {
  const a = await apiFetch<Activity>(`/activities/${id}/cancel`, { method: "POST" });
  if (!a) throw new Error("Cancel returned no body.");
  return a;
}

/** POST /activities/{id}/participants — the caller joins in the given role. */
export async function joinActivity(id: string, role: "participant" | "staff" = "participant"): Promise<void> {
  await apiFetch(`/activities/${id}/participants?role=${role}`, { method: "POST" });
}

/** DELETE /activities/{id}/participants/me — the caller withdraws (idempotent). */
export async function withdrawFromActivity(id: string): Promise<void> {
  await apiFetch(`/activities/${id}/participants/me`, { method: "DELETE" });
}

/** GET /activities/{id}/participants — owner/privileged roster. */
export async function getRoster(id: string): Promise<Roster> {
  const r = await apiFetch<Roster>(`/activities/${id}/participants`);
  return r ?? { activityId: id, count: 0, participants: [] };
}
