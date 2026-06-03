package com.tribo.api.activity;

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

/**
 * Datastore access for the Participation kind. Key is the deterministic
 * "{activityId}:{userId}" string (see Participation.key()), which enforces
 * one-join-per-user without a uniqueness query.
 *
 * The roster query filters by an equality on `activityId` (automatic
 * single-property index — no composite index config needed) and counts via the
 * same path.
 */
public class ParticipationRepository {

    static final String KIND = "Participation";

    private static final Datastore DATASTORE =
            DatastoreOptions.getDefaultInstance().getService();

    private static final KeyFactory KEY_FACTORY =
            DATASTORE.newKeyFactory().setKind(KIND);

    public void save(Participation p) {
        Key key = KEY_FACTORY.newKey(p.key());
        Entity entity = Entity.newBuilder(key)
                .set("activityId", p.activityId())
                .set("userId", p.userId())
                .set("joinedAt", p.joinedAt().toString())
                .set("role", p.role().name())
                .build();
        DATASTORE.put(entity);
    }

    public boolean exists(String activityId, String userId) {
        Key key = KEY_FACTORY.newKey(Participation.keyOf(activityId, userId));
        return DATASTORE.get(key) != null;
    }

    public void delete(String activityId, String userId) {
        DATASTORE.delete(KEY_FACTORY.newKey(Participation.keyOf(activityId, userId)));
    }

    /** All participants of an activity. */
    public List<Participation> findByActivity(String activityId) {
        Query<Entity> q = Query.newEntityQueryBuilder()
                .setKind(KIND)
                .setFilter(PropertyFilter.eq("activityId", activityId))
                .build();
        QueryResults<Entity> results = DATASTORE.run(q);
        List<Participation> out = new ArrayList<>();
        while (results.hasNext()) {
            out.add(toParticipation(results.next()));
        }
        return out;
    }

    /** Current participant count for capacity checks (all roles). */
    public int countByActivity(String activityId) {
        // Key-only query keeps the count cheap (no property reads).
        Query<Key> q = Query.newKeyQueryBuilder()
                .setKind(KIND)
                .setFilter(PropertyFilter.eq("activityId", activityId))
                .build();
        QueryResults<Key> results = DATASTORE.run(q);
        int n = 0;
        while (results.hasNext()) {
            results.next();
            n++;
        }
        return n;
    }

    /** Count of participants in a given role (for per-role capacity). */
    public int countByActivityAndRole(String activityId, ParticipationRole role) {
        int n = 0;
        for (Participation p : findByActivity(activityId)) {
            if (p.role() == role) n++;
        }
        return n;
    }

    /** The caller's role on an activity, if they've joined. */
    public java.util.Optional<ParticipationRole> findRole(String activityId, String userId) {
        Entity e = DATASTORE.get(KEY_FACTORY.newKey(Participation.keyOf(activityId, userId)));
        return e == null ? java.util.Optional.empty()
                : java.util.Optional.of(roleOf(e));
    }

    /** All participations across activities (for the global feed). */
    public List<Participation> listAll() {
        Query<Entity> q = Query.newEntityQueryBuilder().setKind(KIND).build();
        QueryResults<Entity> results = DATASTORE.run(q);
        List<Participation> out = new ArrayList<>();
        while (results.hasNext()) {
            out.add(toParticipation(results.next()));
        }
        return out;
    }

    /** All of a user's participations (e.g. to count volunteer events). */
    public List<Participation> findByUser(String userId) {
        Query<Entity> q = Query.newEntityQueryBuilder()
                .setKind(KIND)
                .setFilter(PropertyFilter.eq("userId", userId))
                .build();
        QueryResults<Entity> results = DATASTORE.run(q);
        List<Participation> out = new ArrayList<>();
        while (results.hasNext()) {
            out.add(toParticipation(results.next()));
        }
        return out;
    }

    private static ParticipationRole roleOf(Entity e) {
        // Legacy participations (pre-D-6) have no role → PARTICIPANT.
        return e.contains("role") ? ParticipationRole.valueOf(e.getString("role"))
                : ParticipationRole.PARTICIPANT;
    }

    private Participation toParticipation(Entity e) {
        return new Participation(
                e.getString("activityId"),
                e.getString("userId"),
                Instant.parse(e.getString("joinedAt")),
                roleOf(e)
        );
    }
}
