package com.tribo.api.activity;

import java.time.Instant;

public record Review(
                String id,
                String activityId,
                String userId,
                int rating,
                String comment,
                Instant createdAt) {
}