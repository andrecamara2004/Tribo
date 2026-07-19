package com.tribo.api.iam;

import com.google.cloud.datastore.Datastore;
import com.google.cloud.datastore.DatastoreOptions;
import com.google.cloud.datastore.Entity;
import com.google.cloud.datastore.Key;
import com.google.cloud.datastore.KeyFactory;
import com.google.cloud.datastore.Query;
import com.google.cloud.datastore.QueryResults;
import com.google.cloud.datastore.StructuredQuery.PropertyFilter;

import java.time.Instant;
import java.util.Optional;

/**
 * Datastore access for the User kind.
 *
 * KEY STRATEGY: we use the user's id (a UUID string) as the entity key,
 * NOT the email. Rationale:
 * - Datastore keys are immutable. If a user ever changes their email,
 * a key based on email forces deleting and recreating the entity.
 * - Keeping email as an indexed property lets us look it up in O(1) via
 * a single-property query.
 *
 * UNIQUENESS: Datastore does not enforce uniqueness on non-key properties.
 * We enforce email uniqueness at the application level inside the register
 * endpoint (ticket B-6) by calling existsByEmail() before save().
 *
 * This is a singleton-style class with a static Datastore client. For a
 * larger app we'd inject this via a DI container; for sprint 1, simple
 * static is fine. (The Activity repository in Sprint 2 follows this pattern.)
 */
public class UserRepository {

    static final String KIND = "User";

    // Uses Application Default Credentials — the App Engine default service
    // account in production and the DATASTORE_EMULATOR_HOST env var locally.
    private static final Datastore DATASTORE = DatastoreOptions.getDefaultInstance().getService();

    private static final KeyFactory KEY_FACTORY = DATASTORE.newKeyFactory().setKind(KIND);

    /**
     * Persist a user. Overwrites any existing entity with the same id.
     * Callers must check uniqueness (via existsByEmail) BEFORE calling save
     * during registration.
     */
    public void save(User user) {
        Key key = KEY_FACTORY.newKey(user.id());

        Entity.Builder entity = Entity.newBuilder(key)
                .set("email", user.email().toLowerCase())
                .set("passwordHash", user.passwordHash())
                .set("fullName", user.fullName())
                .set("phoneNumber", user.phoneNumber())
                .set("birthDate", user.birthDate() == null ? "" : user.birthDate())
                .set("role", user.role().name())
                .set("profileVisibility", user.profileVisibility().name())
                .set("createdAt", user.createdAt().toString())
                .set("suspended", user.suspended())
                .set("verified", user.verified())
                .set("emailVerified", user.emailVerified())
                .set("themePreference", user.themePreference().name())
                .set("weeklyGoalKm", user.weeklyGoalKm());

        if (user.pictureUrl() != null) {
            entity.set("pictureUrl", user.pictureUrl());
        }

        // clanId is optional (D-3): only write the property when the user is in
        // a clan, so "no clan" is simply the absence of the property.
        if (user.clanId() != null) {
            entity.set("clanId", user.clanId());
        }

        DATASTORE.put(entity.build());
    }

    /**
     * Look up a user by their id (the primary key).
     */
    public Optional<User> findById(String id) {
        Key key = KEY_FACTORY.newKey(id);
        Entity e = DATASTORE.get(key);
        return Optional.ofNullable(e).map(this::toUser);
    }

    /**
     * Look up a user by email. Email is lowercased before the query so
     * "Andre@Example.com" matches the stored "andre@example.com".
     */
    public Optional<User> findByEmail(String email) {
        String normalized = email.toLowerCase();

        Query<Entity> q = Query.newEntityQueryBuilder()
                .setKind(KIND)
                .setFilter(PropertyFilter.eq("email", normalized))
                .setLimit(1)
                .build();

        QueryResults<Entity> results = DATASTORE.run(q);
        if (!results.hasNext()) {
            return Optional.empty();
        }
        return Optional.of(toUser(results.next()));
    }

    /**
     * Existence check used by the register endpoint to enforce email uniqueness.
     * Returns true if a user with this email is already registered.
     */
    public boolean existsByEmail(String email) {
        return findByEmail(email).isPresent();
    }

    // --- internal mapping ------------------------------------------------

