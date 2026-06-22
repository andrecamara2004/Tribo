package com.tribo.api.feed;

import java.time.Instant;

/**
 * A comment on a feed item (Phase 6). Its own Datastore kind, keyed by a UUID;
 * `itemId` (the feed item's opaque id) is an indexed property so a thread can be
 * fetched and counted by item.
 */
public record Comment(
        String id,
        String itemId,
        String userId,
        String text,
        Instant createdAt
) {
}
