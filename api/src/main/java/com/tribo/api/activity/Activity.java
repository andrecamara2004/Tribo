package com.tribo.api.activity;

import java.time.Instant;
import java.util.List;

public record Activity(
                String id,
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

                // Volunteer event variables
                EventKind eventKind,
                String host,
                double distanceKm,
                VerifiedBy verifiedBy,
                int staffCapacity,
                int pointsParticipant,
                int pointsStaff,
                List<String> tags,
                Double latitude,
                Double longitude,

                // Review variables
                int reviewCount,
                double averageRating) {
}