    private User toUser(Entity e) {
        return new User(
                e.getKey().getName(),
                e.getString("email"),
                e.getString("passwordHash"),
                e.getString("fullName"),
                e.getString("phoneNumber"),
                birthDateOf(e),
                Role.valueOf(e.getString("role")),
                User.ProfileVisibility.valueOf(e.getString("profileVisibility")),
                Instant.parse(e.getString("createdAt")),
                e.getBoolean("suspended"),
                // Legacy entities (created before the verified flag) default to
                // verified=true: they're END_USERs and were already able to act.
                !e.contains("verified") || e.getBoolean("verified"),
                // clanId is optional and absent for users not in a clan (and for
                // legacy entities created before D-3).
                e.contains("clanId") ? e.getString("clanId") : null,
                e.contains("weeklyGoalKm") ? e.getDouble("weeklyGoalKm") : 0.0,
                e.contains("pictureUrl") ? e.getString("pictureUrl") : null,
                // Legacy entities (created before email verification) default to
                // emailVerified=true so existing accounts aren't locked out.
                !e.contains("emailVerified") || e.getBoolean("emailVerified"),
                // Legacy entities default to LIGHT mode
                e.contains("themePreference") ? User.ThemePreference.valueOf(e.getString("themePreference"))
                        : User.ThemePreference.LIGHT);
    }

    /**
     * Reads the birth date, tolerating legacy entities that only stored an
     * integer {@code age}: those get an approximate DOB (Jan 1 of the birth
     * year), so age derivation still works for pre-existing accounts.
     */
    private static String birthDateOf(Entity e) {
        if (e.contains("birthDate")) {
            return e.getString("birthDate");
        }
        if (e.contains("age")) {
            long age = e.getLong("age");
            return java.time.LocalDate.now(java.time.ZoneOffset.UTC)
                    .minusYears(age).withDayOfYear(1).toString();
        }
        return "";
    }

    /**
     * Marks a user verified (backoffice action, D-1). No-op if the user is
     * already verified. Returns the updated user, or empty if no such user.
     */
    public Optional<User> markVerified(String id) {
        Optional<User> found = findById(id);
        if (found.isEmpty())
            return Optional.empty();
        User u = found.get();
        if (u.verified())
            return found;
        User updated = new User(
                u.id(), u.email(), u.passwordHash(), u.fullName(), u.phoneNumber(),
                u.birthDate(), u.role(), u.profileVisibility(), u.createdAt(),
                u.suspended(), true, u.clanId(), u.weeklyGoalKm(), u.pictureUrl(), u.emailVerified(),
                u.themePreference());
        save(updated);
        return Optional.of(updated);
    }

    /**
     * Sets (or clears) a user's clan membership (D-3). Pass {@code clanId == null}
     * to leave the current clan. Returns the updated user, or empty if no such
     * user. Idempotent: setting the clan the user is already in is a no-op.
     */
    public Optional<User> setClan(String userId, String clanId) {
        Optional<User> found = findById(userId);
        if (found.isEmpty())
            return Optional.empty();
        User u = found.get();
        if (java.util.Objects.equals(u.clanId(), clanId))
            return found;
        User updated = new User(
                u.id(), u.email(), u.passwordHash(), u.fullName(), u.phoneNumber(),
                u.birthDate(), u.role(), u.profileVisibility(), u.createdAt(),
                u.suspended(), u.verified(), clanId, u.weeklyGoalKm(), u.pictureUrl(), u.emailVerified(),
                u.themePreference());
        save(updated);
        return Optional.of(updated);
    }

    /** Sets the caller's weekly distance goal in km (0 clears it). Phase 6. */
    public Optional<User> setWeeklyGoal(String userId, double km) {
        Optional<User> found = findById(userId);
        if (found.isEmpty())
            return Optional.empty();
        User u = found.get();
        User updated = new User(
                u.id(), u.email(), u.passwordHash(), u.fullName(), u.phoneNumber(),
                u.birthDate(), u.role(), u.profileVisibility(), u.createdAt(),
                u.suspended(), u.verified(), u.clanId(), Math.max(0, km), u.pictureUrl(),
                u.emailVerified(), u.themePreference());
        save(updated);
        return Optional.of(updated);
    }

