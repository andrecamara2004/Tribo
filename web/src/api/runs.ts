// src/api/runs.ts
// Runs API (Sprint 3 Phase 2). Clients post a finished run summary + per-km
// splits (D-4); the backend stores and aggregates. Stats are derived server-side.
import { apiFetch, ApiError } from "./http";

export interface Split {
  km: number;
  durationSeconds: number;
}

export interface Run {
  id: string;
  userId: string;
  title: string;
  location: string;
  distanceMeters: number;
  durationSeconds: number;
  elevationMeters: number;
  routeType: string; // river|trail|park|coast|city (cosmetic)
  startedAt: string; // ISO-8601
  createdAt: string; // ISO-8601
  splits: Split[];
}

export interface RunInput {
  title?: string;
  location?: string;
  distanceMeters: number;
  durationSeconds: number;
  elevationMeters?: number;
  routeType?: string;
  startedAt: string; // ISO-8601
  splits?: Split[];
}

export interface RunStats {
  weeklyKm: number[]; // 7 entries, Mon→Sun
  monthKm: number;
  monthRuns: number;
  avgPaceSecPerKm: number | null;
  streak: number;
}

/** POST /runs — log a finished run. */
export async function logRun(input: RunInput): Promise<Run> {
  const r = await apiFetch<Run>("/runs", { method: "POST", body: JSON.stringify(input) });
  if (!r) throw new Error("Log run returned no body.");
  return r;
}

/** GET /runs?scope=me|clan — newest first. */
export async function listRuns(scope: "me" | "clan" = "me"): Promise<Run[]> {
  const page = await apiFetch<{ items: Run[] }>(`/runs?scope=${scope}`);
  return page?.items ?? [];
}

/** GET /runs/{id}. */
export async function getRun(id: string): Promise<Run> {
  const r = await apiFetch<Run>(`/runs/${id}`);
  if (!r) throw new Error("Run not found.");
  return r;
}

/** GET /runs/me/last — the caller's most recent run, or null if none logged. */
export async function getLastRun(): Promise<Run | null> {
  try {
    return await apiFetch<Run>("/runs/me/last");
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

/** GET /users/me/stats — derived running stats. */
export async function getMyStats(): Promise<RunStats> {
  const s = await apiFetch<RunStats>("/users/me/stats");
  if (!s) throw new Error("Stats returned no body.");
  return s;
}
