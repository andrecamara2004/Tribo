package com.tribo.api.activity;

/**
 * Request body for creating and updating an activity.
 *
 * Mutable POJO for Jackson (same rationale as RegisterRequest). Dates are
 * ISO-8601 instant strings (e.g. "2026-07-01T18:00:00Z") and parsed/validated
 * in the resource. `ownerId`, `status`, and timestamps are NEVER taken from the
 * client — they're server-controlled.
 */
public class ActivityRequest {
    public String title;
    public String description;
    public String category;
    public String location;
    public String startsAt;   // ISO-8601 instant
    public String endsAt;     // ISO-8601 instant
    public Integer capacity;  // boxed so missing → null → 400 (not silently 0)
}
