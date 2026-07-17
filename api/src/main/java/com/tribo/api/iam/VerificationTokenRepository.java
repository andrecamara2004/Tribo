package com.tribo.api.iam;

import com.google.cloud.datastore.Datastore;
import com.google.cloud.datastore.DatastoreOptions;
import com.google.cloud.datastore.Entity;
import com.google.cloud.datastore.KeyFactory;

import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.Optional;

/**
 * Datastore access for one-time email-verification tokens. Each token is the
 * entity key; it maps to a userId and an expiry. Tokens are single-use — the
 * verify endpoint deletes the token once consumed.
 */
public class VerificationTokenRepository {

    private static final String KIND = "EmailVerificationToken";
    private static final SecureRandom RANDOM = new SecureRandom();

    private static final Datastore DATASTORE = DatastoreOptions.getDefaultInstance().getService();
    private static final KeyFactory KEY_FACTORY = DATASTORE.newKeyFactory().setKind(KIND);

    /** Creates + persists a fresh token for the user, valid until {@code expiresAt}. */
    public String create(String userId, Instant expiresAt) {
        byte[] buf = new byte[32];
        RANDOM.nextBytes(buf);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(buf);

        Entity entity = Entity.newBuilder(KEY_FACTORY.newKey(token))
                .set("userId", userId)
                .set("expiresAt", expiresAt.toString())
                .build();
        DATASTORE.put(entity);
        return token;
    }

    /** The userId this token belongs to, if the token exists and hasn't expired. */
    public Optional<String> resolveUserId(String token) {
        if (token == null || token.isBlank())
            return Optional.empty();
        Entity e = DATASTORE.get(KEY_FACTORY.newKey(token));
        if (e == null)
            return Optional.empty();
        Instant expiresAt = Instant.parse(e.getString("expiresAt"));
        if (Instant.now().isAfter(expiresAt)) {
            DATASTORE.delete(e.getKey()); // clean up expired token
            return Optional.empty();
        }
        return Optional.of(e.getString("userId"));
    }

    public void delete(String token) {
        if (token != null && !token.isBlank())
            DATASTORE.delete(KEY_FACTORY.newKey(token));
    }

    /** Removes any outstanding tokens for a user (before issuing a new one). */
    public void deleteByUser(String userId) {
        var query = com.google.cloud.datastore.Query.newKeyQueryBuilder()
                .setKind(KIND)
                .setFilter(com.google.cloud.datastore.StructuredQuery.PropertyFilter.eq("userId", userId))
                .build();
        var results = DATASTORE.run(query);
        while (results.hasNext()) {
            DATASTORE.delete(results.next());
        }
    }
}
