package com.tribo.api.clan;

import java.time.Instant;

/**
 * Domain model for a clan — the team a runner belongs to (D-3).
 *
 * Immutable record, mirroring the Activity/User pattern: pure Java,
 * Jackson-serializable, with the Datastore kind + property mapping living in
 * ClanRepository.
 *
 * ownerId — the user id of the creator (set server-side from the JWT).
 * tag — short uppercase label, 2–5 chars (e.g. "FOR").
 * color — hex string "#RRGGBB", used cosmetically by the clients.
 *
 * A clan has no secret fields, so it's returned to clients as-is. The
 * derived member count is NOT stored on the entity — resources compute it via
 * UserRepository.countByClan and surface it separately (see ClanResource).
 */
public record Clan(
                String id, // UUID string, also the entity key
                String name,
                String tag,
                String color,
                String ownerId,
                Instant createdAt,
                String pictureUrl) {
}
