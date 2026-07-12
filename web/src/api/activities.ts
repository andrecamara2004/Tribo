// src/api/activities.ts

import { apiFetch } from "./http";

export type ActivityStatus =
  | "DRAFT"
  | "PENDING_APPROVAL"
  | "PUBLISHED"
  | "REJECTED"
  | "CANCELLED";

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
  startsAt: string;
  endsAt: string;
  capacity: number;
  status: ActivityStatus;
  createdAt: string;
  updatedAt: string;

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

  // NEW
  averageRating?: number;
  reviewCount?: number;

  // derived
  participantsJoined?: number;
  staffJoined?: number;
  userRole?: ParticipationRole | null;
}

export interface ActivityInput {
  title: string;
  description?: string;
  category?: string;
  location?: string;
  startsAt: string;
  endsAt: string;
  capacity: number;

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

/* -------------------------------------------------------------------------- */
/* Reviews                                                                     */
/* -------------------------------------------------------------------------- */

export interface Review {
  id: string;
  activityId: string;
  userId: string;
  rating: number;
  comment: string;
  createdAt: string;
}

export interface ReviewRequest {
  rating: number;
  comment?: string;
}

export interface ReviewResponse {
  activityId: string;
  averageRating: number;
  reviewCount: number;
  reviews: Review[];
}

/* -------------------------------------------------------------------------- */
/* Activities                                                                  */
/* -------------------------------------------------------------------------- */

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

  const page = await apiFetch<ActivityPage>(
    `/activities${qs ? `?${qs}` : ""}`
  );

  return page ?? { items: [], nextCursor: null };
}

export async function getActivity(id: string): Promise<Activity> {
  const a = await apiFetch<Activity>(`/activities/${id}`);

  if (!a) throw new Error("Activity not found.");

  return a;
}

export async function createActivity(
  input: ActivityInput
): Promise<Activity> {
  const a = await apiFetch<Activity>("/activities", {
    method: "POST",
    body: JSON.stringify(input),
  });

  if (!a) throw new Error("Create returned no body.");

  return a;
}

export async function updateActivity(
  id: string,
  input: ActivityInput
): Promise<Activity> {
  const a = await apiFetch<Activity>(`/activities/${id}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });

  if (!a) throw new Error("Update returned no body.");

  return a;
}

export async function cancelActivity(id: string): Promise<Activity> {
  const a = await apiFetch<Activity>(
    `/activities/${id}/cancel`,
    { method: "POST" }
  );

  if (!a) throw new Error("Cancel returned no body.");

  return a;
}

export async function approveActivity(id: string): Promise<Activity> {
  const a = await apiFetch<Activity>(
    `/activities/${id}/approve`,
    { method: "POST" }
  );

  if (!a) throw new Error("Approve returned no body.");

  return a;
}

export async function rejectActivity(id: string): Promise<Activity> {
  const a = await apiFetch<Activity>(
    `/activities/${id}/reject`,
    { method: "POST" }
  );

  if (!a) throw new Error("Reject returned no body.");

  return a;
}

export async function joinActivity(
  id: string,
  role: "participant" | "staff" = "participant"
): Promise<void> {
  await apiFetch(
    `/activities/${id}/participants?role=${role}`,
    { method: "POST" }
  );
}

export async function withdrawFromActivity(
  id: string
): Promise<void> {
  await apiFetch(
    `/activities/${id}/participants/me`,
    { method: "DELETE" }
  );
}

export async function getRoster(id: string): Promise<Roster> {
  const r = await apiFetch<Roster>(
    `/activities/${id}/participants`
  );

  return r ?? {
    activityId: id,
    count: 0,
    participants: [],
  };
}

/* -------------------------------------------------------------------------- */
/* Reviews                                                                     */
/* -------------------------------------------------------------------------- */

export async function getReviews(
  id: string
): Promise<ReviewResponse> {

  const response = await apiFetch<ReviewResponse>(
    `/activities/${id}/reviews`
  );

  return (
    response ?? {
      activityId: id,
      averageRating: 0,
      reviewCount: 0,
      reviews: [],
    }
  );
}

export async function submitReview(
  id: string,
  review: ReviewRequest
): Promise<Review> {

  const response = await apiFetch<Review>(
    `/activities/${id}/reviews`,
    {
      method: "POST",
      body: JSON.stringify(review),
    }
  );

  if (!response) {
    throw new Error("Review submission failed.");
  }

  return response;
}