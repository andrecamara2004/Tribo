package com.tribo.api.activity;

import com.google.cloud.datastore.Cursor;
import com.google.cloud.datastore.Datastore;
import com.google.cloud.datastore.DatastoreOptions;
import com.google.cloud.datastore.Entity;
import com.google.cloud.datastore.Key;
import com.google.cloud.datastore.KeyFactory;
import com.google.cloud.datastore.Query;
import com.google.cloud.datastore.QueryResults;
import com.google.cloud.datastore.StructuredQuery;
import com.google.cloud.datastore.StructuredQuery.PropertyFilter;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;

/**
 * Datastore access for the Activity kind. Follows the UserRepository pattern:
 * UUID-string key, static Datastore client, hand-rolled entity mapping.
 *
 * LISTING & INDEXES: list() filters by an optional equality on `status`, which
 * only needs Datastore's automatic single-property index — no composite index
 * config required. We deliberately don't combine the status filter with a
 * custom sort order (that would need a composite index in
 * datastore-indexes.xml);
 * richer sorting/filtering is a later refinement. Paging uses Datastore
 * cursors.
 */
public class ActivityRepository {

    static final String KIND = "Activity";

    private static final Datastore DATASTORE = DatastoreOptions.getDefaultInstance().getService();

    private static final KeyFactory KEY_FACTORY = DATASTORE.newKeyFactory().setKind(KIND);

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
                .set("pointsStaff", a.pointsStaff())
                .set("reviewCount", a.reviewCount())
                .set("averageRating", a.averageRating());

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
     * @param status if non-null, only activities in this status
     * @param limit  max items in the page (clamped to a sane range by caller)
     * @param cursor opaque url-safe cursor from a previous page, or null to start
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
            if (after != null)
                next = after.toUrlSafe();
        }
        return new ActivityPage(items, next);
    }

    /**
     * Search + filter within a status. Unlike {@link #list}, this supports a
     * free-text query, an event-kind filter and a distance range. Because those
     * criteria would each need composite Datastore indexes (and text search has
     * no native support), we load the status-matched set — which only needs the
     * automatic single-property index — and filter/sort/page in memory. Fine for
     * the catalog sizes this app deals with; the same trade-off {@link
     * #listByRating} already makes.
     *
     * Paging is offset-based: {@code cursor} is the integer offset of the next
     * page (as a string), or null at the end. Results put still-joinable
     * activities before already-ended ones (endsAt in the past); within each
     * group they're ordered nearest-first when a point is given, otherwise by
     * soonest start time, so paging stays deterministic.
     *
     * @param status        if non-null, only activities in this status
     * @param q             case-insensitive substring matched against title,
     *                      description, location, host, category and tags; null/blank ignored
     * @param eventKind     if non-null, only activities of this kind
     * @param minDistanceKm if non-null, only activities with distanceKm >= this
     * @param maxDistanceKm if non-null, only activities with distanceKm <= this
     * @param nearLat       with nearLng, filters to activities within radiusKm of
     *                      this point (activities without a pin are excluded);
     *                      results are then ordered nearest-first
     * @param nearLng       see nearLat
     * @param radiusKm      proximity radius in km (defaults to 25 when a point is
     *                      given without one)
     * @param limit         max items in the page
     * @param offset        number of matching items to skip (0 for the first page)
     */
    public ActivityPage search(ActivityStatus status, String q, EventKind eventKind,
            Double minDistanceKm, Double maxDistanceKm,
            Double nearLat, Double nearLng, Double radiusKm, int limit, int offset) {
        var qb = Query.newEntityQueryBuilder().setKind(KIND);
        if (status != null) {
            qb.setFilter(PropertyFilter.eq("status", status.name()));
        }

        QueryResults<Entity> results = DATASTORE.run(qb.build());
        String needle = q == null ? "" : q.trim().toLowerCase();
        boolean near = nearLat != null && nearLng != null;
        double radius = radiusKm != null ? radiusKm : 25.0;

        List<Activity> matched = new ArrayList<>();
        while (results.hasNext()) {
            Activity a = toActivity(results.next());
            if (eventKind != null && a.eventKind() != eventKind)
                continue;
            if (minDistanceKm != null && a.distanceKm() < minDistanceKm)
                continue;
            if (maxDistanceKm != null && a.distanceKm() > maxDistanceKm)
                continue;
            if (!needle.isEmpty() && !matchesText(a, needle))
                continue;
            if (near) {
                if (a.latitude() == null || a.longitude() == null)
                    continue;
                if (haversineKm(nearLat, nearLng, a.latitude(), a.longitude()) > radius)
                    continue;
            }
            matched.add(a);
        }
        // Still-joinable activities first, already-ended ones pushed to the end.
        // Within each group: nearest-first when a point is given, otherwise
        // soonest-starting first.
        final Instant now = Instant.now();
        Comparator<Activity> byActive =
                Comparator.comparing((Activity a) -> a.endsAt().isBefore(now));
        if (near) {
            matched.sort(byActive.thenComparingDouble(
                    a -> haversineKm(nearLat, nearLng, a.latitude(), a.longitude())));
        } else {
            matched.sort(byActive.thenComparing(Activity::startsAt));
        }

        int from = Math.max(0, Math.min(offset, matched.size()));
        int to = Math.min(from + limit, matched.size());
        List<Activity> items = new ArrayList<>(matched.subList(from, to));
        String next = to < matched.size() ? String.valueOf(to) : null;
        return new ActivityPage(items, next);
    }

    /** Great-circle distance in kilometres between two lat/lng points. */
    private static double haversineKm(double lat1, double lng1, double lat2, double lng2) {
        final double earthRadiusKm = 6371.0088;
        double dLat = Math.toRadians(lat2 - lat1);
        double dLng = Math.toRadians(lng2 - lng1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                        * Math.sin(dLng / 2) * Math.sin(dLng / 2);
        return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    private static boolean matchesText(Activity a, String needle) {
        if (containsIgnoreCase(a.title(), needle)
                || containsIgnoreCase(a.description(), needle)
                || containsIgnoreCase(a.location(), needle)
                || containsIgnoreCase(a.host(), needle)
                || containsIgnoreCase(a.category(), needle)) {
            return true;
        }
        for (String t : a.tags()) {
            if (containsIgnoreCase(t, needle))
                return true;
        }
        return false;
    }

    private static boolean containsIgnoreCase(String haystack, String lowerNeedle) {
        return haystack != null && haystack.toLowerCase().contains(lowerNeedle);
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
                e.contains("longitude") ? e.getDouble("longitude") : null,
                e.contains("reviewCount") ? (int) e.getLong("reviewCount") : 0,
                e.contains("averageRating") ? e.getDouble("averageRating") : 0.0);
    }

    /** Counts all activities. Keys-only query for efficiency. */
    public long countAll() {
        Query<Key> q = Query.newKeyQueryBuilder().setKind(KIND).build();
        long count = 0;
        QueryResults<Key> results = DATASTORE.run(q);
        while (results.hasNext()) {
            results.next();
            count++;
        }
        return count;
    }

    /** Counts activities of a specific EventKind (e.g. VOLUNTEER). */
    public long countByKind(String eventKind) {
        Query<Key> q = Query.newKeyQueryBuilder()
                .setKind(KIND)
                .setFilter(StructuredQuery.PropertyFilter.eq("eventKind", eventKind))
                .build();
        long count = 0;
        QueryResults<Key> results = DATASTORE.run(q);
        while (results.hasNext()) {
            results.next();
            count++;
        }
        return count;
    }

    public List<Activity> listByRating() {

        Query<Entity> q = Query.newEntityQueryBuilder()
                .setKind(KIND)
                .build();

        QueryResults<Entity> results = DATASTORE.run(q);

        List<Activity> activities = new ArrayList<>();

        while (results.hasNext()) {
            activities.add(toActivity(results.next()));
        }
        activities.sort((a, b) -> Double.compare(b.averageRating(), a.averageRating()));
        return activities;
    }

}
