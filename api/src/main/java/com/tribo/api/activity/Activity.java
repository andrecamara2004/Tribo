package com.tribo.api.activity;

import java.time.Instant;
import java.util.List;

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
