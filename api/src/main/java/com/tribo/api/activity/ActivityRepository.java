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
        Entity.Builder entity = Entity.newBuilder(key)
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
                // volunteer-event extensions (D-6)
                .set("eventKind", a.eventKind().name())
                .set("host", a.host())
                .set("distanceKm", a.distanceKm())
                .set("verifiedBy", a.verifiedBy().name())
                .set("staffCapacity", a.staffCapacity())
                .set("pointsParticipant", a.pointsParticipant())
                .set("pointsStaff", a.pointsStaff());

        List<com.google.cloud.datastore.Value<?>> tagValues = new ArrayList<>();
        for (String t : a.tags()) {
            tagValues.add(com.google.cloud.datastore.StringValue.of(t));
        }
        entity.set("tags", tagValues);

        // Coordinates are optional — only written when a location pin is set.
        if (a.latitude() != null && a.longitude() != null) {
            entity.set("latitude", a.latitude());
            entity.set("longitude", a.longitude());
        }

        DATASTORE.put(entity.build());
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
        // Volunteer fields are legacy-tolerant: entities created before D-6
        // simply don't have them, so we fall back to plain-RUN defaults.
        List<String> tags = new ArrayList<>();
        if (e.contains("tags")) {
            for (com.google.cloud.datastore.Value<?> v : e.getList("tags")) {
                tags.add((String) v.get());
            }
        }
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
                Instant.parse(e.getString("updatedAt")),
                e.contains("eventKind") ? EventKind.valueOf(e.getString("eventKind")) : EventKind.RUN,
                e.contains("host") ? e.getString("host") : "",
                e.contains("distanceKm") ? e.getDouble("distanceKm") : 0.0,
                e.contains("verifiedBy") ? VerifiedBy.valueOf(e.getString("verifiedBy")) : VerifiedBy.PEER,
                e.contains("staffCapacity") ? (int) e.getLong("staffCapacity") : 0,
                e.contains("pointsParticipant") ? (int) e.getLong("pointsParticipant") : 0,
                e.contains("pointsStaff") ? (int) e.getLong("pointsStaff") : 0,
                tags,
                e.contains("latitude") ? e.getDouble("latitude") : null,
                e.contains("longitude") ? e.getDouble("longitude") : null
        );
    }
}
