// src/api/users.ts
// User profile API (Sprint 3). GET /users/me is the DB-backed profile read,
// distinct from the cheap /ping-auth/whoami identity probe used for bootstrap.
import { apiFetch, API_BASE } from "./http";
import { getAccessToken } from "../auth/tokenStore";

export interface ClanRef {
  id: string;
  name: string;
  tag: string;
  color: string;
  pictureUrl?: string;
}

export interface Achievement {
  icon: string;
  title: string;
  sub: string;
}

export interface Me {
  userId: string;
  email: string;
  fullName: string;
  age: number;
  role: string;
  verified: boolean;
  profileVisibility: string;
  createdAt: string; // ISO-8601
  handle: string; // derived, e.g. "@ana"
  avatarColor: string; // derived hex
  pictureUrl?: string;
  clan: ClanRef | null;
  volunteerEvents: number; // VOLUNTEER activities joined
  staffEligible: boolean; // true once volunteerEvents >= 3
  volunteerPoints: number; // credited total (derived)
  weeklyGoalKm: number; // per-user weekly distance goal; 0 = none
  achievements: Achievement[];
}

/** GET /users/me — full profile of the signed-in user. */
export async function getMe(): Promise<Me> {
  const me = await apiFetch<Me>("/users/me");
  if (!me) throw new Error("Profile read returned no body.");
  return me;
}

/** POST /users/me/picture — upload profile picture. */
export async function uploadProfilePicture(file: Blob): Promise<Me> {
  const formData = new FormData();
  formData.append("file", file, "profile.jpg");

  const token = getAccessToken();
  const headers: HeadersInit = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}/users/me/picture`, {
    method: "POST",
    headers,
    body: formData,
  });

  if (!res.ok) {
    throw new Error("Failed to upload profile picture.");
  }

  return res.json();
}

/** PUT /users/me/goal — set the weekly distance goal (0 clears). */
export async function setWeeklyGoal(weeklyGoalKm: number): Promise<Me> {
  const me = await apiFetch<Me>("/users/me/goal", { method: "PUT", body: JSON.stringify({ weeklyGoalKm }) });
  if (!me) throw new Error("Set goal returned no body.");
  return me;
}
