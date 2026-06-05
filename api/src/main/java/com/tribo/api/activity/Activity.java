package com.tribo.api.activity;

import java.time.Instant;
import java.util.List;

/**
 * Domain model for an activity (the core Sprint 2 resource).
 *
 * Immutable record, mirroring the User pattern: pure Java, Jackson-serializable,
 * with the Datastore kind + property mapping living in ActivityRepository.
 *
 * Unlike User there are no secret fields, so an Activity can be returned to
 * clients directly without a separate response DTO.
 *
 *   ownerId  — the user id of the creator (set server-side from the JWT, never
 *              from the request body). Drives the ownership checks on edit/cancel.
 *   capacity — maximum participants; 0 or negative is rejected at validation.
 *   category — free-form for now (e.g. "sports", "culture"); a controlled
 *              vocabulary can come later without a breaking change.
 */
public record Activity(
        String id,                  // UUID string, also the entity key
        String ownerId,
        String title,
        String description,
        String category,
        String location,
        Instant startsAt,
        Instant endsAt,
        int capacity,
        ActivityStatus status,
        Instant createdAt,
        Instant updatedAt,
        // --- volunteer-event extensions (D-6); defaults make a plain RUN ------
        EventKind eventKind,        // RUN (default) | VOLUNTEER
        String host,                // organising entity name (free text)
        double distanceKm,
        VerifiedBy verifiedBy,      // PEER (default) | PARTNER — a display badge
        int staffCapacity,          // staff spots (participant spots = capacity)
        int pointsParticipant,
        int pointsStaff,
        List<String> tags,
        Double latitude,           // location pin for the map; null if not set
        Double longitude
) {
}
