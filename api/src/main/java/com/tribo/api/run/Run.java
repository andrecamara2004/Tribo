package com.tribo.api.run;

import java.time.Instant;
import java.util.List;

//Model for a run
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
