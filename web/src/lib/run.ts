// src/lib/run.ts
// Pure formatting helpers over the integer Run fields (metres, seconds).
import type { Run } from "../api/runs";

/** seconds → "m:ss" (e.g. 298 → "4:58"). */
export function formatPace(secPerKm: number | null | undefined): string {
  if (secPerKm == null || !isFinite(secPerKm)) return "—";
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** seconds → "m:ss" or "h:mm:ss" for longer runs. */
export function formatDuration(totalSec: number): string {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = Math.round(totalSec % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** distance in km, one decimal. */
export function km(run: Run): number {
  return Math.round((run.distanceMeters / 1000) * 10) / 10;
}

/** overall pace in seconds per km. */
export function paceSecPerKm(run: Run): number {
  const kmDist = run.distanceMeters / 1000;
  return kmDist > 0 ? run.durationSeconds / kmDist : 0;
}
