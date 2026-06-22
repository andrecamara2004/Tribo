package com.tribo.api.run;

import java.util.List;

/**
 * Request body for logging a run (POST /runs).
 *
 * Mutable POJO for Jackson (same rationale as ActivityRequest). `id`, `userId`,
 * and `createdAt` are NEVER taken from the client — they're server-controlled.
 * Boxed numbers so a missing value is null (→ 400) rather than a silent 0.
 */
public class RunRequest {
    public String title;
    public String location;
    public Integer distanceMeters;
    public Integer durationSeconds;
    public Integer elevationMeters;
    public String routeType;
    public String startedAt;        // ISO-8601 instant
    public List<SplitInput> splits;

    public static class SplitInput {
        public Integer km;
        public Integer durationSeconds;
    }
}
