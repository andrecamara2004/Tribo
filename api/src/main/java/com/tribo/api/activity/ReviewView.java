package com.tribo.api.activity;

import java.time.Instant;

public record ReviewView(
                String id,
                String activityId,
                String userId,
                String userName,
                int rating,
                String comment,
                Instant createdAt) {
}