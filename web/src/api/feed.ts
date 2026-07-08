// src/api/feed.ts
// Activity feed (Sprint 3 Phase 4) + minimal kudos. Items are a union of runs
// and volunteer joins sharing a common head; itemId is opaque (URL-encoded for
// kudos calls since volunteer ids contain ':').
import { apiFetch } from "./http";

export interface FeedAuthor {
  userId: string;
  name: string;
  clanName: string | null;
  color: string;
  pictureUrl?: string;
}

export interface FeedItem {
  id: string;
  type: "run" | "volunteer";
  when: string; // ISO-8601
  author: FeedAuthor;
  title: string;
  location: string;
  kudosCount: number;
  likedByMe: boolean;
  commentCount: number;

  // type=run
  distanceKm?: number;
  durationSeconds?: number;
  paceSecPerKm?: number;
  elevationMeters?: number;
  routeType?: string;

  // type=volunteer
  role?: "PARTICIPANT" | "STAFF";
  pointsEarned?: number;
  verifiedBy?: "PEER" | "PARTNER";
}

/** GET /feed?scope=all|clan — newest first. */
export async function getFeed(scope: "all" | "clan" = "all"): Promise<FeedItem[]> {
  const page = await apiFetch<{ items: FeedItem[] }>(`/feed?scope=${scope}`);
  return page?.items ?? [];
}

/** POST /feed/{itemId}/kudos — like. */
export async function likeItem(itemId: string): Promise<{ kudosCount: number; likedByMe: boolean }> {
  const r = await apiFetch<{ kudosCount: number; likedByMe: boolean }>(
    `/feed/${encodeURIComponent(itemId)}/kudos`,
    { method: "POST" },
  );
  return r ?? { kudosCount: 0, likedByMe: false };
}

/** DELETE /feed/{itemId}/kudos — unlike. */
export async function unlikeItem(itemId: string): Promise<void> {
  await apiFetch(`/feed/${encodeURIComponent(itemId)}/kudos`, { method: "DELETE" });
}

export interface Comment {
  id: string;
  text: string;
  createdAt: string;
  author: FeedAuthor;
}

/** GET /feed/{itemId}/comments — oldest first. */
export async function getComments(itemId: string): Promise<Comment[]> {
  const page = await apiFetch<{ items: Comment[] }>(`/feed/${encodeURIComponent(itemId)}/comments`);
  return page?.items ?? [];
}

/** POST /feed/{itemId}/comments. */
export async function addComment(itemId: string, text: string): Promise<Comment> {
  const c = await apiFetch<Comment>(`/feed/${encodeURIComponent(itemId)}/comments`, {
    method: "POST",
    body: JSON.stringify({ text }),
  });
  if (!c) throw new Error("Comment returned no body.");
  return c;
}

/** DELETE /feed/{itemId}/comments/{commentId}. */
export async function deleteComment(itemId: string, commentId: string): Promise<void> {
  await apiFetch(`/feed/${encodeURIComponent(itemId)}/comments/${commentId}`, { method: "DELETE" });
}
