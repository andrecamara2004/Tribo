package com.tribo.api.clan;

import com.google.cloud.datastore.Datastore;
import com.google.cloud.datastore.DatastoreOptions;
import com.google.cloud.datastore.Entity;
import com.google.cloud.datastore.Key;
import com.google.cloud.datastore.KeyFactory;

import java.time.Instant;
import java.util.Optional;

/**
 * Stores a clan's leaderboard rank for a given metric+period in a given ISO week
 * (Phase 6), so the ranking endpoint can compute a week-over-week trend.
 *
 * Key is deterministic: "{metric}:{period}:{isoWeek}:{clanId}" — one rank per
 * clan per metric+period per week (re-running the ranking overwrites the same
 * key). isoWeek is "YYYY-Www" (ISO week-based year + week).
 */
public class RankSnapshotRepository {

    static final String KIND = "RankSnapshot";

    private static final Datastore DATASTORE =
            DatastoreOptions.getDefaultInstance().getService();

    private static final KeyFactory KEY_FACTORY =
            DATASTORE.newKeyFactory().setKind(KIND);

    private static String keyOf(String metric, String period, String isoWeek, String clanId) {
        return metric + ":" + period + ":" + isoWeek + ":" + clanId;
    }

    /** The clan's recorded rank for that metric+period+week, if any. */
    public Optional<Integer> getRank(String metric, String period, String isoWeek, String clanId) {
        Entity e = DATASTORE.get(KEY_FACTORY.newKey(keyOf(metric, period, isoWeek, clanId)));
        return e == null ? Optional.empty() : Optional.of((int) e.getLong("rank"));
    }

    /** Record (overwrite) the clan's rank for that metric+period+week. */
    public void put(String metric, String period, String isoWeek, String clanId, int rank) {
        Key key = KEY_FACTORY.newKey(keyOf(metric, period, isoWeek, clanId));
        DATASTORE.put(Entity.newBuilder(key)
                .set("rank", rank)
                .set("updatedAt", Instant.now().toString())
                .build());
    }
}
