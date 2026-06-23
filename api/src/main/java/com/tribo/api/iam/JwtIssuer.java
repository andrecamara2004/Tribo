package com.tribo.api.iam;

import com.auth0.jwt.JWT;
import com.auth0.jwt.JWTVerifier;
import com.auth0.jwt.algorithms.Algorithm;
import com.auth0.jwt.exceptions.JWTVerificationException;
import com.auth0.jwt.interfaces.DecodedJWT;
import com.google.cloud.secretmanager.v1.SecretManagerServiceClient;
import com.google.cloud.secretmanager.v1.SecretVersionName;

import java.time.Instant;
import java.util.Date;
import java.util.UUID;
import java.util.logging.Level;
import java.util.logging.Logger;

public class JwtIssuer {

    private static final Logger LOG = Logger.getLogger(JwtIssuer.class.getName());

    private static final long ACCESS_TTL_SECONDS = 15L * 60;
    private static final long REFRESH_TTL_SECONDS = 7L * 24 * 60 * 60;

    private static volatile Algorithm algorithm;
    private static volatile String issuer;
    private static volatile JWTVerifier verifier;

    private static synchronized void initIfNeeded() {
        if (algorithm != null) return;
        String secret = resolveSecret();
        if (secret == null || secret.isBlank()) {
            throw new IllegalStateException(
                    "No JWT signing secret available: Secret Manager unreachable and the "
                            + "JWT_SECRET env var is unset. (SEC-1)");
        }
        issuer = System.getenv().getOrDefault("JWT_ISSUER", "tribo-api");
        algorithm = Algorithm.HMAC256(secret);
        verifier = JWT.require(algorithm).withIssuer(issuer).build();
    }

    /**
     * Resolution order (SEC-1): Secret Manager (production) → JWT_SECRET env var
     * (local-dev fallback) → fail-fast. The secret is NOT stored in source/config.
     */
    private static String resolveSecret() {
        String fromSm = fromSecretManager();
        if (fromSm != null && !fromSm.isBlank()) return fromSm;
        return System.getenv("JWT_SECRET"); // local-dev fallback
    }

    /** Reads the latest version of the JWT secret from Secret Manager, or null. */
    private static String fromSecretManager() {
        String project = System.getenv("GOOGLE_CLOUD_PROJECT");
        if (project == null || project.isBlank()) return null; // not on GCP (local dev)
        String secretId = System.getenv().getOrDefault("JWT_SECRET_NAME", "tribo-jwt-secret");
        try (SecretManagerServiceClient client = SecretManagerServiceClient.create()) {
            SecretVersionName name = SecretVersionName.of(project, secretId, "latest");
            return client.accessSecretVersion(name).getPayload().getData().toStringUtf8();
        } catch (Exception e) {
            LOG.log(Level.WARNING,
                    "Could not read JWT secret from Secret Manager; falling back to JWT_SECRET env.", e);
            return null;
        }
    }

    public String issueAccessToken(String userId, Role role) {
        initIfNeeded();
        Instant now = Instant.now();
        return JWT.create()
                .withIssuer(issuer)
                .withSubject(userId)
                .withClaim("role", role.name())
                .withJWTId(UUID.randomUUID().toString())
                .withIssuedAt(Date.from(now))
                .withExpiresAt(Date.from(now.plusSeconds(ACCESS_TTL_SECONDS)))
                .sign(algorithm);
    }

    public String issueRefreshToken(String userId) {
        initIfNeeded();
        Instant now = Instant.now();
        return JWT.create()
                .withIssuer(issuer)
                .withSubject(userId)
                .withClaim("typ", "refresh")
                .withJWTId(UUID.randomUUID().toString())
                .withIssuedAt(Date.from(now))
                .withExpiresAt(Date.from(now.plusSeconds(REFRESH_TTL_SECONDS)))
                .sign(algorithm);
    }

    public DecodedJWT verify(String token) throws JWTVerificationException {
        initIfNeeded();
        return verifier.verify(token);
    }

    public long accessTokenTtlSeconds() { return ACCESS_TTL_SECONDS; }
    public long refreshTokenTtlSeconds() { return REFRESH_TTL_SECONDS; }
}