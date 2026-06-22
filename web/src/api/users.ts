// src/api/users.ts
// User profile API (Sprint 3). GET /users/me is the DB-backed profile read,
// distinct from the cheap /ping-auth/whoami identity probe used for bootstrap.
import { apiFetch } from "./http";

export interface ClanRef {
  id: string;
  name: string;
  tag: string;
  color: string;
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

/** PUT /users/me/goal — set the weekly distance goal (0 clears). */
export async function setWeeklyGoal(weeklyGoalKm: number): Promise<Me> {
  const me = await apiFetch<Me>("/users/me/goal", { method: "PUT", body: JSON.stringify({ weeklyGoalKm }) });
  if (!me) throw new Error("Set goal returned no body.");
  return me;
}
