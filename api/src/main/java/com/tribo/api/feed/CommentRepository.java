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
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;

/**
 * Datastore access for the Comment kind (Phase 6). Filters by an equality on
 * `itemId` (automatic single-property index) and sorts oldest-first in memory
 * to avoid a composite index — comment threads are small.
 */
public class CommentRepository {

    static final String KIND = "Comment";

    private static final Datastore DATASTORE =
            DatastoreOptions.getDefaultInstance().getService();

    private static final KeyFactory KEY_FACTORY =
            DATASTORE.newKeyFactory().setKind(KIND);

    public void save(Comment c) {
        Key key = KEY_FACTORY.newKey(c.id());
        Entity entity = Entity.newBuilder(key)
                .set("itemId", c.itemId())
                .set("userId", c.userId())
                .set("text", c.text())
                .set("createdAt", c.createdAt().toString())
                .build();
        DATASTORE.put(entity);
    }

    public Optional<Comment> findById(String id) {
        Entity e = DATASTORE.get(KEY_FACTORY.newKey(id));
        return Optional.ofNullable(e).map(this::toComment);
    }

    public void delete(String id) {
        DATASTORE.delete(KEY_FACTORY.newKey(id));
    }

    /** Comments on an item, oldest first. */
    public List<Comment> listByItem(String itemId) {
        Query<Entity> q = Query.newEntityQueryBuilder()
                .setKind(KIND)
                .setFilter(PropertyFilter.eq("itemId", itemId))
                .build();
        QueryResults<Entity> results = DATASTORE.run(q);
        List<Comment> out = new ArrayList<>();
        while (results.hasNext()) out.add(toComment(results.next()));
        out.sort(Comparator.comparing(Comment::createdAt));
        return out;
    }

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

    private Comment toComment(Entity e) {
        return new Comment(
                e.getKey().getName(),
                e.getString("itemId"),
                e.getString("userId"),
                e.getString("text"),
                Instant.parse(e.getString("createdAt"))
        );
    }
}
