package com.tribo.api.run;

import java.time.Instant;
import java.util.List;

/**
 * Domain model for a logged run (Sprint 3 Phase 2, D-4).
 *
 * Immutable record mirroring the Activity/User pattern. Clients post a finished
 * run summary; there is no server-side GPS. Distances and durations are stored
 * as integers (metres, seconds) — the source of truth — and clients derive km
 * and pace for display.
 *
 *   userId    — the owner, set server-side from the JWT (never from the body).
 *   routeType — cosmetic label for the route sketch (river|trail|park|coast|city).
 *   splits    — optional per-km entries; durationSeconds is the time for that km.
 */
public record Run(
        String id,                  // UUID string, also the entity key
        String userId,
        String title,
        String location,
        int distanceMeters,
        int durationSeconds,
        int elevationMeters,
        String routeType,
        Instant startedAt,
        Instant createdAt,
        List<Split> splits
) {
    /** One per-kilometre split: the time taken to run kilometre {@code km}. */
    public record Split(int km, int durationSeconds) {
    }
}
