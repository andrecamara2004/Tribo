package com.tribo.api.iam;

import com.auth0.jwt.JWT;
import com.auth0.jwt.JWTVerifier;
import com.auth0.jwt.algorithms.Algorithm;
import com.auth0.jwt.exceptions.JWTVerificationException;
import com.auth0.jwt.interfaces.DecodedJWT;

import java.time.Instant;
import java.util.Date;
import java.util.UUID;

public class JwtIssuer {

    private static final long ACCESS_TTL_SECONDS = 15L * 60;
    private static final long REFRESH_TTL_SECONDS = 7L * 24 * 60 * 60;

    // Lazy holders — populated on first use, not at class load time.
    private static volatile Algorithm algorithm;
    private static volatile String issuer;
    private static volatile JWTVerifier verifier;

    private static synchronized void initIfNeeded() {
        if (algorithm != null) return;
        String secret = System.getenv("JWT_SECRET");
        if (secret == null || secret.isBlank()) {
            throw new IllegalStateException(
                    "JWT_SECRET env var is not set. Configure it in appengine-web.xml.");
        }
        issuer = System.getenv().getOrDefault("JWT_ISSUER", "tribo-api");
        algorithm = Algorithm.HMAC256(secret);
        verifier = JWT.require(algorithm).withIssuer(issuer).build();
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