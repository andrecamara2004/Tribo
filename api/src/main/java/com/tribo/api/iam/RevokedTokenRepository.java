package com.tribo.api.iam;

import com.google.cloud.Timestamp;
import com.google.cloud.datastore.Datastore;
import com.google.cloud.datastore.DatastoreOptions;
import com.google.cloud.datastore.Entity;
import com.google.cloud.datastore.Key;
import com.google.cloud.datastore.KeyFactory;

import java.time.Instant;
import java.util.Date;

/**
 * Tracks revoked refresh tokens (B-8). A refresh token is revoked when the
 * user logs out; /auth/refresh rejects any token whose jti is in here.
 *
 * KEY STRATEGY: the entity key IS the refresh token's jti. That makes
 * revocation idempotent (re-revoking overwrites the same key) and the
 * revocation check a single O(1) key get — no query, no index.
 *
 * CLEANUP: a revocation entry is only meaningful until the token would have
 * expired anyway (after that, JwtIssuer.verify rejects it on expiry). We store
 * expiresAt so a Datastore TTL policy on the "RevokedToken" kind — pointed at
 * the expiresAt field — can purge stale entries automatically. Without a TTL
 * policy they simply accumulate harmlessly; refresh tokens live 7 days max.
 */
public class RevokedTokenRepository {

    static final String KIND = "RevokedToken";

    private static final Datastore DATASTORE =
            DatastoreOptions.getDefaultInstance().getService();

    private static final KeyFactory KEY_FACTORY =
            DATASTORE.newKeyFactory().setKind(KIND);

    /**
     * Mark a refresh token's jti as revoked.
     *
     * @param jti       the refresh token's unique id (the JWT "jti" claim)
     * @param expiresAt when the token naturally expires; stored for TTL cleanup
     */
    public void revoke(String jti, Instant expiresAt) {
        Key key = KEY_FACTORY.newKey(jti);
        Entity entity = Entity.newBuilder(key)
                .set("revokedAt", Timestamp.now())
                .set("expiresAt", Timestamp.of(Date.from(expiresAt)))
                .build();
        DATASTORE.put(entity);
    }

    /** True if this jti has been revoked. */
    public boolean isRevoked(String jti) {
        if (jti == null) return false;
        Key key = KEY_FACTORY.newKey(jti);
        return DATASTORE.get(key) != null;
    }
}