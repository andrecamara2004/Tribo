package com.tribo.api.clan;

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
 * Datastore access for the ClanMessage kind.
 *
 * Follows the RunRepository/ClanRepository pattern:
 * UUID-string key, static Datastore client, hand-rolled entity mapping.
 *
 * listByClan() fetches all messages for a given clan, sorted newest-first
 * in memory (Datastore requires a composite index for multi-property ordering,
 * so we sort after fetch to stay index-free at this scale).
 */
public class ClanMessageRepository {

    static final String KIND = "ClanMessage";
    static final int MAX_MESSAGES = 50;

    private static final Datastore DATASTORE = DatastoreOptions.getDefaultInstance().getService();

    private static final KeyFactory KEY_FACTORY = DATASTORE.newKeyFactory().setKind(KIND);

    /** Persist a message. Overwrites any existing entity with the same id. */
    public void save(ClanMessage message) {
        Key key = KEY_FACTORY.newKey(message.id());
        Entity entity = Entity.newBuilder(key)
                .set("clanId", message.clanId())
                .set("userId", message.userId())
                .set("fullName", message.fullName())
                .set("text", message.text())
                .set("sentAt", message.sentAt().toString())
                .build();
        DATASTORE.put(entity);
    }

    /**
     * Returns the last MAX_MESSAGES (50) messages for the given clan,
     * sorted oldest-first (ascending sentAt) so the UI can render them
     * top-to-bottom.
     */
    public List<ClanMessage> listByClan(String clanId) {
        Query<Entity> q = Query.newEntityQueryBuilder()
                .setKind(KIND)
                .setFilter(PropertyFilter.eq("clanId", clanId))
                .build();

        QueryResults<Entity> results = DATASTORE.run(q);
        List<ClanMessage> messages = new ArrayList<>();
        while (results.hasNext()) {
            messages.add(toClanMessage(results.next()));
        }

        // Sort newest-first, then cap to MAX_MESSAGES, then reverse to oldest-first.
        messages.sort((a, b) -> b.sentAt().compareTo(a.sentAt()));
        if (messages.size() > MAX_MESSAGES) {
            messages = messages.subList(0, MAX_MESSAGES);
        }
        // Reverse so the UI gets them in chronological order (oldest at top).
        java.util.Collections.reverse(messages);
        return messages;
    }

    // --- internal mapping ----------------------------------------------------

    private ClanMessage toClanMessage(Entity e) {
        return new ClanMessage(
                e.getKey().getName(),
                e.getString("clanId"),
                e.getString("userId"),
                e.getString("fullName"),
                e.getString("text"),
                Instant.parse(e.getString("sentAt")));
    }
}