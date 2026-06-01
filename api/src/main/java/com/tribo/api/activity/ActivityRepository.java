package com.tribo.api.activity;

import com.google.cloud.datastore.Cursor;
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
import java.util.List;
import java.util.Optional;

/**
 * Datastore access for the Activity kind. Follows the UserRepository pattern:
 * UUID-string key, static Datastore client, hand-rolled entity mapping.
 *
 * LISTING & INDEXES: list() filters by an optional equality on `status`, which
 * only needs Datastore's automatic single-property index — no composite index
 * config required. We deliberately don't combine the status filter with a
 * custom sort order (that would need a composite index in datastore-indexes.xml);
 * richer sorting/filtering is a later refinement. Paging uses Datastore cursors.
 */
public class ActivityRepository {

    static final String KIND = "Activity";

    private static final Datastore DATASTORE =
            DatastoreOptions.getDefaultInstance().getService();

    private static final KeyFactory KEY_FACTORY =
            DATASTORE.newKeyFactory().setKind(KIND);

    /** Persist an activity. Overwrites any existing entity with the same id. */
    public void save(Activity a) {
        Key key = KEY_FACTORY.newKey(a.id());
        Entity entity = Entity.newBuilder(key)
                .set("ownerId", a.ownerId())
                .set("title", a.title())
                .set("description", a.description())
                .set("category", a.category())
                .set("location", a.location())
                .set("startsAt", a.startsAt().toString())
                .set("endsAt", a.endsAt().toString())
                .set("capacity", a.capacity())
                .set("status", a.status().name())
                .set("createdAt", a.createdAt().toString())
                .set("updatedAt", a.updatedAt().toString())
                .build();
        DATASTORE.put(entity);
    }

    public Optional<Activity> findById(String id) {
        Entity e = DATASTORE.get(KEY_FACTORY.newKey(id));
        return Optional.ofNullable(e).map(this::toActivity);
    }

    public void delete(String id) {
        DATASTORE.delete(KEY_FACTORY.newKey(id));
    }

    /**
     * List activities, optionally filtered by status, with cursor paging.
     *
     * @param status  if non-null, only activities in this status
     * @param limit   max items in the page (clamped to a sane range by caller)
     * @param cursor  opaque url-safe cursor from a previous page, or null to start
     */
    public ActivityPage list(ActivityStatus status, int limit, String cursor) {
        var qb = Query.newEntityQueryBuilder()
                .setKind(KIND)
                .setLimit(limit);

        if (status != null) {
            qb.setFilter(PropertyFilter.eq("status", status.name()));
        }
        if (cursor != null && !cursor.isBlank()) {
            qb.setStartCursor(Cursor.fromUrlSafe(cursor));
        }

        QueryResults<Entity> results = DATASTORE.run(qb.build());
        List<Activity> items = new ArrayList<>();
        while (results.hasNext()) {
            items.add(toActivity(results.next()));
        }

        // A cursor is only meaningful if the page was full; otherwise we've
        // reached the end and report no next page.
        String next = null;
        if (items.size() == limit) {
            Cursor after = results.getCursorAfter();
            if (after != null) next = after.toUrlSafe();
        }
        return new ActivityPage(items, next);
    }

    // --- internal mapping ----------------------------------------------------

    private Activity toActivity(Entity e) {
        return new Activity(
                e.getKey().getName(),
                e.getString("ownerId"),
                e.getString("title"),
                e.getString("description"),
                e.getString("category"),
                e.getString("location"),
                Instant.parse(e.getString("startsAt")),
                Instant.parse(e.getString("endsAt")),
                (int) e.getLong("capacity"),
                ActivityStatus.valueOf(e.getString("status")),
                Instant.parse(e.getString("createdAt")),
                Instant.parse(e.getString("updatedAt"))
        );
    }
}
