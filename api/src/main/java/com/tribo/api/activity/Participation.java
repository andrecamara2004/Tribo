package com.tribo.api.activity;

import java.time.Instant;

/**
 * A user's registration for an activity (B2-8).
 *
 * Its own Datastore kind rather than a list embedded on Activity: a separate
 * kind avoids write contention on the parent entity and scales to large
 * rosters. The key is a deterministic composite "{activityId}:{userId}" so a
 * user can join an activity at most once (a duplicate join overwrites the same
 * key instead of creating a second row).
 */
public record Participation(
        String activityId,
        String userId,
        Instant joinedAt,
        ParticipationRole role      // PARTICIPANT (default) | STAFF (D-6)
) {
    /** Deterministic key so (activity, user) is unique. */
    public String key() {
        return activityId + ":" + userId;
    }

    public static String keyOf(String activityId, String userId) {
        return activityId + ":" + userId;
    }
}
