package com.tribo.api.clan;

import com.google.cloud.datastore.Datastore;
import com.google.cloud.datastore.DatastoreOptions;
import com.google.cloud.datastore.Entity;
import com.google.cloud.datastore.Key;
import com.google.cloud.datastore.KeyFactory;
import com.google.cloud.datastore.Query;
import com.google.cloud.datastore.QueryResults;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

/**
 * Datastore access for the Clan kind. Follows the Activity/User repository
 * pattern: UUID-string key, static Datastore client, hand-rolled entity mapping.
 *
 * The clan set is small (one per team), so list() returns everything with no
 * cursor paging — add it later if the count grows. Member counts are not stored
 * here; callers derive them via UserRepository.countByClan.
 */
public class ClanRepository {

    static final String KIND = "Clan";

    private static final Datastore DATASTORE =
            DatastoreOptions.getDefaultInstance().getService();

    private static final KeyFactory KEY_FACTORY =
            DATASTORE.newKeyFactory().setKind(KIND);

    /** Persist a clan. Overwrites any existing entity with the same id. */
    public void save(Clan c) {
        Key key = KEY_FACTORY.newKey(c.id());
        Entity entity = Entity.newBuilder(key)
                .set("name", c.name())
                .set("tag", c.tag())
                .set("color", c.color())
                .set("ownerId", c.ownerId())
                .set("createdAt", c.createdAt().toString())
                .build();
        DATASTORE.put(entity);
    }

    public Optional<Clan> findById(String id) {
        Entity e = DATASTORE.get(KEY_FACTORY.newKey(id));
        return Optional.ofNullable(e).map(this::toClan);
    }

    public void delete(String id) {
        DATASTORE.delete(KEY_FACTORY.newKey(id));
    }

    /** All clans. Small set — no paging yet. */
    public List<Clan> list() {
        Query<Entity> q = Query.newEntityQueryBuilder().setKind(KIND).build();
        QueryResults<Entity> results = DATASTORE.run(q);
        List<Clan> items = new ArrayList<>();
        while (results.hasNext()) {
            items.add(toClan(results.next()));
        }
        return items;
    }

    // --- internal mapping ----------------------------------------------------

    private Clan toClan(Entity e) {
        return new Clan(
                e.getKey().getName(),
                e.getString("name"),
                e.getString("tag"),
                e.getString("color"),
                e.getString("ownerId"),
                Instant.parse(e.getString("createdAt"))
        );
    }
}
