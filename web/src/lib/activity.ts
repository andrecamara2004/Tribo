// src/lib/activity.ts
// Presentation helpers shared by the activity screens. Pure formatting over
// the real Activity fields — no derived/fake data.
import type { ActivityStatus } from "../api/activities";

/** Maps a status to a `.pill` modifier class (green default / gray / warn). */
export function statusPillClass(status: ActivityStatus): string {
  switch (status) {
    case "DRAFT": return "pill gray";
    case "PENDING_APPROVAL": return "pill warn";
    case "REJECTED": return "pill warn";
    case "CANCELLED": return "pill warn";
    default: return "pill"; // PUBLISHED — brand green
  }
}

/** Human label for a status, e.g. PUBLISHED → "Published", PENDING_APPROVAL → "Pending approval". */
export function statusLabel(status: ActivityStatus): string {
  return status
    .split("_")
    .map((w, i) => (i === 0 ? w.charAt(0) + w.slice(1).toLowerCase() : w.toLowerCase()))
    .join(" ");
}

const DATE_FMT: Intl.DateTimeFormatOptions = {
  weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
};

/** "Sat, 16 May, 08:30" */
export function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, DATE_FMT);
}
