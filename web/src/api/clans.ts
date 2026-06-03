// src/api/clans.ts
// Clan API (Sprint 3 Phase 1). One clan per user (D-3); membership lives on the
// user, so join/leave change the caller's clan and are reflected by getMe().
import { apiFetch } from "./http";

export interface Clan {
  id: string;
  name: string;
  tag: string;
  color: string;
  ownerId: string;
  createdAt: string; // ISO-8601
  memberCount: number;
}

export interface ClanInput {
  name: string;
  tag: string;
  color: string;
}

/** GET /clans — all clans with member counts. */
export async function listClans(): Promise<Clan[]> {
  const page = await apiFetch<{ items: Clan[] }>("/clans");
  return page?.items ?? [];
}

/** GET /clans/{id} — clan detail. */
export async function getClan(id: string): Promise<Clan> {
  const c = await apiFetch<Clan>(`/clans/${id}`);
  if (!c) throw new Error("Clan not found.");
  return c;
}

/** POST /clans — create a clan; the caller auto-joins as owner. */
export async function createClan(input: ClanInput): Promise<Clan> {
  const c = await apiFetch<Clan>("/clans", { method: "POST", body: JSON.stringify(input) });
  if (!c) throw new Error("Create returned no body.");
  return c;
}

/** POST /clans/{id}/join — the caller joins (switches clans if already in one). */
export async function joinClan(id: string): Promise<Clan> {
  const c = await apiFetch<Clan>(`/clans/${id}/join`, { method: "POST" });
  if (!c) throw new Error("Join returned no body.");
  return c;
}

/** POST /clans/leave — the caller leaves their clan (idempotent). */
export async function leaveClan(): Promise<void> {
  await apiFetch("/clans/leave", { method: "POST" });
}

export type RankMetric = "avgPace" | "distance" | "consistency" | "impact";
export type RankPeriod = "all" | "month" | "week";

export interface ClanRankRow {
  rank: number;
  id: string;
  name: string;
  tag: string;
  color: string;
  members: number;
  totalKm: number;
  monthlyKm: number;
  weeklyKm: number;
  avgPaceSecPerKm: number | null;
  consistencyPct: number;
  volunteerPoints: number;
  volunteerEvents: number;
  trend: string;
}

export interface ClanRanking {
  metric: RankMetric;
  period: RankPeriod;
  updatedAt: string;
  clans: ClanRankRow[];
}

/** GET /clans/ranking — leaderboard for the given metric + period. */
export async function getRanking(metric: RankMetric = "avgPace", period: RankPeriod = "all"): Promise<ClanRanking> {
  const r = await apiFetch<ClanRanking>(`/clans/ranking?metric=${metric}&period=${period}`);
  return r ?? { metric, period, updatedAt: "", clans: [] };
}
