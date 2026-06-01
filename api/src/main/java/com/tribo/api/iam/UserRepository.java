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
 *   - Datastore keys are immutable. If a user ever changes their email,
 *     a key based on email forces deleting and recreating the entity.
 *   - Keeping email as an indexed property lets us look it up in O(1) via
 *     a single-property query.
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
    private static final Datastore DATASTORE =
            DatastoreOptions.getDefaultInstance().getService();

    private static final KeyFactory KEY_FACTORY =
            DATASTORE.newKeyFactory().setKind(KIND);

    /**
     * Persist a user. Overwrites any existing entity with the same id.
     * Callers must check uniqueness (via existsByEmail) BEFORE calling save
     * during registration.
     */
    public void save(User user) {
        Key key = KEY_FACTORY.newKey(user.id());

        Entity entity = Entity.newBuilder(key)
                .set("email", user.email().toLowerCase())
                .set("passwordHash", user.passwordHash())
                .set("fullName", user.fullName())
                .set("phoneNumber", user.phoneNumber())
                .set("age", user.age())
                .set("role", user.role().name())
                .set("profileVisibility", user.profileVisibility().name())
                .set("createdAt", user.createdAt().toString())
                .set("suspended", user.suspended())
                .build();

        DATASTORE.put(entity);
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
                (int) e.getLong("age"),
                Role.valueOf(e.getString("role")),
                User.ProfileVisibility.valueOf(e.getString("profileVisibility")),
                Instant.parse(e.getString("createdAt")),
                e.getBoolean("suspended")
        );
    }
}