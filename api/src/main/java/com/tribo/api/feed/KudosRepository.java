package com.tribo.api.feed;

import com.google.cloud.datastore.Datastore;
import com.google.cloud.datastore.DatastoreOptions;
import com.google.cloud.datastore.Entity;
import com.google.cloud.datastore.Key;
import com.google.cloud.datastore.KeyFactory;
import com.google.cloud.datastore.Query;
import com.google.cloud.datastore.QueryResults;
import com.google.cloud.datastore.StructuredQuery.PropertyFilter;

import java.time.Instant;

/**
 * Datastore access for the Kudos kind — a "like" on a feed item (D-5, minimal).
 *
 * Key is the deterministic "{itemId}:{userId}" so a user can like an item at
 * most once (a duplicate like overwrites the same key). `itemId` is the feed
 * item's opaque id (a run id, or a "{activityId}:{userId}" volunteer-join key).
 */
public class KudosRepository {

    static final String KIND = "Kudos";

    private static final Datastore DATASTORE =
            DatastoreOptions.getDefaultInstance().getService();

    private static final KeyFactory KEY_FACTORY =
            DATASTORE.newKeyFactory().setKind(KIND);

    private static String keyOf(String itemId, String userId) {
        return itemId + "::" + userId;
    }

    /** Like an item (idempotent). */
    public void add(String itemId, String userId) {
        Key key = KEY_FACTORY.newKey(keyOf(itemId, userId));
        Entity entity = Entity.newBuilder(key)
                .set("itemId", itemId)
                .set("userId", userId)
                .set("createdAt", Instant.now().toString())
                .build();
        DATASTORE.put(entity);
    }

    /** Unlike an item (idempotent). */
    public void remove(String itemId, String userId) {
        DATASTORE.delete(KEY_FACTORY.newKey(keyOf(itemId, userId)));
    }

    public boolean exists(String itemId, String userId) {
        return DATASTORE.get(KEY_FACTORY.newKey(keyOf(itemId, userId))) != null;
    }

    /** How many users have liked an item. Keys-only query. */
    public int countByItem(String itemId) {
        Query<Key> q = Query.newKeyQueryBuilder()
                .setKind(KIND)
                .setFilter(PropertyFilter.eq("itemId", itemId))
                .build();
        QueryResults<Key> results = DATASTORE.run(q);
        int n = 0;
        while (results.hasNext()) {
            results.next();
            n++;
        }
        return n;
    }
}