    /** Marks a user's email confirmed. Idempotent. Returns the updated user. */
    public Optional<User> setEmailVerified(String id) {
        Optional<User> found = findById(id);
        if (found.isEmpty())
            return Optional.empty();
        User u = found.get();
        if (u.emailVerified())
            return found;
        User updated = new User(
                u.id(), u.email(), u.passwordHash(), u.fullName(), u.phoneNumber(),
                u.birthDate(), u.role(), u.profileVisibility(), u.createdAt(),
                u.suspended(), u.verified(), u.clanId(), u.weeklyGoalKm(), u.pictureUrl(), true,
                u.themePreference());
        save(updated);
        return Optional.of(updated);
    }

    /** Replaces the user's password hash (change-password flow). */
    public Optional<User> updatePasswordHash(String id, String newHash) {
        Optional<User> found = findById(id);
        if (found.isEmpty())
            return Optional.empty();
        User u = found.get();
        User updated = new User(
                u.id(), u.email(), newHash, u.fullName(), u.phoneNumber(),
                u.birthDate(), u.role(), u.profileVisibility(), u.createdAt(),
                u.suspended(), u.verified(), u.clanId(), u.weeklyGoalKm(), u.pictureUrl(),
                u.emailVerified(), u.themePreference());
        save(updated);
        return Optional.of(updated);
    }

    /** Sets the user's profile visibility (PUBLIC / PRIVATE). */
    public Optional<User> setVisibility(String id, User.ProfileVisibility visibility) {
        Optional<User> found = findById(id);
        if (found.isEmpty())
            return Optional.empty();
        User u = found.get();
        if (u.profileVisibility() == visibility)
            return found;
        User updated = new User(
                u.id(), u.email(), u.passwordHash(), u.fullName(), u.phoneNumber(),
                u.birthDate(), u.role(), visibility, u.createdAt(),
                u.suspended(), u.verified(), u.clanId(), u.weeklyGoalKm(), u.pictureUrl(),
                u.emailVerified(), u.themePreference());
        save(updated);
        return Optional.of(updated);
    }

    /** Number of users in a clan (derived member count). Keys-only query. */
    public long countByClan(String clanId) {
        long count = 0;
        QueryResults<Key> results = runKeyQueryByClan(clanId);
        while (results.hasNext()) {
            results.next();
            count++;
        }
        return count;
    }

    /** Ids of users in a clan (e.g. to gather a clan's runs). Keys-only query. */
    public java.util.List<String> findIdsByClan(String clanId) {
        java.util.List<String> ids = new java.util.ArrayList<>();
        QueryResults<Key> results = runKeyQueryByClan(clanId);
        while (results.hasNext()) {
            ids.add(results.next().getName());
        }
        return ids;
    }

    private QueryResults<Key> runKeyQueryByClan(String clanId) {
        Query<Key> q = Query.newKeyQueryBuilder()
                .setKind(KIND)
                .setFilter(PropertyFilter.eq("clanId", clanId))
                .build();
        return DATASTORE.run(q);
    }

    /**
     * Suspends or unsuspends a user (BACKOFFICE action, B4-1).
     * A suspended user cannot log in. Returns the updated user,
     * or empty if no such user exists.
     */
    public Optional<User> setSuspended(String id, boolean suspended) {
        Optional<User> found = findById(id);
        if (found.isEmpty())
            return Optional.empty();
        User u = found.get();
        if (u.suspended() == suspended)
            return found; // already in the desired state, no-op
        User updated = new User(
                u.id(), u.email(), u.passwordHash(), u.fullName(), u.phoneNumber(),
                u.birthDate(), u.role(), u.profileVisibility(), u.createdAt(),
                suspended, u.verified(), u.clanId(), u.weeklyGoalKm(), u.pictureUrl(), u.emailVerified(),
                u.themePreference());
        save(updated);
        return Optional.of(updated);
    }

    /**
     * Lists all users (BACKOFFICE console). Full entity scan — acceptable at
     * this scale; backoffice is low-traffic and the user count is small.
     */
    public java.util.List<User> listAll() {
        Query<Entity> q = Query.newEntityQueryBuilder().setKind(KIND).build();
        java.util.List<User> users = new java.util.ArrayList<>();
        QueryResults<Entity> results = DATASTORE.run(q);
        while (results.hasNext()) {
            users.add(toUser(results.next()));
        }
        return users;
    }

    /**
     * Counts all users. Uses a keys-only query — much cheaper than reading
     * full entities, since the Datastore only returns key stubs.
     */
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
}
