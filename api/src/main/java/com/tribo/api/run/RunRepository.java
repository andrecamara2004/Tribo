package com.tribo.api.run;

import com.google.cloud.datastore.Datastore;
import com.google.cloud.datastore.DatastoreOptions;
import com.google.cloud.datastore.Entity;
import com.google.cloud.datastore.EntityValue;
import com.google.cloud.datastore.FullEntity;
import com.google.cloud.datastore.Key;
import com.google.cloud.datastore.KeyFactory;
import com.google.cloud.datastore.Query;
import com.google.cloud.datastore.QueryResults;
import com.google.cloud.datastore.StructuredQuery.PropertyFilter;
import com.google.cloud.datastore.Value;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;

/**
 * Datastore access for the Run kind. Follows the Activity/User repository
 * pattern (UUID-string key, static Datastore client, hand-rolled mapping).
 *
 * Splits are stored as a list of embedded entities (the idiomatic Datastore
 * way for a small fixed-shape sub-record).
 *
 * LISTING & INDEXES: we query by an equality on `userId` (automatic
 * single-property index) and sort newest-first IN MEMORY. This deliberately
 * avoids a composite (userId, startedAt) index — run counts are small at this
 * scale. Revisit with a composite index + cursor paging if that changes.
 */
public class RunRepository {

    static final String KIND = "Run";

    private static final Datastore DATASTORE =
            DatastoreOptions.getDefaultInstance().getService();

    private static final KeyFactory KEY_FACTORY =
            DATASTORE.newKeyFactory().setKind(KIND);

    private static final Comparator<Run> NEWEST_FIRST =
            Comparator.comparing(Run::startedAt).reversed();

    /** Persist a run. Overwrites any existing entity with the same id. */
    public void save(Run r) {
        Key key = KEY_FACTORY.newKey(r.id());
        Entity.Builder entity = Entity.newBuilder(key)
                .set("userId", r.userId())
                .set("title", r.title())
                .set("location", r.location())
                .set("distanceMeters", r.distanceMeters())
                .set("durationSeconds", r.durationSeconds())
                .set("elevationMeters", r.elevationMeters())
                .set("routeType", r.routeType())
                .set("startedAt", r.startedAt().toString())
                .set("createdAt", r.createdAt().toString());

        List<Value<?>> splitValues = new ArrayList<>();
        for (Run.Split s : r.splits()) {
            FullEntity<?> se = FullEntity.newBuilder()
                    .set("km", s.km())
                    .set("durationSeconds", s.durationSeconds())
                    .build();
            splitValues.add(EntityValue.of(se));
        }
        // Always set the property (possibly empty) so reads are uniform.
        entity.set("splits", splitValues);

        DATASTORE.put(entity.build());
    }

    public Optional<Run> findById(String id) {
        Entity e = DATASTORE.get(KEY_FACTORY.newKey(id));
        return Optional.ofNullable(e).map(this::toRun);
    }

    /** A user's runs, newest first, capped at {@code limit}. */
    public List<Run> listByOwner(String userId, int limit) {
        List<Run> runs = queryByOwner(userId);
        runs.sort(NEWEST_FIRST);
        return runs.size() > limit ? runs.subList(0, limit) : runs;
    }

    /** The user's single most recent run, if any. */
    public Optional<Run> findLastByOwner(String userId) {
        return queryByOwner(userId).stream().max(Comparator.comparing(Run::startedAt));
    }

    /** Every run (for clan-ranking aggregation). Unsorted. */
    public List<Run> all() {
        Query<Entity> q = Query.newEntityQueryBuilder().setKind(KIND).build();
        QueryResults<Entity> results = DATASTORE.run(q);
        List<Run> runs = new ArrayList<>();
        while (results.hasNext()) {
            runs.add(toRun(results.next()));
        }
        return runs;
    }

    /** Most recent runs across all users (for the global feed), newest first. */
    public List<Run> listRecent(int limit) {
        Query<Entity> q = Query.newEntityQueryBuilder().setKind(KIND).build();
        QueryResults<Entity> results = DATASTORE.run(q);
        List<Run> runs = new ArrayList<>();
        while (results.hasNext()) {
            runs.add(toRun(results.next()));
        }
        runs.sort(NEWEST_FIRST);
        return runs.size() > limit ? runs.subList(0, limit) : runs;
    }

    /** Runs by any of the given owners (e.g. a clan), newest first, capped. */
    public List<Run> listByOwners(Collection<String> userIds, int limit) {
        List<Run> runs = new ArrayList<>();
        for (String uid : userIds) {
            runs.addAll(queryByOwner(uid));
        }
        runs.sort(NEWEST_FIRST);
        return runs.size() > limit ? runs.subList(0, limit) : runs;
    }

    // --- internals -----------------------------------------------------------

    private List<Run> queryByOwner(String userId) {
        Query<Entity> q = Query.newEntityQueryBuilder()
                .setKind(KIND)
                .setFilter(PropertyFilter.eq("userId", userId))
                .build();
        QueryResults<Entity> results = DATASTORE.run(q);
        List<Run> runs = new ArrayList<>();
        while (results.hasNext()) {
            runs.add(toRun(results.next()));
        }
        return runs;
    }

    private Run toRun(Entity e) {
        List<Run.Split> splits = new ArrayList<>();
        if (e.contains("splits")) {
            for (Value<?> v : e.getList("splits")) {
                FullEntity<?> se = ((EntityValue) v).get();
                splits.add(new Run.Split(
                        (int) se.getLong("km"),
                        (int) se.getLong("durationSeconds")));
            }
        }
        return new Run(
                e.getKey().getName(),
                e.getString("userId"),
                e.getString("title"),
                e.getString("location"),
                (int) e.getLong("distanceMeters"),
                (int) e.getLong("durationSeconds"),
                (int) e.getLong("elevationMeters"),
                e.getString("routeType"),
                Instant.parse(e.getString("startedAt")),
                Instant.parse(e.getString("createdAt")),
                splits
        );
    }
}
