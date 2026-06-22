package com.tribo.api.activity;

/**
 * Request body for creating and updating an activity.
 *
 * Mutable POJO for Jackson (same rationale as RegisterRequest). Dates are
 * ISO-8601 instant strings (e.g. "2026-07-01T18:00:00Z") and parsed/validated
 * in the resource. `ownerId`, `status`, and timestamps are NEVER taken from the
 * client — they're server-controlled.
 */
import java.util.List;

public class ActivityRequest {
    public String title;
    public String description;
    public String category;
    public String location;
    public String startsAt;   // ISO-8601 instant
    public String endsAt;     // ISO-8601 instant
    public Integer capacity;  // boxed so missing → null → 400 (not silently 0)

    // --- volunteer-event extensions (D-6); all optional -----------------------
    public String eventKind;          // RUN (default) | VOLUNTEER
    public String host;
    public Double distanceKm;
    public String verifiedBy;         // PEER (default) | PARTNER
    public Integer staffCapacity;
    public Integer pointsParticipant;
    public Integer pointsStaff;
    public List<String> tags;
    public Double latitude;   // optional location pin for the map
    public Double longitude;
}
